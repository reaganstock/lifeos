import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables. Please check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.')
}

// Only log in development
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase config:', { 
    url: supabaseUrl, 
    key: supabaseAnonKey ? 'Present' : 'Missing'
  })
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'lifeOS-AI',
    },
  },
})

// Export the URL for use in environment setup
export { supabaseUrl } 