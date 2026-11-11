import { createClient } from '@supabase/supabase-js'

// Forgive common copy-paste slips: spaces, and the "/rest/v1/" ending Supabase shows on some pages.
const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '')
const key = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim()

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'https://example.supabase.co', key || 'missing-key', {
  // Look up fetch on every call so the demo build can stand in for the real database.
  global: { fetch: (...args: Parameters<typeof fetch>) => fetch(...args) },
})

export const PHOTO_BUCKET = 'visit-photos'
