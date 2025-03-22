export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      site_data: {
        Row: {
          id: string
          site_id: string | null
          exp_date: string | null
          total_rental: number
          total_payment: number
          deposit: number
          upload_batch_id: string
          uploaded_at: string
          last_updated: string
          file_name: string
          raw_data: Json
          column_headers: string[]
        }
        Insert: {
          id?: string
          site_id?: string | null
          exp_date?: string | null
          total_rental?: number
          total_payment?: number
          deposit?: number
          upload_batch_id: string
          uploaded_at?: string
          last_updated?: string
          file_name: string
          raw_data: Json
          column_headers: string[]
        }
        Update: {
          id?: string
          site_id?: string | null
          exp_date?: string | null
          total_rental?: number
          total_payment?: number
          deposit?: number
          upload_batch_id?: string
          uploaded_at?: string
          last_updated?: string
          file_name?: string
          raw_data?: Json
          column_headers?: string[]
        }
      }
    }
  }
}