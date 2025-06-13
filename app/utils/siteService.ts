// utils/siteService.ts
import { useSQLiteSiteData } from '../composables/useSQLiteSiteData';

// This is a dedicated site service that uses SQLite as backend
export const useSiteService = () => {
  // Use the SQLite implementation internally
  const sqliteSiteData = useSQLiteSiteData();

  return {
    fetchData: async (forceRefresh = false) => {
      return await sqliteSiteData.fetchData(forceRefresh);
    },
    
    updateSite: async (id: string, data: any) => {
      return await sqliteSiteData.updateSite(id, data);
    },
    
    createSite: async (data: any) => {
      return await sqliteSiteData.createSite(data);
    },
    
    deleteSite: async (id: string) => {
      return await sqliteSiteData.deleteSite(id);
    }
  };
};
