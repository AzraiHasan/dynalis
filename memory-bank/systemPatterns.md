# System Patterns: Dynalis Architecture

## Application Structure

- Nuxt.js frontend with Vue 3 composition API
- Supabase backend for data storage
- Separation of concerns through composables

## Key Components

1. **Pages**

   - dataupload.vue: File upload interface
   - datastaging.vue: Data validation interface
   - dashboard.vue: Job monitoring

2. **Services**
   - useUploadState.ts: Upload state management and validation logic
   - useBatchUploadService.ts: Core processing logic
   - useFileUpload.ts: File handling and batch processing
   - useSiteData.ts: Data caching and fetching
   - supabaseService.ts: Database interaction layer

3. **Database**
   - Supabase tables:
     - sites
     - upload_tracking
     - upload_jobs
   - Bulk upload function
   - upload_job_records: Links sites to upload jobs
   - Stored procedures:
      - mark_cancelled_upload_records
      - process_sites_batch

## Design Patterns

- Composition API for business logic
- Service layer pattern (composables)
- State management via reactive stores
- Database migrations for schema changes
