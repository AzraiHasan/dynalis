// composables/useDemoData.ts
import { ref, computed } from 'vue'
import { useServiceBase } from './useServiceBase'
import { useDemoSession } from './useDemoSession'
import type { Site } from '~/types/supabase'

// Sample Malaysian property data for demo
const DEMO_SITES_DATA: Omit<Site, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    site_id: 'KL001',
    exp_date: '2024-12-31',
    total_rental: 2500.00,
    total_payment_to_pay: 2500.00,
    deposit: 500.00,
    lot_no: 'A1-01',
    location: 'Kuala Lumpur City Centre',
    tenant_name: 'Ahmad Restaurant Sdn Bhd',
    contact_no: '+60123456789'
  },
  {
    site_id: 'KL002',
    exp_date: '2025-01-15',
    total_rental: 1800.00,
    total_payment_to_pay: 1800.00,
    deposit: 360.00,
    lot_no: 'B2-05',
    location: 'Bukit Bintang',
    tenant_name: 'Siti Fashion Store',
    contact_no: '+60198765432'
  },
  {
    site_id: 'PJ001',
    exp_date: '2024-11-30',
    total_rental: 1500.00,
    total_payment_to_pay: 1200.00,
    deposit: 300.00,
    lot_no: 'C3-12',
    location: 'Petaling Jaya',
    tenant_name: 'Tech Solutions Sdn Bhd',
    contact_no: '+60176543210'
  },
  {
    site_id: 'SB001',
    exp_date: '2025-03-31',
    total_rental: 3200.00,
    total_payment_to_pay: 3200.00,
    deposit: 640.00,
    lot_no: 'D1-08',
    location: 'Subang Jaya',
    tenant_name: 'Family Mart Convenience',
    contact_no: '+60123987654'
  },
  {
    site_id: 'JB001',
    exp_date: '2024-10-31',
    total_rental: 1200.00,
    total_payment_to_pay: 800.00,
    deposit: 240.00,
    lot_no: 'E4-15',
    location: 'Johor Bahru',
    tenant_name: 'Local Coffee House',
    contact_no: '+60187654321'
  },
  {
    site_id: 'PN001',
    exp_date: '2025-02-28',
    total_rental: 2800.00,
    total_payment_to_pay: 2800.00,
    deposit: 560.00,
    lot_no: 'F2-03',
    location: 'Georgetown, Penang',
    tenant_name: 'Heritage Boutique Hotel',
    contact_no: '+60164567890'
  },
  {
    site_id: 'KL003',
    exp_date: '2025-06-30',
    total_rental: 4500.00,
    total_payment_to_pay: 4500.00,
    deposit: 900.00,
    lot_no: 'G1-01',
    location: 'KLCC',
    tenant_name: 'Premium Electronics Sdn Bhd',
    contact_no: '+60123456780'
  },
  {
    site_id: 'SL001',
    exp_date: '2024-12-15',
    total_rental: 1600.00,
    total_payment_to_pay: 1400.00,
    deposit: 320.00,
    lot_no: 'H3-09',
    location: 'Shah Alam',
    tenant_name: 'Fitness First Gym',
    contact_no: '+60198765433'
  }
]

interface DemoDataState {
  sites: Site[]
  uploadProgress: number
  isProcessing: boolean
  processedRecords: number
  totalRecords: number
}

export const useDemoData = () => {
  const demoSession = useDemoSession()
  const serviceBase = useServiceBase<DemoDataState>('demoData', {
    enableCache: true,
    cacheTimeout: 30 * 60 * 1000, // 30 minutes (entire demo session)
    retries: 0,
    timeout: 5000
  })
  
  const sites = ref<Site[]>([])
  const uploadProgress = ref(0)
  const isProcessing = ref(false)
  const processedRecords = ref(0)
  const totalRecords = ref(0)
  
  // Computed properties
  const hasSites = computed(() => sites.value.length > 0)
  const sitesCount = computed(() => sites.value.length)
  const totalRental = computed(() => 
    sites.value.reduce((sum, site) => sum + (site.total_rental || 0), 0)
  )
  const totalPayments = computed(() => 
    sites.value.reduce((sum, site) => sum + (site.total_payment_to_pay || 0), 0)
  )
  const totalDeposits = computed(() => 
    sites.value.reduce((sum, site) => sum + (site.deposit || 0), 0)
  )
  
  // Initialize demo data
  const initializeDemoData = () => {
    if (!demoSession.isDemoMode()) return
    
    // Check if we already have demo data
    const existingData = getStoredDemoData()
    if (existingData && existingData.length > 0) {
      sites.value = existingData
      return
    }
    
    // Create demo sites with proper IDs and timestamps
    const demoSites: Site[] = DEMO_SITES_DATA.map((site, index) => ({
      ...site,
      id: `demo_site_${index + 1}`,
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }))
    
    sites.value = demoSites
    storeDemoData(demoSites)
    
    console.log('[Demo Data] Initialized with', demoSites.length, 'sites')
  }
  
  // Simulate file upload process
  const simulateUpload = async (fileData: Record<string, string | number>[] = []): Promise<void> => {
    if (!demoSession.isDemoMode()) return
    
    const dataToProcess = fileData.length > 0 ? fileData : generateRandomSiteData(50)
    
    isProcessing.value = true
    uploadProgress.value = 0
    processedRecords.value = 0
    totalRecords.value = dataToProcess.length
    
    // Simulate processing with realistic delays
    for (let i = 0; i < dataToProcess.length; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))
      
      const newSite: Site = {
        id: `demo_uploaded_${Date.now()}_${i}`,
        site_id: dataToProcess[i].site_id || `UP${String(i + 1).padStart(3, '0')}`,
        exp_date: dataToProcess[i].exp_date || '2025-12-31',
        total_rental: dataToProcess[i].total_rental || Math.random() * 3000 + 1000,
        total_payment_to_pay: dataToProcess[i].total_payment_to_pay || Math.random() * 3000 + 1000,
        deposit: dataToProcess[i].deposit || Math.random() * 500 + 100,
        lot_no: dataToProcess[i].lot_no || `LOT-${i + 1}`,
        location: dataToProcess[i].location || 'Demo Location',
        tenant_name: dataToProcess[i].tenant_name || `Tenant ${i + 1}`,
        contact_no: dataToProcess[i].contact_no || '+60123456789',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      sites.value.push(newSite)
      processedRecords.value = i + 1
      uploadProgress.value = Math.round((i + 1) / dataToProcess.length * 100)
    }
    
    // Store updated data
    storeDemoData(sites.value)
    
    isProcessing.value = false
    console.log('[Demo Data] Upload simulation completed:', processedRecords.value, 'records')
  }
  
  // Generate random site data for demo
  const generateRandomSiteData = (count: number) => {
    const locations = ['Kuala Lumpur', 'Petaling Jaya', 'Subang Jaya', 'Shah Alam', 'Johor Bahru', 'Penang']
    const businessTypes = ['Restaurant', 'Retail Store', 'Office', 'Cafe', 'Gym', 'Clinic']
    
    return Array.from({ length: count }, (_, i) => ({
      site_id: `DEMO${String(i + 1).padStart(3, '0')}`,
      exp_date: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_rental: Math.round((Math.random() * 3000 + 1000) * 100) / 100,
      total_payment_to_pay: Math.round((Math.random() * 3000 + 1000) * 100) / 100,
      deposit: Math.round((Math.random() * 500 + 100) * 100) / 100,
      lot_no: `${String.fromCharCode(65 + Math.floor(Math.random() * 5))}${Math.floor(Math.random() * 10) + 1}-${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`,
      location: locations[Math.floor(Math.random() * locations.length)],
      tenant_name: `${businessTypes[Math.floor(Math.random() * businessTypes.length)]} ${i + 1}`,
      contact_no: `+6012${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`
    }))
  }
  
  // Add individual site
  const addSite = (siteData: Omit<Site, 'id' | 'created_at' | 'updated_at'>) => {
    if (!demoSession.isDemoMode()) return
    
    const newSite: Site = {
      ...siteData,
      id: `demo_manual_${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    sites.value.push(newSite)
    storeDemoData(sites.value)
    
    console.log('[Demo Data] Added site:', newSite.site_id)
  }
  
  // Update site
  const updateSite = (siteId: string, updates: Partial<Site>) => {
    if (!demoSession.isDemoMode()) return
    
    const index = sites.value.findIndex(site => site.id === siteId)
    if (index !== -1) {
      sites.value[index] = {
        ...sites.value[index],
        ...updates,
        updated_at: new Date().toISOString()
      }
      storeDemoData(sites.value)
      
      console.log('[Demo Data] Updated site:', siteId)
    }
  }
  
  // Delete site
  const deleteSite = (siteId: string) => {
    if (!demoSession.isDemoMode()) return
    
    const initialCount = sites.value.length
    sites.value = sites.value.filter(site => site.id !== siteId)
    
    if (sites.value.length < initialCount) {
      storeDemoData(sites.value)
      console.log('[Demo Data] Deleted site:', siteId)
    }
  }
  
  // Clear all demo data
  const clearDemoData = () => {
    sites.value = []
    uploadProgress.value = 0
    isProcessing.value = false
    processedRecords.value = 0
    totalRecords.value = 0
    
    if (import.meta.client) {
      sessionStorage.removeItem('demo_sites_data')
    }
    
    console.log('[Demo Data] Cleared all data')
  }
  
  // Storage helpers
  const storeDemoData = (data: Site[]) => {
    if (!import.meta.client) return
    try {
      sessionStorage.setItem('demo_sites_data', JSON.stringify(data))
    } catch (error) {
      console.warn('[Demo Data] Failed to store data:', error)
    }
  }
  
  const getStoredDemoData = (): Site[] => {
    if (!import.meta.client) return []
    try {
      const stored = sessionStorage.getItem('demo_sites_data')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.warn('[Demo Data] Failed to load stored data:', error)
      return []
    }
  }
  
  // Reset demo data to initial state
  const resetToInitialData = () => {
    clearDemoData()
    initializeDemoData()
  }
  
  // Initialize data when composable is created
  if (import.meta.client && demoSession.isDemoMode()) {
    initializeDemoData()
  }
  
  return {
    // State
    sites: readonly(sites),
    uploadProgress: readonly(uploadProgress),
    isProcessing: readonly(isProcessing),
    processedRecords: readonly(processedRecords),
    totalRecords: readonly(totalRecords),
    
    // Computed
    hasSites,
    sitesCount,
    totalRental,
    totalPayments,
    totalDeposits,
    
    // Actions
    initializeDemoData,
    simulateUpload,
    generateRandomSiteData,
    addSite,
    updateSite,
    deleteSite,
    clearDemoData,
    resetToInitialData,
    
    // Service base functionality
    ...serviceBase
  }
}