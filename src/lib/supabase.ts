import { createClient } from '@supabase/supabase-js'

// The live database. Both values are public by design: every visitor's browser receives them,
// and the database rules (row level security) are what keep data private.
// GitHub repository variables SUPABASE_URL / SUPABASE_ANON_KEY override these if set.
const LIVE_URL = 'https://nyyjzuruohumoscrtksm.supabase.co'
const LIVE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eWp6dXJ1b2h1bW9zY3J0a3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNzUwMTcsImV4cCI6MjEwOTk1MTAxN30.nqhOD8hERq0rG3cqrHzNnjk-s9-siHbolP_suX9o6XE'

// Forgive common copy-paste slips: spaces, and the "/rest/v1/" ending Supabase shows on some pages.
const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || LIVE_URL)
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '')
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || LIVE_ANON_KEY

export const isConfigured = Boolean(url && key)

export const supabase = createClient(url || 'https://example.supabase.co', key || 'missing-key', {
  // Look up fetch on every call so the demo build can stand in for the real database.
  global: { fetch: (...args: Parameters<typeof fetch>) => fetch(...args) },
})

export const PHOTO_BUCKET = 'visit-photos'
