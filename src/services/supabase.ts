import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = 'https://upkyravehbslbywitar.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwa3lyYXZvZWhic2xieXdpdGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NjI4MDgsImV4cCI6MjA2NDEzODgwOH0.4lVuvAZCWbZ3Uk1aBqlXPY84jctN8CVmi-8KzkAwqd8'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For later use with edge functions
export const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwa3lyYXZvZWhic2xieXdpdGFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODU2MjgwOCwiZXhwIjoyMDY0MTM4ODA4fQ.mnLnSU1u9E6TD1sgzCzx7Q4iinZllnYZo-Y4_IQT_kk' 