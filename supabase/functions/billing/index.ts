// Online payments for customers, through Stripe.
//   action "checkout": start autopay (Stripe Checkout). The monthly plan renews on the same
//                      day each month, starting the day they pay. The one-time cleanup fee
//                      rides on the first payment only.
//   action "portal":   open the Stripe customer portal (update card, receipts).
//   action "cancel":   stop autopay at the end of the paid month.
//   action "keep":     undo "cancel".
//   action "change":   switch weekly / every other week or the number of dogs. Updates the
//                      schedule and the autopay price (new price starts with the next bill).
//
// Secrets (Supabase > Edge Functions > Secrets):
//   STRIPE_SECRET_KEY   from Stripe > Developers > API keys (starts with sk_)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE = 'https://poopscoopinboogie.org/'

// Keep in step with src/lib/business.ts.
const PLAN_BASE_CENTS: Record<string, number> = { weekly: 6000, biweekly: 4000 }
const DOGS_INCLUDED = 3
const DOGS_MAX_PRICED = 8
const EXTRA_DOG_CENTS = 1000
const CLEANUP_FEES: Record<string, number> = { under_2_weeks: 0, '2_4_weeks': 1500, '1_2_months': 3000, over_2_months: 5000 }
const PLAN_NAME: Record<string, string> = { weekly: 'Weekly scoopin’', biweekly: 'Every-other-week scoopin’' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function stripe(path: string, params?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    ...(params ? { body: new URLSearchParams(params) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? 'Stripe error')
  return data
}

const money = (cents: number) => '$' + (cents / 100).toFixed(cents % 100 ? 2 : 0)

function monthlyCents(plan: string, dogs: number) {
  return PLAN_BASE_CENTS[plan] + Math.max(0, Math.min(dogs, DOGS_MAX_PRICED) - DOGS_INCLUDED) * EXTRA_DOG_CENTS
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Next date (YYYY-MM-DD, Tyler time) that falls on this weekday, today included. */
function nextDate(weekday: number) {
  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) + 'T12:00:00Z')
  const add = (weekday - today.getUTCDay() + 7) % 7
  return new Date(today.getTime() + add * 86_400_000).toISOString().slice(0, 10)
}

function safeReturn(url: unknown) {
  return typeof url === 'string' && url.startsWith('https://') ? url : SITE
}

type Billable = {
  kind: 'client' | 'signup'
  // deno-lint-ignore no-explicit-any
  row: any
  id: string
  name: string
  email: string
  phone: string
  plan: string
  monthly: number
  fee: number
  customer: string | null
  subscription: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const hasStripe = !!Deno.env.get('STRIPE_SECRET_KEY')

  const body = await req.json().catch(() => ({}))
  const action: string = body.action ?? 'portal'
  if (!hasStripe && action !== 'change') return json({ error: 'not_set_up' }, 503)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })

  // Find who is paying. Right after sign-up they may not be logged in yet (email not
  // confirmed), so the sign-up page passes the id of the sign-up it just saved.
  let who: Billable | null = null
  if (typeof body.signup_id === 'string' && action === 'checkout') {
    const { data: s } = await admin
      .from('signups')
      .select('*')
      .eq('id', body.signup_id)
      .eq('handled', false)
      .is('cancelled_at', null)
      .gte('created_at', new Date(Date.now() - 2 * 86_400_000).toISOString())
      .maybeSingle()
    if (s) who = fromSignup(s)
  } else {
    const { data: c } = await asUser.from('clients').select('*').limit(1).maybeSingle()
    if (c) {
      who = {
        kind: 'client',
        row: c,
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        plan: c.plan,
        monthly: c.price_cents,
        fee: c.initial_fee_paid ? 0 : (c.initial_fee_cents ?? 0),
        customer: c.stripe_customer_id,
        subscription: c.stripe_subscription_id ?? null,
      }
    } else {
      const { data: s } = await asUser
        .from('signups')
        .select('*')
        .eq('handled', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (s) who = fromSignup(s)
    }
  }
  if (!who) return json({ error: 'no_account' }, 404)
  if (who.plan === 'one_time') return json({ error: 'one_time' }, 400)

  try {
    if (action === 'checkout') {
      if (who.subscription) return json({ error: 'already_paying' }, 409)
      const params: Record<string, string> = {
        mode: 'subscription',
        success_url: SITE + '#/account?paid=1',
        cancel_url: safeReturn(body.return_url),
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(who.monthly),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][price_data][product_data][name]': PLAN_NAME[who.plan] ?? 'Poop scoopin’',
        [`metadata[${who.kind}_id]`]: who.id,
        [`subscription_data[metadata][${who.kind}_id]`]: who.id,
      }
      if (who.customer) params.customer = who.customer
      else params.customer_email = who.email
      if (who.fee > 0) {
        params['line_items[1][quantity]'] = '1'
        params['line_items[1][price_data][currency]'] = 'usd'
        params['line_items[1][price_data][unit_amount]'] = String(who.fee)
        params['line_items[1][price_data][product_data][name]'] = 'One-time yard cleanup (first bill only)'
      }
      const session = await stripe('checkout/sessions', params)
      return json({ url: session.url })
    }

    if (action === 'portal') {
      if (!who.customer) return json({ error: 'no_payment' }, 404)
      const session = await stripe('billing_portal/sessions', { customer: who.customer, return_url: safeReturn(body.return_url) })
      return json({ url: session.url })
    }

    if (action === 'cancel' || action === 'keep') {
      if (who.subscription) {
        await stripe(`subscriptions/${who.subscription}`, { cancel_at_period_end: action === 'cancel' ? 'true' : 'false' })
      }
      return json({ ok: true })
    }

    if (action === 'change') {
      const plan = body.plan
      const dogs = Math.round(Number(body.dog_count))
      if ((plan !== 'weekly' && plan !== 'biweekly') || !(dogs >= 1 && dogs <= 20)) return json({ error: 'bad_change' }, 400)
      const monthly = monthlyCents(plan, dogs)

      // Autopay first, so the schedule never changes without the price changing too.
      // The new price starts with the next bill (no partial-month charges or refunds).
      if (who.subscription) {
        if (!hasStripe) return json({ error: 'not_set_up' }, 503)
        const current = await stripe(`subscriptions/${who.subscription}`)
        const item = current.items?.data?.[0]
        if (!item) throw new Error('no subscription item')
        const product = await stripe('products', { name: PLAN_NAME[plan] })
        await stripe(`subscriptions/${who.subscription}`, {
          'items[0][id]': item.id,
          'items[0][price_data][currency]': 'usd',
          'items[0][price_data][product]': product.id,
          'items[0][price_data][unit_amount]': String(monthly),
          'items[0][price_data][recurring][interval]': 'month',
          proration_behavior: 'none',
        })
      }

      const label = (p: string) => (p === 'weekly' ? 'Weekly' : 'Every other week')
      if (who.kind === 'client') {
        const c = who.row
        const startsBiweekly = plan === 'biweekly' && !(c.plan === 'biweekly' && c.biweekly_anchor)
        await admin
          .from('clients')
          .update({
            plan,
            price_cents: monthly,
            biweekly_anchor: plan === 'biweekly' ? (startsBiweekly ? nextDate(c.service_day) : c.biweekly_anchor) : null,
          })
          .eq('id', c.id)
        const dogText = `${dogs} dog${dogs === 1 ? '' : 's'}`
        const start = startsBiweekly ? ` Every other ${DAY_NAMES[c.service_day]}, starting ${nextDate(c.service_day)}.` : ''
        await admin.from('client_notes').insert({
          client_id: c.id,
          created_by: null,
          body: `Changed their plan on the website: ${label(c.plan)} to ${label(plan)}, ${dogText}, ${money(monthly)}/month (was ${money(c.price_cents)}). New price starts with their next bill.${start}`,
        })
      } else {
        await admin.from('signups').update({ plan, dog_count: dogs }).eq('id', who.id)
      }
      return json({ ok: true, monthly })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'stripe_failed' }, 502)
  }
})

// deno-lint-ignore no-explicit-any
function fromSignup(s: any): Billable {
  return {
    kind: 'signup',
    row: s,
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    plan: s.plan,
    // Worked out here from the plan, never from a price the browser sent.
    monthly: s.plan in PLAN_BASE_CENTS ? monthlyCents(s.plan, s.dog_count) : 0,
    fee: CLEANUP_FEES[s.last_cleaned] ?? 0,
    customer: s.stripe_customer_id ?? null,
    subscription: s.stripe_subscription_id ?? null,
  }
}
