import { computed } from 'vue'

export const useDemoMode = () => {
  const isDemoMode = computed(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('dynalis-demo-mode') === 'true'
  })

  const saveToDemoStorage = (key: string, data: unknown) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`dynalis-demo-${key}`, JSON.stringify(data))
  }

  const getFromDemoStorage = (key: string) => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem(`dynalis-demo-${key}`)
    return stored ? JSON.parse(stored) : null
  }

  const loadSampleData = () => {
    // Sample demo data that matches the expected FileRow format
    const sampleSites = [
      {
        "SITE ID": "DEMO001",
        "EXP DATE": "2024-12-31",
        "TOTAL RENTAL (RM)": "2500",
        "TOTAL PAYMENT TO PAY (RM)": "1500",
        "DEPOSIT (RM)": "5000"
      },
      {
        "SITE ID": "DEMO002",
        "EXP DATE": "2024-11-15",
        "TOTAL RENTAL (RM)": "3200",
        "TOTAL PAYMENT TO PAY (RM)": "800",
        "DEPOSIT (RM)": "6400"
      },
      {
        "SITE ID": "DEMO003",
        "EXP DATE": "2025-03-20",
        "TOTAL RENTAL (RM)": "1800",
        "TOTAL PAYMENT TO PAY (RM)": "2200",
        "DEPOSIT (RM)": "3600"
      },
      {
        "SITE ID": "DEMO004",
        "EXP DATE": "2024-10-05",
        "TOTAL RENTAL (RM)": "4100",
        "TOTAL PAYMENT TO PAY (RM)": "3500",
        "DEPOSIT (RM)": "8200"
      },
      {
        "SITE ID": "DEMO005",
        "EXP DATE": "2025-01-30",
        "TOTAL RENTAL (RM)": "2900",
        "TOTAL PAYMENT TO PAY (RM)": "1200",
        "DEPOSIT (RM)": "5800"
      }
    ]
    
    saveToDemoStorage('sites', sampleSites)
    
    const sampleJob = {
      id: crypto.randomUUID(),
      filename: 'demo-sample-data.xlsx',
      status: 'complete',
      processed_records: sampleSites.length,
      created_at: new Date().toISOString()
    }
    saveToDemoStorage('jobs', [sampleJob])
    
    return sampleSites
  }

  const simulateApiCall = async (operation: string, data?: Record<string, unknown>) => {
    // Simulate realistic API timing
    const delay = Math.random() * 1000 + 500 // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay))

    switch (operation) {
      case 'batch-upload': {
        const sites = data?.sites
        saveToDemoStorage('sites', sites)
        return {
          success: true,
          count: Array.isArray(sites) ? sites.length : 0,
          message: `Processed ${Array.isArray(sites) ? sites.length : 0} site records successfully`
        }
      }
      
      case 'get-sites':
        return {
          sites: getFromDemoStorage('sites') || [],
          total: getFromDemoStorage('sites')?.length || 0
        }
      
      case 'create-job': {
        const job = {
          id: crypto.randomUUID(),
          filename: data?.filename,
          status: 'complete',
          processed_records: data?.recordCount,
          created_at: new Date().toISOString()
        }
        saveToDemoStorage('jobs', [job])
        return job
      }
      
      default:
        return { success: true }
    }
  }

  const clearDemoData = () => {
    if (typeof window === 'undefined') return
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('dynalis-demo-')
    )
    keys.forEach(key => localStorage.removeItem(key))
  }

  return {
    isDemoMode,
    saveToDemoStorage,
    getFromDemoStorage,
    simulateApiCall,
    clearDemoData,
    loadSampleData
  }
}