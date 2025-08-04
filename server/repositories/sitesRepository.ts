// server/repositories/sitesRepository.ts
import { useDbConnection } from '../utils/db'
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
  const { db, status } = useDbConnection()
  
  if (status !== 'connected' || !db) {
    throw new Error('Database connection not available')
  }
  
  return {
    /**
     * Find site by ID
     */
    async findById(id: string): Promise<Site | null> {
      const result = await db.sql`SELECT * FROM sites WHERE id = ${id} LIMIT 1`
      const rows = result?.rows || []
      return rows.length > 0 ? transformSiteRow(rows[0]) : null
    },
    
    /**
     * Find site by site_id (business identifier)
     */
    async findBySiteId(siteId: string): Promise<Site | null> {
      const result = await db.sql`SELECT * FROM sites WHERE site_id = ${siteId} LIMIT 1`
      const rows = result?.rows || []
      return rows.length > 0 ? transformSiteRow(rows[0]) : null
    },
    
    /**
     * Get all sites
     */
    async findAll(): Promise<Site[]> {
      const result = await db.sql`SELECT * FROM sites ORDER BY site_id`
      const rows = result?.rows || []
      return rows.map(row => transformSiteRow(row))
    },
    
    /**
     * Create a new site or update if exists (upsert)
     */
    async upsert(site: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> {
      const now = new Date().toISOString()
      
      // Check if site with this site_id already exists
      const existing = await this.findBySiteId(site.site_id)
      
      if (existing) {
        // Update existing record
        const result = await db.sql`
          UPDATE sites 
          SET 
            exp_date = ${site.exp_date || null},
            total_rental = ${site.total_rental || 0},
            total_payment_to_pay = ${site.total_payment_to_pay || 0},
            deposit = ${site.deposit || 0},
            updated_at = ${now}
          WHERE site_id = ${site.site_id}
          RETURNING *
        `
        const rows = result?.rows || []
        if (rows.length === 0) {
          throw new Error(`Failed to update site with site_id: ${site.site_id}`)
        }
        return transformSiteRow(rows[0])
      } else {
        // Create new record
        const id = crypto.randomUUID()
        const result = await db.sql`
          INSERT INTO sites (
            id, site_id, exp_date, total_rental, 
            total_payment_to_pay, deposit, created_at, updated_at
          ) VALUES (
            ${id}, ${site.site_id}, ${site.exp_date || null}, ${site.total_rental || 0},
            ${site.total_payment_to_pay || 0}, ${site.deposit || 0}, ${now}, ${now}
          )
          RETURNING *
        `
        const rows = result?.rows || []
        if (rows.length === 0) {
          throw new Error(`Failed to insert site with site_id: ${site.site_id}`)
        }
        return transformSiteRow(rows[0])
      }
    },
    
    /**
     * Batch insert multiple sites with transaction support
     */
    async batchUpsert(sites: Omit<Site, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
      let count = 0
      
      // Start a transaction
      await db.sql`BEGIN`
      
      try {
        for (const site of sites) {
          await this.upsert(site)
          count++
        }
        
        // Commit the transaction
        await db.sql`COMMIT`
        return count
      } catch (error) {
        // Roll back on error
        await db.sql`ROLLBACK`
        throw error
      }
    }
  }
}