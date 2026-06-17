import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The app currently runs on the local in-memory store (see useActivityStore).
// Once you add your Supabase keys to .env.local, this client is ready to back
// the store with real data + auth. `isSupabaseConfigured` lets the app detect
// whether keys are present so we can switch over gracefully.
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient<Database>(url, anonKey)
  : null
