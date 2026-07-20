import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The live backend. With keys in .env.local this client backs auth + every
// feature store; without them it's null and the stores fall back to their
// in-memory seeds (UI dev mode). `isSupabaseConfigured` is how the app tells
// which mode it's in — components never branch on it, only the stores do.
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient<Database>(url, anonKey)
  : null
