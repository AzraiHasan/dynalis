# Supabase Integration Implementation Plan

This document outlines the comprehensive plan for integrating Supabase with our dashboard application to provide persistent database storage for uploaded data.

## 1. Set Up Supabase Integration

**Sub-goal:** Establish connection between the application and Supabase backend.

### 1.1 Install Required Dependencies

```bash
# Install Supabase module for Nuxt
npm install @nuxtjs/supabase

# Install additional helper libraries if needed
npm install @supabase/supabase-js
```

### 1.2 Configure Supabase in Nuxt Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Existing config...
  
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxtjs/supabase' // Add Supabase module
  ],
  
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    redirect: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/*'],
    }
  },
})
```

### 1.3 Create Environment Variables

```bash
# .env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-anon-key
```

### 1.4 Create a Supabase Service Layer

Create a new file `utils/supabaseService.ts` to centralize database operations:

```typescript
// utils/supabaseService.ts
import { useSupabaseClient } from '#imports'

export const useSiteService = () => {
  const supabase = useSupabaseClient()
  
  const uploadSiteData = async (data) => {
    // Implementation will go here
  }
  
  const fetchSiteData = async () => {
    // Implementation will go here
  }
  
  return {
    uploadSiteData,
    fetchSiteData
  }
}
```

## 2. Implement Database Schema and Management

**Sub-goal:** Create and manage database tables for storing the uploaded data.

### 2.1 Define Table Schema

```typescript
// utils/supabaseService.ts - extended

interface SiteRecord {
  id: string
  site_id: string
  exp_date: string | null
  total_rental: number
  total_payment_to_pay: number
  deposit: number
  created_at: string
  updated_at: string
}

// Database initialization function
const initializeDatabase = async () => {
  const supabase = useSupabaseClient()
  
  // Check if table exists and create if needed
  // Note: This would typically be done through migrations in a production environment
  const { error } = await supabase.rpc('create_sites_table_if_not_exists')
  
  if (error) {
    console.error('Error initializing database:', error)
    throw error
  }
}
```

### 2.2 Create SQL Function in Supabase

Create a PostgreSQL function in Supabase SQL editor:

```sql
-- SQL function to create table if not exists
CREATE OR REPLACE FUNCTION create_sites_table_if_not_exists()
RETURNS void AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id TEXT NOT NULL,
    exp_date DATE,
    total_rental DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_payment_to_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
    deposit DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  
  -- Create index on site_id for faster lookups
  CREATE INDEX IF NOT EXISTS idx_sites_site_id ON sites(site_id);
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Implement Smart Data Upload Function

```typescript
// utils/supabaseService.ts - smart upload logic

const uploadSiteData = async (data: FileRow[]) => {
  const supabase = useSupabaseClient()
  
  // Transform data to match database schema
  const transformedData = data.map(row => ({
    site_id: row['SITE ID']?.toString() || 'NO ID',
    exp_date: row['EXP DATE'] ? parseDate(row['EXP DATE'].toString()) : null,
    total_rental: parseCurrency(row['TOTAL RENTAL (RM)']),
    total_payment_to_pay: parseCurrency(row['TOTAL PAYMENT TO PAY (RM)']),
    deposit: parseCurrency(row['DEPOSIT (RM)']),
    updated_at: new Date().toISOString()
  }))
  
  // Process records one by one to handle smart updates
  for (const record of transformedData) {
    // Check if record already exists
    const { data: existingRecords, error: queryError } = await supabase
      .from('sites')
      .select('*')
      .eq('site_id', record.site_id)
      .maybeSingle()
    
    if (queryError) {
      console.error('Error querying existing record:', queryError)
      throw queryError
    }
    
    if (existingRecords) {
      // Record exists, merge data (only update empty fields)
      const mergedRecord = {
        ...record,
        // Only update if the existing value is null, empty, or 0
        exp_date: existingRecords.exp_date || record.exp_date,
        total_rental: existingRecords.total_rental || record.total_rental,
        total_payment_to_pay: existingRecords.total_payment_to_pay || record.total_payment_to_pay,
        deposit: existingRecords.deposit || record.deposit,
        updated_at: new Date().toISOString()
      }
      
      const { error: updateError } = await supabase
        .from('sites')
        .update(mergedRecord)
        .eq('site_id', record.site_id)
      
      if (updateError) {
        console.error('Error updating record:', updateError)
        throw updateError
      }
    } else {
      // Record doesn't exist, insert new record
      const { error: insertError } = await supabase
        .from('sites')
        .insert(record)
      
      if (insertError) {
        console.error('Error inserting record:', insertError)
        throw insertError
      }
    }
  }
  
  return { success: true, count: transformedData.length }
}
```

### 2.4 Create SQL Function for Efficient Smart Updates

For improved performance, create a PostgreSQL function in Supabase:

```sql
-- Function for smart updates of site data
CREATE OR REPLACE FUNCTION smart_update_site(
  p_site_id TEXT,
  p_exp_date DATE,
  p_total_rental DECIMAL,
  p_total_payment_to_pay DECIMAL,
  p_deposit DECIMAL
) RETURNS void AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if record exists
  SELECT EXISTS(SELECT 1 FROM sites WHERE site_id = p_site_id) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing record, preserving non-empty values
    UPDATE sites
    SET 
      exp_date = COALESCE(sites.exp_date, p_exp_date),
      total_rental = CASE WHEN sites.total_rental = 0 THEN p_total_rental ELSE sites.total_rental END,
      total_payment_to_pay = CASE WHEN sites.total_payment_to_pay = 0 THEN p_total_payment_to_pay ELSE sites.total_payment_to_pay END,
      deposit = CASE WHEN sites.deposit = 0 THEN p_deposit ELSE sites.deposit END,
      updated_at = NOW()
    WHERE site_id = p_site_id;
  ELSE
    -- Insert new record
    INSERT INTO sites (site_id, exp_date, total_rental, total_payment_to_pay, deposit, created_at, updated_at)
    VALUES (p_site_id, p_exp_date, p_total_rental, p_total_payment_to_pay, p_deposit, NOW(), NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 2.5 Implement Batch Processing with Smart Updates

```typescript
// utils/supabaseService.ts - optimized batch upload

const uploadSiteDataBatch = async (data: FileRow[]) => {
  const supabase = useSupabaseClient()
  
  // Transform data to match database schema
  const transformedData = data.map(row => ({
    site_id: row['SITE ID']?.toString() || 'NO ID',
    exp_date: row['EXP DATE'] ? parseDate(row['EXP DATE'].toString()) : null,
    total_rental: parseCurrency(row['TOTAL RENTAL (RM)']),
    total_payment_to_pay: parseCurrency(row['TOTAL PAYMENT TO PAY (RM)']),
    deposit: parseCurrency(row['DEPOSIT (RM)'])
  }))
  
  // Process in batches using the database function
  const batchSize = 50
  const batches = Math.ceil(transformedData.length / batchSize)
  
  for (let i = 0; i < batches; i++) {
    const startIdx = i * batchSize
    const endIdx = Math.min(startIdx + batchSize, transformedData.length)
    const batchData = transformedData.slice(startIdx, endIdx)
    
    // Create an array of function calls
    const calls = batchData.map(record => ({
      name: 'smart_update_site',
      params: {
        p_site_id: record.site_id,
        p_exp_date: record.exp_date,
        p_total_rental: record.total_rental,
        p_total_payment_to_pay: record.total_payment_to_pay,
        p_deposit: record.deposit
      }
    }))
    
    // Execute all function calls in the batch
    for (const call of calls) {
      const { error } = await supabase.rpc(call.name, call.params)
      if (error) {
        console.error(`Error processing record ${call.params.p_site_id}:`, error)
        throw error
      }
    }
  }
  
  return { success: true, count: transformedData.length }
}
```

## 3. Create Modal Progress UI

**Sub-goal:** Implement a modal with progress indicator for the upload process.

### 3.1 Create Upload State Management

```typescript
// composables/useUploadState.ts
export const useUploadState = () => {
  const isUploading = ref(false)
  const progress = ref(0)
  const status = ref<'idle' | 'preparing' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
  const statusMessage = ref('')
  const error = ref<Error | null>(null)
  
  const startUpload = () => {
    isUploading.value = true
    progress.value = 0
    status.value = 'preparing'
    statusMessage.value = 'Preparing data...'
    error.value = null
  }
  
  const updateProgress = (newProgress: number, message?: string) => {
    progress.value = newProgress
    if (message) statusMessage.value = message
  }
  
  const finishUpload = () => {
    progress.value = 100
    status.value = 'complete'
    statusMessage.value = 'Upload complete!'
    setTimeout(() => {
      isUploading.value = false
    }, 1500)
  }
  
  const setError = (err: Error) => {
    error.value = err
    status.value = 'error'
    statusMessage.value = `Error: ${err.message}`
  }
  
  return {
    isUploading,
    progress,
    status,
    statusMessage,
    error,
    startUpload,
    updateProgress,
    finishUpload,
    setError
  }
}
```

### 3.2 Create Upload Modal Component

```vue
<!-- components/UploadProgressModal.vue -->
<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <Icon name="i-lucide-upload" class="text-gray-600" />
          <h3 class="text-lg font-semibold">Uploading Data</h3>
        </div>
      </template>
      
      <div class="space-y-4 py-4">
        <div class="flex justify-between items-center">
          <span class="text-sm font-medium">{{ statusMessage }}</span>
          <span class="text-sm text-gray-500">{{ Math.round(progress) }}%</span>
        </div>
        
        <UProgress
          v-model="progress"
          color="primary"
          :indeterminate="status === 'preparing' || status === 'processing'"
        />
        
        <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
          {{ error.message }}
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            v-if="status === 'error'"
            color="gray"
            @click="$emit('close')"
          >
            Close
          </UButton>
          <UButton
            v-if="status !== 'complete' && status !== 'error'"
            color="gray"
            @click="$emit('cancel')"
            :disabled="status === 'uploading'"
          >
            Cancel
          </UButton>
          <UButton
            v-if="status === 'complete'"
            color="primary"
            @click="$emit('continue')"
          >
            Continue to Dashboard
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'idle'
  },
  statusMessage: {
    type: String,
    default: ''
  },
  error: {
    type: Object,
    default: null
  }
})

defineEmits(['close', 'cancel', 'continue'])
</script>
```

## 4. Integrate Upload Logic with Datastaging Page

**Sub-goal:** Connect the upload button on the datastaging page to the Supabase upload functionality.

### 4.1 Update Datastaging Page

```typescript
// pages/datastaging.vue - Modifications

// Import the composables and components
import { useUploadState } from '~/composables/useUploadState'
import { useSiteService } from '~/utils/supabaseService'

// Add these to the setup function
const uploadState = useUploadState()
const siteService = useSiteService()

// Replace handleDashboard function with:
const handleDashboard = async () => {
  try {
    const stored = localStorage.getItem('uploadedFileData')
    if (!stored) {
      alert('No data available. Please upload a file first.')
      router.push('/dataupload')
      return
    }
    
    // Parse and validate data before upload
    const data = JSON.parse(stored)
    if (!data.fileData || !Array.isArray(data.fileData)) {
      throw new Error('Invalid data structure')
    }
    
    // Start upload process
    uploadState.startUpload()
    
    // Upload data in batches for better performance
    const batchSize = 50
    const batches = Math.ceil(data.fileData.length / batchSize)
    
    for (let i = 0; i < batches; i++) {
      const startIdx = i * batchSize
      const endIdx = Math.min(startIdx + batchSize, data.fileData.length)
      const batchData = data.fileData.slice(startIdx, endIdx)
      
      uploadState.updateProgress(
        (i / batches) * 100, 
        `Uploading and processing batch ${i+1}/${batches}...`
      )
      
      await siteService.uploadSiteDataBatch(batchData)
    }
    
    uploadState.updateProgress(100, 'Processing data...')
    uploadState.finishUpload()
    
    // Clear localStorage after successful upload
    localStorage.removeItem('uploadedFileData')
    
    // Navigate to dashboard
    router.push('/dashboard')
  } catch (error) {
    console.error('Error uploading data:', error)
    uploadState.setError(error)
  }
}
```

### 4.2 Add Upload Modal to Datastaging Template

```vue
<!-- Add this to the template section of pages/datastaging.vue -->
<UploadProgressModal
  :is-open="uploadState.isUploading"
  :progress="uploadState.progress"
  :status="uploadState.status"
  :status-message="uploadState.statusMessage"
  :error="uploadState.error"
  @close="uploadState.isUploading = false"
  @cancel="cancelUpload"
  @continue="router.push('/dashboard')"
/>
```

### 4.3 Add Cancel Upload Function

```typescript
// Add to the script section of pages/datastaging.vue
const cancelUpload = () => {
  // Only allow cancellation in certain states
  if (uploadState.status === 'preparing' || uploadState.status === 'processing') {
    uploadState.isUploading = false
  }
}
```

## 5. Refactor Dashboard to Use Supabase Data

**Sub-goal:** Modify the dashboard page to fetch and display data from Supabase instead of localStorage.

### 5.1 Implement Data Fetching in Dashboard

```typescript
// pages/dashboard.vue - Modified onMounted function

// Import service
import { useSiteService } from '~/utils/supabaseService'

// In setup function:
const isLoading = ref(true)
const error = ref<Error | null>(null)
const siteService = useSiteService()

onMounted(async () => {
  try {
    isLoading.value = true
    
    // Fetch data from Supabase
    const data = await siteService.fetchSiteData()
    
    // Transform data to match expected format
    fileData.value = data.map(item => ({
      'SITE ID': item.site_id,
      'EXP DATE': item.exp_date,
      'TOTAL RENTAL (RM)': item.total_rental,
      'TOTAL PAYMENT TO PAY (RM)': item.total_payment_to_pay,
      'DEPOSIT (RM)': item.deposit
    }))
    
    // Set summary statistics
    const sitesData = fileData.value.filter(
      (row) => row["SITE ID"] && row["SITE ID"].toString().toUpperCase() !== "NO ID"
    )
    totalSites.value = sitesData.length
    
    // Rest of your existing calculation logic...
    // [Keeping this the same as in your current code]
    
  } catch (error) {
    console.error('Error fetching data:', error)
    error.value = error
  } finally {
    isLoading.value = false
  }
})
```

### 5.2 Implement Data Fetching Service

```typescript
// utils/supabaseService.ts - Add fetch function

const fetchSiteData = async () => {
  const supabase = useSupabaseClient()
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
  
  if (error) {
    console.error('Error fetching data:', error)
    throw error
  }
  
  return data
}
```

### 5.3 Add Loading State to Dashboard

```vue
<!-- Add to dashboard.vue template -->
<div v-if="isLoading" class="flex justify-center items-center h-64">
  <ULoading size="lg" />
</div>

<div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg">
  Failed to load dashboard data: {{ error.message }}
</div>

<!-- Rest of your dashboard content, wrapped in v-else -->
<div v-else class="space-y-4">
  <!-- Existing dashboard content -->
</div>
```

## 6. Additional Enhancements and Considerations

**Sub-goal:** Optimize the implementation for production use.

### 6.1 Add Error Handling and Retry Mechanism

```typescript
// Enhanced error handling in supabaseService.ts
const uploadWithRetry = async (data, retries = 3) => {
  try {
    return await uploadSiteDataBatch(data)
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return uploadWithRetry(data, retries - 1)
    }
    throw error
  }
}

const isRetryableError = (error) => {
  // Determine if error is network related or rate-limit
  return error.code === 'NETWORK_ERROR' || 
         error.code === 'TOO_MANY_REQUESTS' ||
         error.message.includes('network')
}
```

### 6.2 Implement Data Pagination for Large Datasets

```typescript
// utils/supabaseService.ts - Paginated fetch
const fetchSiteDataPaginated = async (page = 0, pageSize = 100) => {
  const supabase = useSupabaseClient()
  
  const { data, error, count } = await supabase
    .from('sites')
    .select('*', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  
  if (error) {
    console.error('Error fetching data:', error)
    throw error
  }
  
  return { data, count }
}
```

### 6.3 Add Data Caching for Performance

```typescript
// composables/useSiteData.ts
export const useSiteData = () => {
  const cachedData = useState('site-data', () => null)
  const lastFetched = useState('site-data-timestamp', () => 0)
  const siteService = useSiteService()
  
  const fetchData = async (force = false) => {
    const now = Date.now()
    const cacheExpiry = 5 * 60 * 1000 // 5 minutes
    
    if (force || !cachedData.value || (now - lastFetched.value) > cacheExpiry) {
      const data = await siteService.fetchSiteData()
      cachedData.value = data
      lastFetched.value = now
    }
    
    return cachedData.value
  }
  
  return {
    fetchData,
    cachedData
  }
}
```

### 6.4 Implement Data Export Function

```typescript
// utils/supabaseService.ts - Add export function
const exportSiteData = async (format = 'json') => {
  const supabase = useSupabaseClient()
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
  
  if (error) {
    console.error('Error exporting data:', error)
    throw error
  }
  
  if (format === 'csv') {
    // Convert to CSV
    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(row => Object.values(row).join(','))
    return [headers, ...rows].join('\n')
  }
  
  return data
}
```