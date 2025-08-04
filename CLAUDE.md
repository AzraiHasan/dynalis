# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

### Purpose
Dynalis is a batch data processing system designed for managing site rental and payment data. It provides a streamlined workflow for uploading, validating, and processing large batches of data files with comprehensive tracking and cancellation capabilities.

### Business Domain
- **Core Data**: Site rental information including expiration dates, rental amounts, payments, and deposits
- **Primary Users**: Data managers who need to process large batches of site data efficiently
- **Key Goals**: Minimize time on repetitive tasks, ensure data quality through validation, maintain complete audit trails

### Current Development Focus
- Upload cancellation functionality and background processing for large batches
- Enhanced job tracking and real-time status monitoring
- SQL functions for efficient batch processing (mark_cancelled_upload_records, process_sites_batch)
- Error recovery and cleanup procedures for failed jobs

## Development Commands

### Core Development
- `bun install` - Install dependencies (uses Bun package manager)
- `bun run dev` - Start development server on http://localhost:3000
- `bun run build` - Build for production
- `bun run preview` - Preview production build locally
- `bun run lint` - Run ESLint linter
- `bun run lint:fix` - Run ESLint with auto-fix

### Database Operations
- `bun run db:migration:new <name>` - Create new Supabase migration
- `bun run db:push` - Push migrations to Supabase
- `bun run db:pull` - Pull schema changes from Supabase
- `bun run db:reset` - Reset local database

## Architecture Overview

### Tech Stack
- **Frontend**: Nuxt.js 3 with Vue 3 Composition API
- **Backend**: Supabase (PostgreSQL with real-time capabilities)
- **Language**: TypeScript throughout
- **Package Manager**: Bun
- **UI Framework**: Nuxt UI (@nuxt/ui)
- **Linting**: ESLint with @nuxt/eslint

### Application Structure
```
app/
├── components/          # Vue components (UploadProgressModal, etc.)
├── composables/         # Vue composables for shared logic
│   ├── useBatchUploadService.ts  # Batch upload handling
│   ├── useFileUpload.ts         # File upload utilities
│   ├── useSiteData.ts           # Site data management
│   └── useUploadState.ts        # Upload state management
├── pages/              # Nuxt pages (auto-routed)
│   ├── dashboard.vue   # Main dashboard
│   ├── datastaging.vue # Data staging area
│   ├── dataupload.vue  # File upload interface
│   └── index.vue       # Landing page
├── types/
│   └── supabase.ts     # TypeScript definitions for database
└── utils/
    ├── dateUtils.ts    # Date formatting utilities
    └── supabaseService.ts # Supabase client operations
```

### Database Schema
Primary tables managed through Supabase migrations:
- `sites` - Core site data with rental/payment information (site_id, exp_date, total_rental, total_payment_to_pay, deposit)
- `upload_tracking` - Track upload job progress and status
- `upload_jobs` - Background processing jobs with status management
- `upload_job_records` - Links individual site records to upload jobs for tracking

Stored procedures for batch operations:
- `mark_cancelled_upload_records` - Handle cancellation cleanup
- `process_sites_batch` - Efficient batch processing of site data
- Bulk upload function for large data sets

Key features:
- Row Level Security (RLS) enabled for all tables
- UUID primary keys with proper indexing
- Real-time job status tracking and updates
- Upload cancellation and recovery mechanisms
- Data deduplication handling

### Key Patterns

#### Composables Architecture
The app uses Vue 3 composables for shared state and business logic:
- `useBatchUploadService()` - Handles batch file uploads with progress tracking
- `useUploadState()` - Manages upload status across components
- `useSiteData()` - CRUD operations for site data
- `useFileUpload()` - File parsing and validation

#### Supabase Integration
- Database client configured in `nuxt.config.ts` with auth disabled (`redirect: false`)
- TypeScript types generated from database schema in `app/types/supabase.ts`
- Real-time subscriptions for job status updates
- Custom bulk upload functions for efficient batch processing

#### File Processing Pipeline
1. File upload and validation (CSV/Excel support via papaparse/xlsx)
2. Data staging for user review
3. Batch processing with progress tracking
4. Background job execution with cancellation support
5. Real-time status updates

### Environment Setup
- Supabase local development on ports 54321-54327
- Local development server on port 3000
- Requires SUPABASE_URL and SUPABASE_KEY environment variables

### Testing and Code Quality
- ESLint configuration in `eslint.config.mjs`
- TypeScript strict mode enabled
- Always run `bun run lint` before committing changes

## Development Conventions

### Code Organization Patterns
- **Business Logic**: All core logic in composables/ following service layer pattern
- **State Management**: Use reactive state in composables, avoid global state when possible
- **Database Access**: All database operations through `utils/supabaseService.ts`
- **Type Safety**: Interface definitions in `types/supabase.ts`, prefer TypeScript for complex data structures

### Batch Processing Architecture
- **Core Service**: `useBatchUploadService.ts` handles main processing logic
- **State Tracking**: `useUploadState.ts` manages upload status across components
- **File Handling**: `useFileUpload.ts` for parsing and validation (CSV/Excel via papaparse/xlsx)
- **Data Management**: `useSiteData.ts` for CRUD operations and caching

### Development Priorities
- Prefer Vue 3 Composition API over Options API
- Use async/await for all Supabase operations
- Maintain modular service architecture
- Schema changes only through Supabase migrations

## Known Limitations & Considerations

### Current Gaps
- Limited error handling for failed uploads (in progress)
- Basic validation in staging area (needs enhancement)
- Performance monitoring for batch processing (planned)
- Comprehensive error recovery system (in development)

### Performance Considerations
- Background processing impact on system resources
- Data consistency during upload cancellation
- Job status tracking accuracy under high load
- Memory usage during large batch processing

### User Experience Priorities
- Real-time feedback during all upload stages
- Clear status communication for long-running jobs
- Reliable upload cancellation without data corruption
- Prevention of duplicate data entries