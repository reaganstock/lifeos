import { createClient } from '@supabase/supabase-js'

// Supabase configuration - using environment variables for security
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables. Please check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// SECURITY NOTE: Service key should NEVER be in client-side code
// It should only be used in server-side edge functions or backend services
// export const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY // Server-side only! 