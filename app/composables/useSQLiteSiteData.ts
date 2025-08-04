// composables/useSQLiteSiteData.ts
import { ref, reactive } from 'vue';
import { useFileUploadStore, type FileDataRow } from '~/stores/fileUploadStore';

interface SiteData {
  id: string;
  site_id: string;
  exp_date: string | null;
  total_rental: number;
  total_payment_to_pay: number;
  deposit: number;
  created_at: string;
  updated_at: string;
}

// Transform uploaded file data to site data structure
function transformFileDataToSiteData(fileData: FileDataRow[]): SiteData[] {
  return fileData.map((row, index) => {
    // Create a consistent ID for each row
    const id = crypto.randomUUID();
    
    return {
      id,
      site_id: row['SITE ID']?.toString() || `UNKNOWN-${index}`,
      exp_date: row['EXP DATE']?.toString() || null,
      total_rental: parseFloat(row['TOTAL RENTAL (RM)']?.toString().replace(/[^0-9.-]+/g, '') || '0'),
      total_payment_to_pay: parseFloat(row['TOTAL PAYMENT TO PAY (RM)']?.toString().replace(/[^0-9.-]+/g, '') || '0'),
      deposit: parseFloat(row['DEPOSIT (RM)']?.toString().replace(/[^0-9.-]+/g, '') || '0'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });
}

export const useSQLiteSiteData = () => {
  const data = ref<SiteData[]>([]);
  const isLoading = ref(false);
  const error = ref<Error | null>(null);
  const initialized = ref(false);
  
  // Get the file upload store
  const fileUploadStore = useFileUploadStore();

  // Fetch data from uploaded file
  const fetchData = async (forceRefresh = false): Promise<SiteData[]> => {
    try {
      // If data is already loaded and no force refresh, return cached data
      if (data.value.length > 0 && !forceRefresh) {
        return data.value;
      }

      isLoading.value = true;
      
      // Get data from the fileUploadStore
      const uploadedData = fileUploadStore.uploadedData.value;
      
      if (uploadedData.fileData.length === 0) {
        console.warn('No uploaded file data available');
        return [];
      }
      
      // Transform the file data to site data structure
      data.value = transformFileDataToSiteData(uploadedData.fileData);
      initialized.value = true;
      
      return data.value;
    } catch (err) {
      console.error('Error processing uploaded data:', err);
      error.value = err instanceof Error ? err : new Error(String(err));
      
      // Return empty array in case of error
      return [];
    } finally {
      isLoading.value = false;
    }
  };

  // Update a site
  const updateSite = async (id: string, siteData: Partial<SiteData>): Promise<SiteData | null> => {
    try {
      isLoading.value = true;
      
      // Find and update the site in the local data
      const index = data.value.findIndex(site => site.id === id);
      if (index !== -1) {
        data.value[index] = { ...data.value[index], ...siteData, updated_at: new Date().toISOString() };
        return data.value[index];
      }
      
      return null;
    } catch (err) {
      console.error('Error updating site:', err);
      error.value = err instanceof Error ? err : new Error(String(err));
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // Create a site
  const createSite = async (siteData: Omit<SiteData, 'id' | 'created_at' | 'updated_at'>): Promise<SiteData | null> => {
    try {
      isLoading.value = true;
      
      const newSite: SiteData = {
        id: crypto.randomUUID(),
        ...siteData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      data.value.push(newSite);
      return newSite;
    } catch (err) {
      console.error('Error creating site:', err);
      error.value = err instanceof Error ? err : new Error(String(err));
      return null;
    } finally {
      isLoading.value = false;
    }
  };

  // Delete a site
  const deleteSite = async (id: string): Promise<boolean> => {
    try {
      isLoading.value = true;
      
      data.value = data.value.filter(site => site.id !== id);
      return true;
    } catch (err) {
      console.error('Error deleting site:', err);
      error.value = err instanceof Error ? err : new Error(String(err));
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    data,
    isLoading,
    error,
    initialized,
    fetchData,
    updateSite,
    createSite,
    deleteSite
  };
};
