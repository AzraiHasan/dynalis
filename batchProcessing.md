# Large File Upload Implementation Strategy

## Current Limitations

The current implementation has significant bottlenecks that prevent handling files with 1000+ rows:

1. **In-memory processing** of entire files
2. **localStorage bottleneck** (5-10MB limit)
3. **Sequential database operations** (one query per record)
4. **No streaming capabilities** for large files

## Implementation Goals

| Component | Goal |
|-----------|------|
| Server-side Processing | Move file parsing and data transformation to the server to avoid client-side memory limitations |
| Chunked Uploads | Enable uploading large files in smaller pieces to avoid browser memory constraints |
| Batch Database Operations | Replace individual record inserts with efficient batch operations |
| Progress Tracking | Provide real-time feedback during long-running uploads |
| Error Recovery | Allow resuming failed uploads without starting over |

## 1. Server-Side Processing

### Create a Supabase Edge Function

**Goal:** Handle file parsing on the server where more memory and processing power is available.

```typescript
// supabase/functions/process-upload/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { parse as parseCSV } from 'https://deno.land/std@0.177.0/encoding/csv.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Get form data and extract upload information
    const formData = await req.formData()
    const file = formData.get('file') as File
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const uploadId = formData.get('uploadId') as string
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Store chunk in temporary storage
    await supabase.storage
      .from('temp-uploads')
      .upload(`${uploadId}/chunk-${chunkIndex}`, file)
    
    // Update upload progress
    await supabase
      .from('upload_jobs')
      .update({ 
        chunks_received: chunkIndex + 1,
        status: chunkIndex + 1 === totalChunks ? 'processing' : 'uploading',
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadId)
    
    // If this is the last chunk, start processing
    if (chunkIndex + 1 === totalChunks) {
      // Schedule processing (async)
      processFinalUpload(uploadId, supabase)
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        uploadId, 
        chunksReceived: chunkIndex + 1,
        totalChunks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Process the complete upload (runs asynchronously)
async function processFinalUpload(uploadId, supabase) {
  try {
    // Update status
    await supabase
      .from('upload_jobs')
      .update({ status: 'processing' })
      .eq('id', uploadId)
    
    // Combine chunks and process
    // ... (implementation details)
    
    // Call database function for batch processing
    const { data, error } = await supabase
      .rpc('bulk_upload_sites', { data: processedData })
    
    if (error) throw error
    
    // Update job status to complete
    await supabase
      .from('upload_jobs')
      .update({ 
        status: 'complete',
        processed_records: data.length,
        completed_at: new Date().toISOString()
      })
      .eq('id', uploadId)
      
    // Clean up temp storage
    await supabase.storage
      .from('temp-uploads')
      .remove([`${uploadId}`])
      
  } catch (error) {
    console.error('Processing error:', error)
    
    // Update job status to error
    await supabase
      .from('upload_jobs')
      .update({ 
        status: 'error',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', uploadId)
  }
}
```

### Create Database Migration for Upload Jobs Tracking

**Goal:** Store upload progress information for tracking and resumability.

```sql
-- migrations/[timestamp]_create_upload_tracking.sql
CREATE TABLE public.upload_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  total_chunks INTEGER NOT NULL,
  chunks_received INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add policies
ALTER TABLE public.upload_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own upload jobs"
  ON public.upload_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own upload jobs"
  ON public.upload_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### Implement Efficient Batch Processing

**Goal:** Process thousands of records efficiently without individual queries.

```sql
-- migrations/[timestamp]_add_bulk_upload_function.sql
CREATE OR REPLACE FUNCTION bulk_upload_sites(data JSONB)
RETURNS SETOF sites AS $$
BEGIN
  -- Create temp table with same structure
  CREATE TEMP TABLE temp_sites (LIKE sites EXCLUDING CONSTRAINTS);
  
  -- Insert from JSON
  INSERT INTO temp_sites (
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, created_at, updated_at
  )
  SELECT 
    (d->>'site_id')::TEXT,
    (d->>'exp_date')::DATE,
    (d->>'total_rental')::DECIMAL,
    (d->>'total_payment_to_pay')::DECIMAL,
    (d->>'deposit')::DECIMAL,
    NOW(),
    NOW()
  FROM jsonb_array_elements(data) AS d;
  
  -- Use upsert pattern for efficient updates
  INSERT INTO sites (
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, created_at, updated_at
  )
  SELECT 
    site_id, exp_date, total_rental, 
    total_payment_to_pay, deposit, created_at, updated_at
  FROM temp_sites
  ON CONFLICT (site_id)
  DO UPDATE SET
    exp_date = EXCLUDED.exp_date,
    total_rental = EXCLUDED.total_rental,
    total_payment_to_pay = EXCLUDED.total_payment_to_pay,
    deposit = EXCLUDED.deposit,
    updated_at = NOW();
    
  -- Cleanup
  DROP TABLE temp_sites;
  
  RETURN QUERY SELECT * FROM sites;
END;
$$ LANGUAGE plpgsql;
```

## 2. Client-Side Improvements

### Replace Direct Upload with Chunked Approach

**Goal:** Break large files into manageable pieces to avoid browser memory limits.

```typescript
// composables/useFileUpload.ts
import { ref, computed } from 'vue'
import { useSupabaseClient } from '#imports'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const useFileUpload = () => {
  const supabase = useSupabaseClient()
  const uploadState = ref({
    uploadId: null,
    status: 'idle', // idle, preparing, uploading, processing, complete, error
    progress: 0,
    error: null,
    filename: '',
    totalChunks: 0,
    chunksUploaded: 0,
    processedRecords: 0
  })
  
  const isUploading = computed(() => 
    ['preparing', 'uploading', 'processing'].includes(uploadState.value.status)
  )
  
  const progress = computed(() => {
    const { status, totalChunks, chunksUploaded } = uploadState.value
    if (status === 'preparing') return 5
    if (status === 'uploading' && totalChunks > 0) {
      return Math.floor((chunksUploaded / totalChunks) * 80) + 5
    }
    if (status === 'processing') return 85
    if (status === 'complete') return 100
    return 0
  })
  
  const chunkSize = 2 * 1024 * 1024 // 2MB chunks
  
  const uploadFile = async (file) => {
    try {
      // Reset state
      uploadState.value = {
        uploadId: crypto.randomUUID(),
        status: 'preparing',
        progress: 0,
        error: null,
        filename: file.name,
        totalChunks: Math.ceil(file.size / chunkSize),
        chunksUploaded: 0,
        processedRecords: 0
      }
      
      // Create upload job in database
      const { data, error } = await supabase
        .from('upload_jobs')
        .insert({
          filename: file.name,
          total_chunks: uploadState.value.totalChunks,
          status: 'uploading'
        })
        .select('id')
        .single()
        
      if (error) throw error
      uploadState.value.uploadId = data.id
      
      // Upload file in chunks
      uploadState.value.status = 'uploading'
      
      for (let i = 0; i < uploadState.value.totalChunks; i++) {
        const chunk = file.slice(
          i * chunkSize, 
          Math.min((i + 1) * chunkSize, file.size)
        )
        
        const formData = new FormData()
        formData.append('file', chunk)
        formData.append('chunkIndex', i.toString())
        formData.append('totalChunks', uploadState.value.totalChunks.toString())
        formData.append('uploadId', uploadState.value.uploadId)
        
        const response = await fetch(`${supabase.supabaseUrl}/functions/v1/process-upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${supabase.supabaseKey}`
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }
        
        uploadState.value.chunksUploaded++
      }
      
      // After all chunks are uploaded, processing happens server-side
      uploadState.value.status = 'processing'
      
      // Set up realtime subscription to track progress
      const subscription = supabase
        .channel(`upload-${uploadState.value.uploadId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'upload_jobs',
          filter: `id=eq.${uploadState.value.uploadId}`
        }, (payload) => {
          if (payload.new.status === 'complete') {
            uploadState.value.status = 'complete'
            uploadState.value.processedRecords = payload.new.processed_records
            subscription.unsubscribe()
          } else if (payload.new.status === 'error') {
            uploadState.value.status = 'error'
            uploadState.value.error = payload.new.error_message
            subscription.unsubscribe()
          }
        })
        .subscribe()
      
      return uploadState.value.uploadId
    } catch (error) {
      uploadState.value.status = 'error'
      uploadState.value.error = error.message
      throw error
    }
  }
  
  return {
    uploadFile,
    uploadState,
    isUploading,
    progress
  }
}
```

### Replace localStorage with API Calls

**Goal:** Eliminate browser storage limitations by fetching data directly from the server.

```typescript
// composables/useSiteData.ts
import { useState } from '#app'
import { useSiteService } from '~/utils/supabaseService'

export const useSiteData = () => {
  const cachedData = useState('site-data', () => null)
  const isLoading = useState('site-data-loading', () => false)
  const error = useState('site-data-error', () => null)
  const lastFetched = useState('site-data-timestamp', () => 0)
  const siteService = useSiteService()
  
  // Pagination parameters
  const page = useState('site-data-page', () => 1)
  const pageSize = useState('site-data-page-size', () => 100)
  const totalPages = useState('site-data-total-pages', () => 1)
  
  const fetchData = async (options = {}) => {
    const { force = false, pageNum = page.value, pageSizeNum = pageSize.value } = options
    const now = Date.now()
    const cacheExpiry = 5 * 60 * 1000 // 5 minutes
    
    if (force || !cachedData.value || (now - lastFetched.value) > cacheExpiry) {
      isLoading.value = true
      error.value = null
      
      try {
        const result = await siteService.fetchSiteDataPaginated(pageNum, pageSizeNum)
        cachedData.value = result.data
        page.value = pageNum
        pageSize.value = pageSizeNum
        totalPages.value = Math.ceil(result.count / pageSizeNum)
        lastFetched.value = now
        return result.data
      } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
        console.error('Error fetching site data:', err)
        throw err
      } finally {
        isLoading.value = false
      }
    }
    
    return cachedData.value
  }
  
  return {
    fetchData,
    cachedData,
    isLoading,
    error,
    lastFetched,
    page,
    pageSize,
    totalPages,
    nextPage: async () => {
      if (page.value < totalPages.value) {
        return fetchData({ pageNum: page.value + 1, force: true })
      }
      return cachedData.value
    },
    prevPage: async () => {
      if (page.value > 1) {
        return fetchData({ pageNum: page.value - 1, force: true })
      }
      return cachedData.value
    }
  }
}
```

## 3. Implementation Roadmap

1. **Database Schema Updates**
   - Create upload_jobs table
   - Add batch processing function
   - Configure storage buckets for temporary files

2. **Server Components**
   - Implement process-upload Edge Function
   - Test with large sample datasets

3. **Client Components**
   - Replace useUploadState with useFileUpload
   - Update dataupload.vue to use chunked upload
   - Modify datastaging.vue to use real-time status updates
   - Update dashboard.vue to use paginated data loading

4. **Testing**
   - Unit test new utilities
   - Load test with 10K, 50K, and 100K record datasets

## Expected Outcomes

- **Handle 100,000+ row files** without browser crashes
- **Provide accurate progress reporting** during uploads
- **Resume interrupted uploads** without starting over
- **Reduce server load** with efficient batch operations
- **Improve user experience** with real-time feedback