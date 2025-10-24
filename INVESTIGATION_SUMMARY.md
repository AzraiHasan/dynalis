# Dynalis Data Upload System - Investigation Summary

## Files Reviewed

### UI Components
- `/home/user/dynalis/app/pages/dataupload.vue` (665 lines)
- `/home/user/dynalis/app/pages/datastaging.vue` (775 lines)
- `/home/user/dynalis/app/pages/dashboard.vue` (partial review)
- `/home/user/dynalis/app/components/UploadProgressModal.vue`

### Composables (Business Logic)
- `/home/user/dynalis/app/composables/useBatchUploadService.ts` (688 lines)
- `/home/user/dynalis/app/composables/useUploadState.ts` (48 lines)
- `/home/user/dynalis/app/composables/useFileUpload.ts` (163 lines)
- `/home/user/dynalis/app/composables/useSiteData.ts` (47 lines)
- `/home/user/dynalis/app/composables/useAuth.ts`

### Database & Types
- `/home/user/dynalis/app/types/supabase.ts` (26 lines)
- `/home/user/dynalis/app/utils/supabaseService.ts` (121 lines)
- `/home/user/dynalis/app/utils/dateUtils.ts` (54 lines)

### Database Migrations
- `/home/user/dynalis/supabase/migrations/20250324051048_create_sites_table.sql`
- `/home/user/dynalis/supabase/migrations/20250324070815_create_upload_tracking.sql`
- `/home/user/dynalis/supabase/migrations/20250324070927_create_upload_jobs.sql`
- `/home/user/dynalis/supabase/migrations/20250324071118_add_bulk_upload_function.sql`
- `/home/user/dynalis/supabase/migrations/20250325035054_mark_cancelled_upload_records.sql`
- `/home/user/dynalis/supabase/migrations/20250325053634_process_sites_batch.sql`

---

## Key Findings

### 1. Current System Purpose

Dynalis is a **batch data upload system** specifically designed for site rental and payment management. It enables data managers to:

- Upload CSV/Excel files with site data
- Preview and validate data quality before committing
- Process large batches in background with progress tracking
- Handle upload interruption and resumption
- Cancel uploads with cleanup procedures

**Single Primary Dataset:** Sites (rental locations with contract/payment information)

---

### 2. The Single Dataset: SITES

**Database Table Structure:**
```
sites
├── id (UUID) → primary key
├── site_id (TEXT, UNIQUE) → natural key for lookups
├── exp_date (DATE) → contract expiration date
├── total_rental (DECIMAL) → rental amount (RM)
├── total_payment_to_pay (DECIMAL) → outstanding payment (RM)
├── deposit (DECIMAL) → security deposit (RM)
├── created_at, updated_at → audit timestamps
└── cancelled_upload (BOOLEAN) → cancellation flag
```

**Expected CSV/Excel Format (case-sensitive):**
```
SITE ID | EXP DATE | TOTAL RENTAL (RM) | TOTAL PAYMENT TO PAY (RM) | DEPOSIT (RM)
1001    | 12/01/24 | RM 10,000         | RM 5,000                 | RM 2,500
1002    | 15/02/24 | RM 15,500.50      | RM 8,200                 | RM 3,100
...
```

---

### 3. Upload Pipeline (7-Step Process)

#### Step 1: File Selection (dataupload.vue)
- User drags/drops or clicks to select file
- Validates extension (.csv, .xlsx, .xls)
- Shows filename and file size

#### Step 2: Parse & Local Storage (useFileUpload.ts)
- Parses file using PapaParse (CSV) or XLSX (Excel)
- Extracts column headers
- Batches in-memory (100 rows per batch)
- Stores in `localStorage: uploadedFileData`

#### Step 3: Preview & Validation (datastaging.vue)
- Retrieves data from localStorage
- Shows summary statistics (rows, columns, missing values)
- Calculates metrics (total sites, rental sums, expirations)
- Performs column-by-column quality checks
- Displays sample data (first 5 rows)

#### Step 4: Job Creation (handleCommitData)
- Checks for incomplete uploads
- Either resumes or starts fresh
- Creates `upload_jobs` record (status: queued)
- Stores transformed data in `localStorage: bg_upload_${jobId}`
- Navigates to dashboard

#### Step 5: Background Processing (processBackgroundJob)
- Retrieves data from localStorage
- Deduplicates by site_id (keeps latest)
- Loops through batches (250 records per batch)
- Calls PostgreSQL RPC function for each batch
- Updates job progress after each batch

#### Step 6: Database Insertion (PostgreSQL RPC: process_sites_batch)
- Receives batch as JSONB
- Creates temp table with deduplication
- Performs UPSERT by site_id
- Updates or inserts records
- Returns count of processed rows

#### Step 7: Job Completion
- Marks upload_jobs as "complete"
- Cleans up localStorage
- Dashboard displays updated data

---

### 4. Database Tables & Relationships

**3 Core Tables:**

1. **sites** (main data)
   - Stores site rental and payment information
   - UNIQUE constraint on site_id
   - Indexed on site_id and exp_date

2. **upload_jobs** (batch tracking)
   - One record per upload session
   - Tracks progress (chunks_received, processed_records)
   - Stores status (created→queued→processing→complete/error)
   - Records error messages if failures occur

3. **upload_job_records** (junction table)
   - Maps which sites belong to which uploads
   - Used for tracking and cancellation
   - UNIQUE constraint on (job_id, site_id)

**Relationship Diagram:**
```
upload_jobs (1) ←→ (N) upload_job_records (N) ←→ (1) sites
```

---

### 5. Data Transformation Rules

**Input → Output Transformation:**

| Field | Input Format | Transformation | Output |
|-------|--------------|----------------|--------|
| SITE ID | "1001" or null | Convert to string, default "NO ID" | "1001" |
| EXP DATE | "12/01/24" or "-" | Parse using DATE_FORMATS, convert to ISO | "2024-01-12" or null |
| TOTAL RENTAL (RM) | "RM 10,000" or "10000.50" | Remove currency/commas, parse float | 10000 |
| TOTAL PAYMENT TO PAY (RM) | "RM 5,000" | Same as rental | 5000 |
| DEPOSIT (RM) | "RM 2,500" | Same as rental | 2500 |

**Date Format Support:**
```javascript
"dd/MM/yyyy", "dd-MM-yyyy", "yyyy/MM/dd", 
"yyyy-MM-dd", "MM/dd/yyyy", "MM-dd-yyyy"
```

**Deduplication Strategy:**
- If same site_id appears multiple times → keep LAST occurrence
- If site_id exists in DB → UPDATE existing record
- If site_id is new → INSERT new record

---

### 6. State Management Architecture

**Three Layers:**

1. **Component State** (dataupload.vue, datastaging.vue)
   - `selectedFileName`, `dragActive`, `currentStep`
   - `fileData`, `headers` (computed)

2. **Composable State** (useFileUpload.ts, useBatchUploadService.ts)
   - `uploadState`: status, progress, error
   - `state`: totalBatches, processedBatches, processedRecords

3. **Browser Storage** (localStorage)
   - `uploadedFileData`: Raw file data during review
   - `bg_upload_${jobId}`: Transformed data during background processing

4. **Database** (Supabase)
   - `upload_jobs`: Job tracking
   - `sites`: Final processed data

---

### 7. Key Design Patterns

**Composables Architecture**
- All business logic in Vue 3 Composition API composables
- Service layer pattern
- Reactive state with computed properties
- Excellent separation of concerns

**Error Handling**
- Try-catch at each layer
- Database error recording
- User-friendly toast notifications
- Resume capability for interrupted uploads

**Performance Optimizations**
- In-memory batching (100 rows)
- RPC batch processing (250 rows per call)
- localStorage for temporary staging
- Background job prevents UI blocking

---

### 8. Validation & Quality Checks

**File-Level:**
- Extension validation (.csv, .xlsx, .xls)
- File size calculation

**Column-Level (Smart Detection):**
- **Date columns** (name contains "date"):
  - Validates against 6 supported formats
  - Counts invalid dates
- **Financial columns** (contains "rental", "payment", "deposit"):
  - Validates currency format: `^(RM\s*)?[\d,]+(\.\d{2})?$`
  - Counts format violations
- **ID columns** (contains "id"):
  - Checks for spaces
  - Verifies non-empty

**Metrics Calculated:**
- Empty cells per column
- Irregular/invalid cells per column
- Total missing values across dataset
- Dash values ("-") count
- Expiration distribution (expired, 30/60/90 days)

---

## Key Complexities for Multi-Dataset Extension

### Problem 1: Hardcoded Column Names
**Current:** Column names are hardcoded ("SITE ID", "EXP DATE", etc.)
**Challenge:** Cannot handle different dataset structures
**Solution Needed:** Dynamic field mapping configuration

### Problem 2: Fixed Transformation Logic
**Current:** `processBulkUpload()` transforms only to SiteInsert
**Challenge:** Would need separate logic for each dataset type
**Solution Needed:** Generic transformation pipeline with per-dataset rules

### Problem 3: Single File at a Time
**Current:** One upload file per session
**Challenge:** Cannot upload and correlate multiple files simultaneously
**Solution Needed:** Multi-file upload queue with coordination

### Problem 4: No Data Correlation
**Current:** Only deduplicates by site_id within single table
**Challenge:** Cannot link data across different tables
**Solution Needed:** Join key definitions and correlation validation

### Problem 5: Metrics are Hardcoded
**Current:** datastaging.vue calculates specific site metrics
**Challenge:** Different datasets would have different metrics
**Solution Needed:** Dynamic metric calculation engine

### Problem 6: No Foreign Key Relationships
**Current:** sites table is standalone
**Challenge:** Cannot enforce data integrity across datasets
**Solution Needed:** Foreign key constraints and cascading updates

### Problem 7: Validation Rules are Global
**Current:** Date/currency validation assumes Malaysia (RM)
**Challenge:** Different datasets may have different formats
**Solution Needed:** Per-dataset validation rule configuration

---

## Why Multi-Dataset Correlation is Complex

### Architecture Changes Required:

1. **Database Schema**
   - New tables for each dataset (payments, contracts, etc.)
   - Foreign key relationships
   - Join tables for correlations
   - Correlation tracking tables

2. **File Processing**
   - Multi-file upload interface
   - File-to-dataset mapping
   - Concurrent batch processing
   - Correlation ordering (process dependencies)

3. **Data Transformation**
   - Generic transformation engine
   - Per-dataset configuration
   - Cross-table validation rules
   - Conflict resolution for duplicate keys

4. **Job Management**
   - Single job tracks multiple files
   - Dependency management (File A must complete before File B)
   - Correlation processing phase
   - Multi-stage status tracking

5. **UI Complexity**
   - Multi-file upload area
   - Dataset selection for each file
   - Relationship visualization
   - Cross-dataset metrics
   - Conflict/warning display

6. **Type Safety**
   - Generic base interfaces
   - Per-dataset type definitions
   - Union types for transformations
   - Correlation type constraints

---

## Example: What Extending to 2 More Datasets Would Look Like

### New Datasets:

**Dataset 1 (Current): SITES**
- 6 fields, uniquely identified by site_id

**Dataset 2: PAYMENTS**
- payment_id, site_id (FK), payment_date, amount, status

**Dataset 3: CONTRACTS**
- contract_id, site_id (FK), contract_date, term_length, contract_status

### Correlation Points:
```
SITES (1) ←→ (N) PAYMENTS
  site_id    site_id

SITES (1) ←→ (N) CONTRACTS
  site_id    site_id

PAYMENTS & CONTRACTS can be cross-referenced via site_id
```

### Example Validation Rules:
- Every payment's site_id must exist in sites table
- Every contract's site_id must exist in sites table
- Payment date must be within contract term
- Total payments must not exceed total rental amount

### New Job Type:
```
upload_jobs.type = "single" | "multi_dataset" | "correlation"
upload_jobs.related_jobs = [jobId1, jobId2] // For correlation jobs
```

---

## Current System Strengths

1. **Clean Architecture** - Composables separation is excellent
2. **Error Recovery** - Can resume interrupted uploads
3. **Progress Tracking** - Real-time updates during processing
4. **Deduplication** - Automatic duplicate handling
5. **Performance** - Batching prevents memory issues
6. **Validation** - Multi-level quality checks
7. **Type Safety** - TypeScript throughout
8. **Background Processing** - Non-blocking async jobs

---

## Current System Limitations (for Multi-Dataset)

1. **Hardcoded Field Names** - No configuration layer
2. **Single Table Focus** - No cross-table logic
3. **No Correlation Support** - Cannot link datasets
4. **Sequential Only** - One file at a time
5. **Fixed Validation** - No per-dataset rules
6. **Generic UI** - Metrics specific to sites
7. **No Dependencies** - Cannot enforce upload order
8. **Limited Tracking** - No file-to-table mapping

---

## Recommended Approach for Extension

### Phase 1: Abstraction Layer
- Create generic data transformation pipeline
- Extract column mapping into configuration
- Build rule engine for validation

### Phase 2: Schema Extension
- Create new dataset tables
- Add foreign key relationships
- Create correlation tracking tables

### Phase 3: Multi-File Support
- Extend upload interface for multiple files
- Create file-to-dataset mapping
- Implement job coordination

### Phase 4: Correlation Logic
- Build join/correlation engine
- Implement cross-table validation
- Add reconciliation features

### Phase 5: UI Enhancement
- Dynamic metrics calculation
- Relationship visualization
- Conflict resolution interface

---

## Conclusion

Dynalis currently implements a **well-architected single-dataset batch upload system** with excellent error handling, performance optimization, and user experience. The composable-based Vue 3 architecture is a solid foundation for refactoring.

**For adding 2 more datasets with correlation support**, you would need to:
1. Abstract away hardcoded column names
2. Create generic transformation and validation engines
3. Redesign database schema with relationships
4. Implement multi-file upload and job coordination
5. Build correlation validation and reconciliation logic
6. Enhance UI for relationship visualization

**Estimated complexity increase:** 3-5x more code, new architectural concerns around data dependencies and consistency.

---

## Generated Documentation

This investigation produced:

1. **dynalis_architecture_analysis.md** - Comprehensive 600+ line technical analysis
2. **dynalis_architecture_diagrams.md** - 7 visual ASCII diagrams of system flow
3. **INVESTIGATION_SUMMARY.md** - This executive summary

All available in `/tmp/` directory.
