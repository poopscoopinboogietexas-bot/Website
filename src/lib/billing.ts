import { DOGS_INCLUDED, DOGS_MAX_PRICED, EXTRA_DOG_CENTS, PLAN_BASE_CENTS } from './business'
import { supabase } from './supabase'

/** Best guess at the dog count a monthly price was set for (staff can set any price). */
export function dogsFromPrice(plan: 'weekly' | 'biweekly', cents: number): number {
  const extra = Math.round((cents - PLAN_BASE_CENTS[plan]) / EXTRA_DOG_CENTS)
  return extra > 0 ? Math.min(DOGS_INCLUDED + extra, DOGS_MAX_PRICED) : 1
}

/** 2026-11-30 -> November 30 */
export const niceDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

const NOT_READY = 'Online payments aren’t switched on yet. We’ll text you a payment link.'

/**
 * Sends the customer to Stripe: "checkout" starts autopay, "portal" is where they update their card
 * and see receipts. Returns a message to show if it couldn't open, or '' when it is leaving the page.
 */
export async function openBilling(action: 'checkout' | 'portal', signupId?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('billing', {
    body: { action, ...(signupId ? { signup_id: signupId } : {}), return_url: window.location.href.split('#')[0] + '#/account' },
  })
  if (!error && data?.url) {
    window.location.href = data.url
    return ''
  }
  return NOT_READY
}

/** Stops (or restarts) autopay at the end of the paid month. True when it worked or there is no autopay. */
export async function setAutopayCancelled(cancel: boolean): Promise<boolean> {
  const { error } = await supabase.functions.invoke('billing', { body: { action: cancel ? 'cancel' : 'keep' } })
  return !error
}
