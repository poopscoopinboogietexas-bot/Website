import { describe, expect, it } from 'vitest'
import { doneText, phoneDigits, reminderText, smsLink } from './texts'

describe('texts', () => {
  it('uses the first name and the weekday', () => {
    const t = reminderText({ name: 'Dana Whitfield', bag_disposal: 'client_bin' }, 2)
    expect(t).toContain('Hi Dana!')
    expect(t).toContain('(Tuesday)')
    expect(t).toContain('trash bin')
  })
  it('skips the trash bin line when we take the bags', () => {
    expect(reminderText({ name: 'Marcus Lee', bag_disposal: 'take_away' }, 1)).not.toContain('trash')
  })
  it('keeps family names whole', () => {
    expect(doneText({ name: 'The Ramirez Family' })).toContain('Hi Ramirez Family!')
  })
  it('builds sms links from messy numbers', () => {
    expect(phoneDigits('(903) 555-0142')).toBe('9035550142')
    expect(phoneDigits('+1 903 555 0142')).toBe('9035550142')
    expect(phoneDigits('555-0142')).toBe('')
    expect(smsLink('(903) 555-0142', 'Hi & bye')).toBe('sms:+19035550142?&body=Hi%20%26%20bye')
  })
})

import { cleanupFeeCents } from './business'
describe('cleanup fee', () => {
  it('follows the tiers, flat for 1–2 dogs', () => {
    expect(cleanupFeeCents('under_2_weeks', 4)).toBe(0)
    expect(cleanupFeeCents('2_4_weeks', 1)).toBe(1500)
    expect(cleanupFeeCents('1_2_months', 2)).toBe(3000)
    expect(cleanupFeeCents('over_2_months', 4)).toBe(7000)
    expect(cleanupFeeCents('', 3)).toBe(0)
  })
})
