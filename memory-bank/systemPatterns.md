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
   - useBatchUploadService.ts: Core processing logic
   - useUploadState.ts: State management
   - useFileUpload.ts: File handling

3. **Database**
   - Supabase tables:
     - sites
     - upload_tracking
     - upload_jobs
   - Bulk upload function

## Design Patterns
- Composition API for business logic
- Service layer pattern (composables)
- State management via reactive stores
- Database migrations for schema changes
