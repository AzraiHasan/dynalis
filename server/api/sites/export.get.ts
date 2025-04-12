// server/api/sites/export.get.ts
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    await requireUserSession(event)
    
    // Use server-side Supabase client which handles token management
    const supabase = await serverSupabaseClient(event)
    
    // Fetch site data
    const { data, error } = await supabase
      .from('sites')
      .select('*')
    
    if (error) throw error
    
    console.log(`Exported ${data?.length || 0} sites from Supabase`)
    return data || []
  } catch (error) {
    console.error('Error in sites export:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Export operation failed'
    })
  }
})