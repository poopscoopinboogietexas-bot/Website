export type ClientStatus = 'active' | 'payment_issue' | 'paused' | 'cancelled'
export type Temperament = 'friendly' | 'shy' | 'jumpy' | 'keep_out'

export interface Dog {
  id: string
  client_id: string
  name: string
  breed: string
  temperament: Temperament
  notes: string
}

export interface Client {
  id: string
  name: string
  phone: string
  email: string
  address: string
  gate_code: string
  access_notes: string
  bag_disposal: 'client_bin' | 'take_away'
  instructions: string
  plan: 'weekly' | 'biweekly'
  service_day: number
  biweekly_anchor: string | null
  price_cents: number
  status: ClientStatus
  payment_issue_since: string | null
  paid_through: string | null
  route_order: number
  /** Text the day before. Missing until migration 0003 runs; treat missing as on. */
  /** One-time cleanup fee for the first bill. Missing until migration 0004 runs. */
  initial_fee_cents?: number
  initial_fee_paid?: boolean
  /** Weekdays that don't work for them (0 = Sunday). Missing until migration 0006 runs. */
  blocked_days?: number[]
  /** Where bags go if the trash bin can't be reached. Missing until migration 0005 runs. */
  bag_backup?: string
  reminder_texts?: boolean
  /** Text "service done" after each visit. Missing until migration 0003 runs; treat missing as on. */
  done_texts?: boolean
  dogs?: Dog[]
}

export interface Visit {
  id: string
  client_id: string
  visit_date: string
  status: 'in_progress' | 'complete'
  checklist: Record<string, boolean>
  yard_photo_path: string | null
  gate_photo_path: string | null
  notes: string
  completed_at: string | null
  emailed_at: string | null
  email_error: string | null
}

export interface Signup {
  id: string
  name: string
  phone: string
  email: string
  address: string
  dog_count: number
  plan: 'weekly' | 'biweekly' | 'one_time'
  notes: string
  /** Missing until migration 0004 runs. */
  last_cleaned?: string
  bag_backup?: string
  blocked_days?: number[]
  initial_fee_cents?: number
  created_at: string
}

export interface ClientNote {
  id: string
  client_id: string
  body: string
  created_at: string
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const STATUS_LABEL: Record<ClientStatus, string> = {
  active: 'Active',
  payment_issue: 'Payment issue',
  paused: 'Paused',
  cancelled: 'Cancelled',
}

export const TEMPERAMENT_LABEL: Record<Temperament, string> = {
  friendly: 'Friendly',
  shy: 'Shy',
  jumpy: 'Jumps',
  keep_out: 'Stay out if loose',
}
