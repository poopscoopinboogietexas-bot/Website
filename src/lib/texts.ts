import { TEXTS } from './business'
import { DAYS, type Client } from './types'

const firstName = (name: string) => {
  const n = name.trim().replace(/^the\s+/i, '')
  return /family$/i.test(n) ? n : n.split(/\s+/)[0] || 'there'
}

const fill = (template: string, client: Pick<Client, 'name'>, day = '') =>
  template.replaceAll('{first}', firstName(client.name)).replaceAll('{day}', day)

export function reminderText(client: Pick<Client, 'name'>, weekday: number): string {
  return fill(TEXTS.reminder, client, DAYS[weekday])
}

export function welcomeText(client: Pick<Client, 'name'>, weekday: number): string {
  return fill(TEXTS.welcome, client, DAYS[weekday])
}

export function welcomeEmailLink(client: Pick<Client, 'name' | 'email'>, weekday: number): string {
  const subject = `Welcome to Poop Scoopin' Boogie: your service day is ${DAYS[weekday]}`
  return `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(welcomeText(client, weekday))}`
}

export function mowText(client: Pick<Client, 'name'>): string {
  return fill(TEXTS.mow, client)
}

export function doneText(client: Pick<Client, 'name'>): string {
  return fill(TEXTS.done, client)
}

/** Digits of a US phone number, or '' if it doesn't look like one. */
export function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return d
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  return ''
}

/** Link that opens the phone's texting app with the message filled in. `?&body=` works on both iPhone and Android. */
export function smsLink(phone: string, body: string): string {
  return `sms:+1${phoneDigits(phone)}?&body=${encodeURIComponent(body)}`
}

export const wantsReminder = (c: Pick<Client, 'reminder_texts'>) => c.reminder_texts !== false
export const wantsDoneText = (c: Pick<Client, 'done_texts'>) => c.done_texts !== false

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** First visit still owes the one-time cleanup fee. */
export const cleanupPending = (c: Pick<Client, 'initial_fee_cents' | 'initial_fee_paid'>) =>
  (c.initial_fee_cents ?? 0) > 0 && c.initial_fee_paid !== true

export function cleanupPriceText(client: Pick<Client, 'name'>, oldCents: number, newCents: number): string {
  const first = client.name.trim().replace(/^the\s+/i, '').split(/\s+/)[0] || 'there'
  const dollars = (c: number) => `$${Math.round(c / 100)}`
  return `Hi ${first}! It's Poop Scoopin' Boogie at your yard. It needs more cleanup than we expected, so the one-time cleanup fee would be ${dollars(newCents)} instead of ${dollars(oldCents)}. Photo attached. Reply YES to approve and we'll get started!`
}
