// Stripe tells this function when someone pays, a payment fails, or autopay is cancelled,
// and it updates the customer in the app:
//   paid            -> Active, "paid through" moves to the end of the new month
//   payment failed  -> Payment issue (after 7 days the staff app pauses them and they go on the Call list)
//   cancel at end   -> shows "Wants to cancel" on the Clients page
//   ended           -> Cancelled
//
// Turn OFF "Verify JWT" for this function: Stripe calls it, not a logged-in person.
// Secrets (Supabase > Edge Functions > Secrets):
//   STRIPE_WEBHOOK_SECRET   from Stripe > Developers > Webhooks > your endpoint > Signing secret (starts with whsec_)
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
const dateOf = (unix: number) => new Date(unix * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

/** Checks Stripe's signature so nobody else can fake a payment. */
async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
  const t = Number(parts.t)
  const sigs = header
    .split(',')
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3))
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`))
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return sigs.some((s) => s.length === hex.length && [...s].every((ch, i) => ch === hex[i]))
}

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>

/** The app ids we put on the payment when it started (client_id or signup_id). */
function ids(o: Obj): { client_id?: string; signup_id?: string } {
  const md = o.metadata ?? {}
  const sub = o.subscription_details?.metadata ?? o.parent?.subscription_details?.metadata ?? {}
  return { client_id: md.client_id ?? sub.client_id, signup_id: md.signup_id ?? sub.signup_id }
}

function subscriptionId(o: Obj): string | null {
  const s = o.subscription ?? o.parent?.subscription_details?.subscription ?? null
  return typeof s === 'string' ? s : (s?.id ?? null)
}

async function findClient(customer: string | null, clientId?: string, signupId?: string) {
  if (clientId) {
    const { data } = await admin.from('clients').select('*').eq('id', clientId).maybeSingle()
    if (data) return data
  }
  if (customer) {
    const { data } = await admin.from('clients').select('*').eq('stripe_customer_id', customer).limit(1).maybeSingle()
    if (data) return data
  }
  // Paid at sign-up and has since been added to the schedule: match by the sign-up's email.
  if (signupId) {
    const { data: s } = await admin.from('signups').select('email, handled').eq('id', signupId).maybeSingle()
    if (s?.handled) {
      const { data } = await admin.from('clients').select('*').ilike('email', s.email).neq('status', 'cancelled').limit(1).maybeSingle()
      if (data) return data
    }
  }
  return null
}

async function handle(event: Obj) {
  const o: Obj = event.data.object
  const customer: string | null = typeof o.customer === 'string' ? o.customer : (o.customer?.id ?? null)
  const { client_id, signup_id } = ids(o)

  switch (event.type) {
    case 'checkout.session.completed':
    case 'invoice.paid': {
      const sub = subscriptionId(o)
      const ends = event.type === 'invoice.paid' ? Math.max(0, ...((o.lines?.data ?? []) as Obj[]).map((l) => l.period?.end ?? 0)) : 0
      const paidThrough = ends ? dateOf(ends - 1) : null
      const client = await findClient(customer, client_id, signup_id)
      if (client) {
        await admin
          .from('clients')
          .update({
            stripe_customer_id: customer ?? client.stripe_customer_id,
            stripe_subscription_id: sub ?? client.stripe_subscription_id,
            ...(event.type === 'invoice.paid'
              ? {
                  status: client.status === 'cancelled' ? 'cancelled' : 'active',
                  payment_issue_since: null,
                  initial_fee_paid: true,
                  ...(paidThrough ? { paid_through: paidThrough } : {}),
                }
              : {}),
          })
          .eq('id', client.id)
      } else if (signup_id || customer) {
        // Not on the schedule yet: keep it on their sign-up; staff carry it over when they add them.
        const q = admin.from('signups').update({
          stripe_customer_id: customer,
          ...(sub ? { stripe_subscription_id: sub } : {}),
          ...(paidThrough ? { paid_through: paidThrough } : {}),
        })
        await (signup_id ? q.eq('id', signup_id) : q.eq('stripe_customer_id', customer!))
      }
      return
    }

    case 'invoice.payment_failed': {
      const client = await findClient(customer, client_id, signup_id)
      if (client && (client.status === 'active' || client.status === 'payment_issue')) {
        await admin
          .from('clients')
          .update({ status: 'payment_issue', payment_issue_since: client.payment_issue_since ?? today() })
          .eq('id', client.id)
      }
      return
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const ending = event.type === 'customer.subscription.deleted'
      const wantsOut = ending || o.cancel_at_period_end === true || !!o.cancel_at
      const client = await findClient(customer, client_id, signup_id)
      if (client && client.stripe_subscription_id && client.stripe_subscription_id !== o.id) return // an old plan
      if (client) {
        await admin
          .from('clients')
          .update({
            cancel_requested_at: wantsOut ? (client.cancel_requested_at ?? new Date().toISOString()) : null,
            ...(ending && client.status !== 'cancelled' ? { status: 'cancelled' } : {}),
          })
          .eq('id', client.id)
      } else {
        await admin
          .from('signups')
          .update({ cancelled_at: wantsOut ? new Date().toISOString() : null })
          .eq('stripe_subscription_id', o.id)
          .eq('handled', false)
      }
      return
    }
  }
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return new Response('not set up', { status: 503 })
  const payload = await req.text()
  if (!(await verify(payload, req.headers.get('Stripe-Signature') ?? '', secret))) {
    return new Response('bad signature', { status: 400 })
  }
  try {
    await handle(JSON.parse(payload))
    return new Response('ok')
  } catch (e) {
    console.error(e)
    return new Response('error', { status: 500 }) // Stripe tries again later
  }
})
