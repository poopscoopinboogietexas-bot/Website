import { TEXTS } from './business'
import { DAYS, type Client } from './types'

const firstName = (name: string) => {
  const n = name.trim().replace(/^the\s+/i, '')
  return /family$/i.test(n) ? n : n.split(/\s+/)[0] || 'there'
}

const fill = (template: string, client: Pick<Client, 'name'>, day = '') =>
  template.replaceAll('{first}', firstName(client.name)).replaceAll('{day}', day)

export function reminderText(client: Pick<Client, 'name' | 'bag_disposal'>, weekday: number): string {
  return fill(client.bag_disposal === 'take_away' ? TEXTS.reminderTakeAway : TEXTS.reminder, client, DAYS[weekday])
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
