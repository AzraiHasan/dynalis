// server/repositories/sitesRepository.ts
import { useSupabaseServer } from '../utils/supabase'
import type { Site } from '~/types/dbsql'

// Helper function to transform database rows to typed objects
const transformSiteRow = (row: Record<string, any>): Site => {
  return {
    id: String(row.id),
    site_id: String(row.site_id),
    exp_date: row.exp_date || null,
    total_rental: Number(row.total_rental || 0),
    total_payment_to_pay: Number(row.total_payment_to_pay || 0),
    deposit: Number(row.deposit || 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  }
}

export const useSitesRepository = () => {
  const supabase = useSupabaseServer()
  
  return {
    /**
     * Find site by ID
     */
    async findById(id: string): Promise<Site | null> {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw error
      }
      
      return data ? transformSiteRow(data) : null
    },
    
    /**
     * Find site by site_id (business identifier)
     */
    async findBySiteId(siteId: string): Promise<Site | null> {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('site_id', siteId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw error
      }
      
      return data ? transformSiteRow(data) : null
    },
    
    /**
     * Get all sites
     */
    async findAll(): Promise<Site[]> {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('site_id')
      
      if (error) throw error
      
      return data ? data.map(row => transformSiteRow(row)) : []
    },
    
    /**
     * Create a new site or update if exists (upsert)
     */
    async upsert(site: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> {
      const siteData = {
        id: crypto.randomUUID(),
        site_id: site.site_id,
        exp_date: site.exp_date || null,
        total_rental: site.total_rental || 0,
        total_payment_to_pay: site.total_payment_to_pay || 0,
        deposit: site.deposit || 0,
      }

      const { data, error } = await supabase
        .from('sites')
        .upsert(siteData, { 
          onConflict: 'site_id',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error(`Failed to upsert site with site_id: ${site.site_id}`)

      return transformSiteRow(data)
    },
    
    /**
     * Batch insert multiple sites with transaction support
     */
    async batchUpsert(sites: Omit<Site, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
      const sitesData = sites.map(site => ({
        id: crypto.randomUUID(),
        site_id: site.site_id,
        exp_date: site.exp_date || null,
        total_rental: site.total_rental || 0,
        total_payment_to_pay: site.total_payment_to_pay || 0,
        deposit: site.deposit || 0,
      }))

      const { data, error } = await supabase
        .from('sites')
        .upsert(sitesData, { 
          onConflict: 'site_id',
          ignoreDuplicates: false 
        })
        .select()

      if (error) throw error
      
      return data ? data.length : 0
    }
  }
}