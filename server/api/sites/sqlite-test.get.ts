// server/api/sites/sqlite-test.get.ts
import { useSitesRepository } from '../../repositories/sitesRepository'

export default defineEventHandler(async (event) => {
  const sitesRepo = useSitesRepository()
  
  // Test querying sites
  const sites = await sitesRepo.findAll()
  
  return {
    count: sites.length,
    sites: sites.slice(0, 5) // Return just first 5 for testing
  }
})