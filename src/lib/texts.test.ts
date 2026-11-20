import { describe, expect, it } from 'vitest'
import { doneText, phoneDigits, reminderText, smsLink } from './texts'

describe('texts', () => {
  it('uses the first name and the weekday', () => {
    const t = reminderText({ name: 'Dana Whitfield' }, 2)
    expect(t).toContain('Hi Dana!')
    expect(t).toContain('(Tuesday)')
    expect(t).toContain('trash bin')
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
  it('follows the tiers, flat for any number of dogs', () => {
    expect(cleanupFeeCents('under_2_weeks')).toBe(0)
    expect(cleanupFeeCents('2_4_weeks')).toBe(1500)
    expect(cleanupFeeCents('1_2_months')).toBe(3000)
    expect(cleanupFeeCents('over_2_months')).toBe(5000)
    expect(cleanupFeeCents('')).toBe(0)
  })
})

import { monthlyPriceCents } from './business'
describe('monthly price', () => {
  it('covers 1–3 dogs, then $10 each', () => {
    expect(monthlyPriceCents('weekly', 3)).toBe(6000)
    expect(monthlyPriceCents('weekly', 4)).toBe(7000)
    expect(monthlyPriceCents('weekly', 8)).toBe(11000)
    expect(monthlyPriceCents('weekly', 12)).toBe(11000)
    expect(monthlyPriceCents('biweekly', 12)).toBe(9000)
    expect(monthlyPriceCents('biweekly', 5)).toBe(6000)
  })
})
