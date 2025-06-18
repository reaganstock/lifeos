import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = 'https://upkyravoehbslbywitar.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwa3lyYXZvZWhic2xieXdpdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjI4MDgsImV4cCI6MjA2NDEzODgwOH0.4lVuvAZCWbZ3Uk1aBqlXPY84jctN8CVmi-8KzkAwqd8'

console.log('Supabase config:', { 
  url: supabaseUrl, 
  key: supabaseAnonKey ? 'Present' : 'Missing',
  keyStart: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'N/A'
})

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