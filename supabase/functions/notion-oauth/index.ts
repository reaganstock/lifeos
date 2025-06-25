// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("Hello from Functions!")

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()

    switch (action) {
      case 'exchange_token':
        return await exchangeOAuthToken(params)
      case 'api_call':
        return await makeNotionAPICall(params)
      default:
        throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function exchangeOAuthToken({ code, clientId, clientSecret, redirectUri }: any) {
  console.log('🔗 Exchanging Notion OAuth code for token...')
  
  const encoded = btoa(`${clientId}:${clientSecret}`)
  
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Basic ${encoded}`,
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  })

  const data = await response.json()
  
  if (!response.ok) {
    console.error('❌ Notion OAuth error:', data)
    throw new Error(`OAuth exchange failed: ${data.error_description || data.error}`)
  }

  console.log('✅ OAuth token exchange successful')
  
  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function makeNotionAPICall({ endpoint, method = 'GET', body, accessToken }: any) {
  console.log(`🔗 Making Notion API call: ${method} ${endpoint}`)
  
  const url = `https://api.notion.com/v1${endpoint}`
  
  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28'
    }
  }
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  const data = await response.json()
  
  if (!response.ok) {
    console.error(`❌ Notion API error for ${endpoint}:`, data)
    throw new Error(`API call failed: ${data.message || data.error}`)
  }
  
  console.log(`✅ Notion API call successful: ${method} ${endpoint}`)

  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/notion-oauth' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
