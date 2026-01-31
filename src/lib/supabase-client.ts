import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Ensure required env vars exist early so failures are loud and easy to diagnose.
if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable')
  throw new Error(
    'Missing VITE_SUPABASE_URL environment variable. Please check your .env file or Vercel environment variables.'
  )
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY environment variable')
  throw new Error(
    'Missing VITE_SUPABASE_ANON_KEY environment variable. Please check your .env file or Vercel environment variables.'
  )
}

// Single Supabase client instance to avoid Multiple GoTrueClient warnings.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    // Fixed but unique storage key to avoid conflicts with old versions.
    storageKey: 'tumuai-auth-v2-stable',
    debug: false,
    flowType: 'pkce'
  }
})

