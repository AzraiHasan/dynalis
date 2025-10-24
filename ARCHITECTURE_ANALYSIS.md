# Dynalis Data Upload System - Architecture Analysis

## Executive Summary

Dynalis is currently designed as a **single-dataset batch upload system** for site rental and payment data. The system supports uploading CSV/Excel files, validating data quality, staging for review, and processing through background jobs with comprehensive tracking.

---

## Part 1: Current Single Dataset Structure

### 1.1 Data Model - "Sites" Dataset

The system currently handles ONE data structure stored in the `sites` table:

```
SITES TABLE SCHEMA:
├── id (UUID) - Primary Key
├── site_id (TEXT) - Unique identifier for site
├── exp_date (DATE) - Contract expiration date
├── total_rental (DECIMAL(12,2)) - Total rental amount in RM
├── total_payment_to_pay (DECIMAL(12,2)) - Outstanding payment
├── deposit (DECIMAL(12,2)) - Security deposit
├── created_at (TIMESTAMPTZ) - Record creation time
├── updated_at (TIMESTAMPTZ) - Last modified time
└── cancelled_upload (BOOLEAN) - Cancellation flag
```

**File Format Expected:**
```
CSV/Excel columns (case-sensitive):
- SITE ID
- EXP DATE
- TOTAL RENTAL (RM)
- TOTAL PAYMENT TO PAY (RM)
- DEPOSIT (RM)
```

**Key Characteristics:**
- Single primary dataset representing rental sites
- SITE ID is the unique identifier across the system
- All financial data in Malaysian Ringgit (RM)
- Date-based expiration tracking for contract renewal management
- Financial metrics (rental, payment, deposits) aggregated for dashboarding

---

## Part 2: Upload Pipeline - End-to-End Flow

### 2.1 Component Architecture

```
USER INTERFACE FLOW:
1. dataupload.vue (Step 1 & 2)
   └── File selection/upload
   └── File parsing & validation

2. useFileUpload.ts (Composable)
   └── File parsing (CSV/Excel via PapaParse/XLSX)
   └── Data validation checks
   └── localStorage staging

3. datastaging.vue (Preview & Review)
   └── Data quality metrics
   └── Expiration analysis
   └── Financial summaries
   └── AI chat interface (placeholder)

4. useBatchUploadService.ts (Core Service)
   └── Batch processing logic
   └── Job tracking
   └── Background processing

5. database (Supabase PostgreSQL)
   └── sites table
   └── upload_jobs table
   └── upload_job_records table
   └── PostgreSQL stored procedures
```

### 2.2 Detailed Upload Workflow

#### Step 1: File Selection & Validation (dataupload.vue)
```
User Actions:
1. Select CSV/Excel file via drag-drop or file picker
2. System validates:
   - File extension (.csv, .xlsx, .xls)
   - File size (formatted for display)

Processing:
- File stored in component state
- Filename captured
- Ready for next step
```

#### Step 2: File Parsing & Local Storage (useFileUpload.ts)
```
Execution: processAndUpload(file)

Steps:
1. Parse file based on extension:
   - CSV: Using PapaParse with header=true
   - Excel: Using XLSX library

2. Extract Headers:
   - Column names from first row
   - Keys become object properties

3. Batch Processing (in-memory):
   - Batch size: 100 rows per chunk
   - Prevents memory overload
   - Updates progress (5% + 90% batched)

4. Data Storage:
   - Stores in localStorage as JSON
   - Structure:
     {
       fileData: FileRow[],
       headers: string[],
       fileName: string
     }

Output: FileRow[] (array of objects with column headers as keys)
```

#### Step 3: Data Preview & Validation (datastaging.vue)
```
Display Phase:
1. Retrieve data from localStorage
2. Show summary statistics:
   - Total rows
   - Total columns
   - Missing values count
   - Dash values ("-") count

3. Data Quality Checks per Column:
   - Empty cells counter
   - Invalid entries detector
   - For "date" columns: Validates against DATE_FORMATS
   - For financial columns: Validates currency format
   - For "id" columns: Checks for spaces

4. Calculated Metrics:
   - Total Sites: Count of valid SITE IDs
   - Missing Sites: Count of null/empty SITE IDs
   - Total Rental: Sum of TOTAL RENTAL (RM)
   - Total Payment To Pay: Sum of TOTAL PAYMENT TO PAY (RM)
   - Total Deposit: Sum of DEPOSIT (RM)

5. Expiration Analysis:
   - Expired: daysUntilExpiration <= 0
   - Within 30 Days: 0 < days <= 30
   - Within 60 Days: 30 < days <= 60
   - Within 90 Days: 60 < days <= 90
   - Invalid Dates: Cannot be parsed
```

#### Step 4: Commit Data - Background Job Creation
```
Entry Point: handleCommitData() in datastaging.vue

Process:
1. Retrieve data from localStorage
2. Check for incomplete uploads:
   - Query upload_jobs table
   - Status: "created" or "uploading"
   - Optionally filter by filename

3. Resume or Start Fresh:
   - IF incomplete exists: Ask user to resume
     └── resumeUpload(jobId, data)
   - ELSE: Start new job
     └── startAsyncProcessing(data, fileName)

4. Job Creation:
   const { data: job } = await supabase
     .from("upload_jobs")
     .insert({
       filename,
       total_chunks: batches,
       status: "queued",
       chunks_received: 0,
       processed_records: 0
     })

5. Store in localStorage:
   localStorage.setItem(`bg_upload_${jobId}`, {
     transformedData,
     batchSize: 250,
     batches,
     jobId,
     fileName
   })

6. Trigger Background Processing:
   processBackgroundJob(jobId) - fires asynchronously
```

#### Step 5: Data Transformation
```
Transform Step (In useBatchUploadService.ts):

Input: FileRow (raw CSV/Excel data)
Output: SiteInsert (database-ready format)

Transformation Rules:
1. SITE ID → site_id
   - Convert to string
   - Default to "NO ID" if empty

2. EXP DATE → exp_date
   - Parse using parseDate() utility
   - Convert to ISO string
   - Allow NULL if unparseable

3. TOTAL RENTAL (RM) → total_rental
   - Remove currency prefix, commas, spaces: /[RM,\s]/g
   - Parse as float
   - Default to 0 if empty

4. TOTAL PAYMENT TO PAY (RM) → total_payment_to_pay
   - Same as total_rental

5. DEPOSIT (RM) → deposit
   - Same as total_rental

6. updated_at
   - Set to current timestamp
```

#### Step 6: Batch Processing & Database Insert
```
Background Job Execution: processBackgroundJob(jobId)

Algorithm:
1. Retrieve transformed data from localStorage
2. Deduplicate by site_id:
   - Create Map: site_id → SiteInsert
   - Keep latest occurrence of duplicate
   - Convert Map to array

3. Update job status to "processing"

4. Batch loop:
   for i = 0 to batches:
     a. Extract batch (250 records per batch)
     b. Call RPC function: process_sites_batch(data)
     c. Update job progress:
        - chunks_received = i + 1
        - processed_records = cumulative count
     d. Handle errors with recordUploadError()

5. Mark job complete:
   - status = "complete"
   - chunks_received = total_batches
   - processed_records = final count
   - completed_at = NOW()

6. Cleanup localStorage:
   - Remove `bg_upload_${jobId}`

Return: { success: true, processedRecords, jobId }
```

#### Step 7: PostgreSQL Stored Procedure - process_sites_batch
```sql
FUNCTION: process_sites_batch(data JSONB)
RETURNS: TEXT (count message)

Logic:
1. Create temporary table from JSONB input
2. Parse JSON array with deduplication:
   - Extract fields: site_id, exp_date, total_rental, 
                     total_payment_to_pay, deposit
   - Use DISTINCT ON (site_id) to keep latest
   - Order by ordinality DESC (reverse order keeps last)

3. UPSERT into sites table:
   INSERT INTO sites (...) 
   SELECT ... FROM temp_sites
   ON CONFLICT (site_id)
   DO UPDATE SET:
     - exp_date = EXCLUDED.exp_date
     - total_rental = EXCLUDED.total_rental
     - total_payment_to_pay = EXCLUDED.total_payment_to_pay
     - deposit = EXCLUDED.deposit
     - updated_at = NOW()

4. Return row count
5. Drop temporary table on commit
```

---

## Part 3: Data Storage & Tracking

### 3.1 Database Tables

#### Table 1: sites
```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT UNIQUE NOT NULL,          -- Natural key
  exp_date DATE,
  total_rental DECIMAL(12,2) DEFAULT 0,
  total_payment_to_pay DECIMAL(12,2) DEFAULT 0,
  deposit DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_upload BOOLEAN DEFAULT FALSE,
  
  -- Indexes for queries
  INDEX idx_sites_site_id (site_id),
  INDEX idx_sites_exp_date (exp_date)
);

-- Row Level Security: authenticated users can read/insert/update
```

#### Table 2: upload_jobs
```sql
CREATE TABLE upload_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  filename TEXT NOT NULL,
  status TEXT DEFAULT 'created',
    -- Values: created | queued | uploading | processing | complete | error | cancelled
  total_chunks INTEGER NOT NULL,
  chunks_received INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tracks upload progress and status
-- One record per upload session
```

#### Table 3: upload_job_records
```sql
CREATE TABLE upload_job_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES upload_jobs(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT upload_job_records_job_site_unique UNIQUE (job_id, site_id)
);

-- Links individual site records to upload jobs
-- Used for tracking which sites were uploaded in which job
-- Needed for cancellation and reconciliation
```

### 3.2 Upload Job State Machine

```
Created → Queued → Processing → Complete
         ↓         ↓             ↓
      (Started)  (Running)   (Success)
         ↓
       Error/Cancelled ← (User action or failure)

Status Transitions:
1. "created" - Job record created, initial state
2. "queued" - Ready for background processing
3. "processing" - Background job actively processing batches
4. "complete" - All batches processed successfully
5. "error" - Failed during processing, error_message populated
6. "cancelled" - User cancelled via UI
```

### 3.3 How Data is Correlated Currently

**Current System: NO CORRELATION**

The system only manages ONE dataset (sites). All fields are from a single source:
- All data comes from one upload file
- All site data is stored in one table
- No relationships to other datasets
- UPSERT by site_id ensures no duplicates

**Unique Key Strategy:**
- `site_id` is the UNIQUE constraint
- When same site_id is uploaded again, previous record is updated
- Ensures data consistency and prevents duplicates

---

## Part 4: Validation & Quality Checks

### 4.1 File-Level Validation (dataupload.vue)

```javascript
// Extension validation
validExtensions = [".csv", ".xlsx", ".xls"]

// File size check
fileSizeMB = file.size / (1024 * 1024)
// Displayed as KB or MB
```

### 4.2 Column-Level Validation

```javascript
// Per-column analysis:
1. Empty Cells: Count null/undefined/empty string values
2. Irregular Cells: Count invalid data types/formats

// Smart Type Detection (column name-based):
if (columnLower.includes("date")) {
  validates against DATE_FORMATS array
  DATE_FORMATS = [
    "dd/MM/yyyy", "dd-MM-yyyy", "yyyy/MM/dd", 
    "yyyy-MM-dd", "MM/dd/yyyy", "MM-dd-yyyy"
  ]
}

if (columnLower.includes("rental|payment|deposit")) {
  validates currency format: /^(RM\s*)?[\d,]+(\.\d{2})?$/
}

if (columnLower.includes("id")) {
  checks for spaces and non-empty
}
```

### 4.3 Data Quality Metrics

```
Displayed on datastaging.vue:
- Total Rows
- Total Columns
- Missing Values (all columns combined)
- Dash Values (cells with "-", "–", "—")
- Per-column breakdown:
  * Empty cells count
  * Irregularities count
  * Color coding (green if 0, warning if > 0)
```

---

## Part 5: Key Design Patterns

### 5.1 Composables Architecture

All business logic is in composables following Vue 3 Composition API:

```
useBatchUploadService.ts
├── State Management
│   └── BatchUploadState (status, progress, error, etc.)
├── Job Lifecycle
│   ├── createUploadJob()
│   ├── updateUploadJobProgress()
│   ├── completeUploadJob()
│   └── recordUploadError()
├── Data Processing
│   ├── processBulkUpload() - Main batch upload
│   ├── resumeUpload() - Resume interrupted uploads
│   ├── startAsyncProcessing() - Background job
│   └── processBackgroundJob() - Background execution
├── Job Status
│   ├── checkIncompleteUploads()
│   ├── getUploadJobDetails()
│   └── getJobStatus()
└── Cancellation
    └── cancelUpload()

useUploadState.ts
├── isUploading (computed)
├── progress (0-100)
├── status (idle | preparing | uploading | processing | complete | error)
├── statusMessage (user-facing message)
├── error (Error object)
└── Methods
    ├── startUpload()
    ├── updateProgress()
    ├── finishUpload()
    └── setError()

useFileUpload.ts
├── File parsing
│   ├── parseFile() - CSV/Excel detection
│   ├── processBatch() - In-memory batching
│   └── processAndUpload() - Main entry point
└── localStorage management

useSiteData.ts
├── Fetch data with caching
├── 5-minute cache expiry
├── Error handling
└── Force refresh option
```

### 5.2 State Flow

```
Component (dataupload.vue)
    ↓
useFileUpload.ts (parse & stage locally)
    ↓
localStorage.uploadedFileData
    ↓
Component (datastaging.vue)
    ↓
useBatchUploadService.ts (create job)
    ↓
upload_jobs table (job creation)
    ↓
localStorage.bg_upload_${jobId} (store transformed data)
    ↓
Background Processing (processBackgroundJob)
    ↓
RPC: process_sites_batch()
    ↓
sites table (UPSERT records)
    ↓
dashboard.vue (display results)
```

### 5.3 Error Handling & Recovery

```
Error Scenarios Handled:
1. File parsing errors
   └── Caught in useFileUpload.ts
   └── Displayed in errorMessage on dataupload.vue

2. Data transformation errors
   └── Caught in useBatchUploadService.ts
   └── Recorded in upload_jobs.error_message

3. Upload interruption
   └── Detected via upload_jobs status check
   └── User prompted to resume or start fresh
   └── resumeUpload() continues from last chunk

4. Background job failure
   └── recordUploadError() called
   └── upload_jobs.status = "error"
   └── Error accessible in dashboard

5. Cancellation
   └── mark_cancelled_upload_records() RPC
   └── upload_job_records used to identify records
   └── Sites marked with cancelled_upload = TRUE
```

---

## Part 6: Current Limitations

### 6.1 Single Dataset Architecture
- Only handles ONE input file at a time
- One data model (sites)
- Cannot correlate with other data sources
- No multi-file batch processing

### 6.2 Limited Correlation Capability
- No foreign key relationships to other tables
- No join operations in UI
- No linked data validation
- Deduplication only by site_id (single key)

### 6.3 Staging & Preview
- Basic data quality checks
- No cross-dataset validation
- AI chat is placeholder only
- Cannot suggest data corrections based on correlations

### 6.4 Scalability Considerations
- Batch size: 250 records per RPC call
- localStorage has size limits (~5-10MB typical)
- No streaming file upload
- Entire file loaded into memory
- Single background job per upload

### 6.5 Validation Rules
- Column name-based detection (fragile)
- Limited date format support (6 formats)
- Currency format assumes RM or numbers
- No custom validation rules per dataset

---

## Part 7: Current Type Definitions

```typescript
// FileRow - Input data from CSV/Excel
interface FileRow {
  [key: string]: string | number | null | undefined;
  "SITE ID"?: string | number | null;
  "EXP DATE"?: string | null;
  "TOTAL RENTAL (RM)"?: string | number | null;
  "TOTAL PAYMENT TO PAY (RM)"?: string | number | null;
  "DEPOSIT (RM)"?: string | number | null;
}

// Site - Database schema
interface Site {
  id: string;                    // UUID
  site_id: string;               // From "SITE ID" column
  exp_date: string | null;       // ISO date or null
  total_rental: number;          // Decimal as number
  total_payment_to_pay: number;
  deposit: number;
  created_at: string;            // TIMESTAMPTZ
  updated_at: string;
}

// SiteInsert - For database operations
type SiteInsert = Omit<Site, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
}

// BatchUploadState - Service state
interface BatchUploadState {
  status: "idle" | "preparing" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  error: Error | null;
  totalBatches: number;
  processedBatches: number;
  processedRecords: number;
  uploadJobId?: string;
  abortController?: AbortController;
}
```

---

## Part 8: Summary - Single Dataset Architecture

### What Works Well
1. **Clean separation**: UI components → Composables → Database
2. **Progress tracking**: Real-time updates during batch processing
3. **Error recovery**: Can resume interrupted uploads
4. **Data validation**: Multi-level checks (file, column, type)
5. **Performance**: Batch processing prevents memory issues
6. **Deduplication**: UPSERT by unique site_id
7. **Background processing**: Doesn't block UI

### What Needs to Change for Multi-Dataset
1. **Database schema**: New tables for each dataset type
2. **File mapping**: Detect and route file columns to correct dataset
3. **Correlation logic**: Join tables based on common keys
4. **Validation rules**: Per-dataset column mapping
5. **Type safety**: Typed interfaces for each dataset
6. **Job tracking**: Track multiple file uploads in one session
7. **Data reconciliation**: Handle foreign key constraints
8. **UI complexity**: Show relationships and correlations

---

## Conclusion

Dynalis currently implements a **robust single-dataset batch upload system** with excellent error handling, progress tracking, and background processing capabilities. The architecture is well-designed for its current scope but would require significant structural changes to support multiple datasets and data correlation, particularly:

1. New database tables and relationships
2. Multiple input file handlers
3. Correlation/join logic
4. Enhanced validation framework
5. More complex UI for relationship visualization
6. Job management for multiple datasets

The composables pattern is excellent for refactoring into multi-dataset support.
