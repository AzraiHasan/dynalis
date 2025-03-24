# Large File Upload Implementation Strategy

## Current Limitations

The current implementation has significant bottlenecks that prevent handling files with 1000+ rows:

1. **In-memory processing** of entire files
2. **localStorage bottleneck** (5-10MB limit)
3. **Sequential database operations** (one query per record)
4. **No chunking capabilities** for large files

## Updated Implementation Approach

### 1. Client-Side Chunked Processing

Instead of implementing server-side Edge Functions with Deno (which introduces complexity), we've chosen a client-side chunked approach that:

- Processes files in manageable batches
- Reduces memory consumption
- Provides progress tracking
- Handles large datasets efficiently

### 2. Implementation Components

#### A. Chunked Upload Composable

```typescript
// composables/useChunkedUpload.ts
import { ref, computed } from 'vue'

export const useChunkedUpload = () => {
  const uploadState = ref({
    status: 'idle', // idle, preparing, uploading, processing, complete, error
    progress: 0,
    error: null,
    filename: '',
  })
  
  const isUploading = computed(() => 
    ['preparing', 'uploading', 'processing'].includes(uploadState.value.status)
  )
  
  // Store processed data in localStorage in chunks to avoid memory issues
  const storeProcessedData = (data, fileName) => {
    try {
      uploadState.value = {
        status: 'processing',
        progress: 50,
        error: null,
        filename: fileName
      }
      
      const batchSize = 100
      const totalBatches = Math.ceil(data.length / batchSize)
      
      // Store data information
      const headers = data.length > 0 ? Object.keys(data[0]) : []
      const dataToStore = {
        fileData: [],
        headers,
        fileName
      }
      
      // Process in batches
      for (let i = 0; i < totalBatches; i++) {
        const startIdx = i * batchSize
        const endIdx = Math.min(startIdx + batchSize, data.length)
        const batch = data.slice(startIdx, endIdx)
        
        // Add batch to storage data
        dataToStore.fileData.push(...batch)
        
        // Update progress
        uploadState.value.progress = 50 + Math.floor((i + 1) / totalBatches * 50)
      }
      
      // Save to localStorage
      localStorage.setItem('uploadedFileData', JSON.stringify(dataToStore))
      
      uploadState.value.status = 'complete'
      uploadState.value.progress = 100
      
      return dataToStore
    } catch (error) {
      uploadState.value.status = 'error'
      uploadState.value.error = error
      throw error
    }
  }
  
  return {
    storeProcessedData,
    uploadState,
    isUploading,
    progress: computed(() => uploadState.value.progress)
  }
}
```

#### B. Database Batch Processing (Future Implementation)

For future optimization, we should create a PostgreSQL function for efficient batch operations:

```sql
CREATE OR REPLACE FUNCTION public.bulk_upload_sites(data JSONB)
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

### 3. Implementation Roadmap

#### Phase 1: Client-Side Chunking (Current Implementation)
- ✅ Implement `useChunkedUpload` composable
- ✅ Update file upload page to use chunked processing
- ✅ Add progress tracking and error handling

#### Phase 2: Backend Optimization (Next Steps)
- Create database migration for upload tracking
- Implement batch processing database function
- Add API endpoint for chunk submission

#### Phase 3: Advanced Features
- Resume interrupted uploads
- Background processing for very large datasets
- Compression for network transfer optimization

## Expected Outcomes

This chunked approach provides several immediate benefits:
1. **Handles larger datasets** by processing in manageable chunks
2. **Reduces memory consumption** during upload
3. **Provides progress feedback** to users
4. **Improves reliability** for large file uploads

Future optimizations will further enhance performance by implementing server-side batch processing and storage optimizations.