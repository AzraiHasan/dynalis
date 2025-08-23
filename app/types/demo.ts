// Simple demo types without Supabase dependencies
export interface DemoSite {
  id: string
  site_id: string
  exp_date: string
  total_rental: number
  total_payment_to_pay: number
  deposit: number
  lot_no: string
  location: string
  tenant_name: string
  contact_no: string
  created_at: string
  updated_at: string
}

export interface DemoUser {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  created_at: string
}

export interface DemoSessionState {
  isActive: boolean
  sessionId: string | null
  startTime: number
  demoUser: DemoUser | null
  remainingTime: number
  showWarning: boolean
}

export interface DemoDataState {
  sites: DemoSite[]
  uploadProgress: number
  isProcessing: boolean
  processedRecords: number
  totalRecords: number
}