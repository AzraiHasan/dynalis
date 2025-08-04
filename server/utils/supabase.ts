// server/utils/supabase.ts
import { createClient } from '@supabase/supabase-js'

export function useSupabaseServer() {
  const supabaseUrl = useRuntimeConfig().public.supabase.url
  const supabaseServiceKey = useRuntimeConfig().supabase.serviceKey

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export function useSupabaseServerClient(event: any) {
  const supabaseUrl = useRuntimeConfig().public.supabase.url
  const supabaseAnonKey = useRuntimeConfig().public.supabase.anonKey

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration')
  }

  const client = createClient(supabaseUrl, supabaseAnonKey)

  // Get auth token from request headers if available
  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    client.auth.setSession({
      access_token: token,
      refresh_token: '',
      expires_in: 3600,
      token_type: 'bearer',
      user: null
    })
  }

  return client
}