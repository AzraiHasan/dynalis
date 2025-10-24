# Dynalis System Architecture - Visual Diagrams

## 1. Data Flow Diagram (End-to-End Pipeline)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DYNALIS UPLOAD PIPELINE                             │
└─────────────────────────────────────────────────────────────────────────────┘

STEP 1: FILE SELECTION
┌──────────────────────────────┐
│     dataupload.vue           │
│  ┌──────────────────────┐    │
│  │ Drag & Drop / Click  │    │
│  └──────────────────────┘    │
│         ↓                     │
│  ┌──────────────────────┐    │
│  │ Validate Extension   │    │
│  │ (.csv, .xlsx, .xls)  │    │
│  └──────────────────────┘    │
│         ↓                     │
│  File State Ready             │
└────────┬──────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│    STEP 2: PARSE & STAGE     │
│     useFileUpload.ts         │
│  ┌──────────────────────┐    │
│  │ Read file content    │    │
│  │ (CSV/Excel)          │    │
│  └──────────────────────┘    │
│         ↓                     │
│  ┌──────────────────────┐    │
│  │ Parse headers        │    │
│  │ (Column names)       │    │
│  └──────────────────────┘    │
│         ↓                     │
│  ┌──────────────────────┐    │
│  │ Batch processing     │    │
│  │ (100 rows/batch)     │    │
│  └──────────────────────┘    │
│         ↓                     │
│  ┌──────────────────────┐    │
│  │ Store in localStorage│    │
│  │ uploadedFileData     │    │
│  └──────────────────────┘    │
└────────┬──────────────────────┘
         │
         ↓
┌──────────────────────────────┐
│   STEP 3: PREVIEW & REVIEW   │
│     datastaging.vue          │
│  ┌──────────────────────┐    │
│  │ Load from localStorage   │  │
│  │ Extract first 5 rows │    │
│  └──────────────────────┘    │
│         ↓                     │
│  ┌──────────────────────┐    │
│  │ Calculate metrics:   │    │
│  │ - Total rows         │    │
│  │ - Missing values     │    │
│  │ - Financial totals   │    │
│  │ - Expiration dates   │    │
│  └──────────────────────┘    │
│         ↓                     │
│  ┌──────────────────────┐    │
│  │ Show data quality    │    │
│  │ per column           │    │
│  └──────────────────────┘    │
│         ↓                     │
│  Ready for Commit?           │
└────────┬──────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────┐
│    STEP 4: CREATE UPLOAD JOB                     │
│   handleCommitData() in datastaging.vue          │
│  ┌──────────────────────────────────────────┐   │
│  │ Check for incomplete uploads              │   │
│  │ Query upload_jobs (status: created|...)   │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Resume or Start Fresh?                    │   │
│  │ IF exists: resumeUpload()                 │   │
│  │ ELSE: startAsyncProcessing()              │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Create upload_jobs record                │   │
│  │ - status: "queued"                        │   │
│  │ - total_chunks: batches count             │   │
│  │ - chunks_received: 0                      │   │
│  │ - Return: jobId                           │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Store in localStorage:                    │   │
│  │ bg_upload_${jobId}                        │   │
│  │ ├─ transformedData (SiteInsert[])        │   │
│  │ ├─ batchSize: 250                         │   │
│  │ ├─ batches count                          │   │
│  │ └─ jobId                                  │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  Job created → Navigate to Dashboard             │
└────────┬──────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────┐
│  STEP 5: BACKGROUND JOB PROCESSING               │
│  processBackgroundJob(jobId)                     │
│  ┌──────────────────────────────────────────┐   │
│  │ Retrieve data from localStorage          │   │
│  │ bg_upload_${jobId}                       │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Deduplicate by site_id:                  │   │
│  │ - Map: site_id → SiteInsert              │   │
│  │ - Keep last occurrence                   │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Loop through batches (250 rows each):     │   │
│  │   FOR i = 0 TO total_batches:            │   │
│  │     1. Extract batch data                │   │
│  │     2. Call: process_sites_batch(data)   │   │
│  │     3. Update progress                   │   │
│  │     4. Handle errors                     │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  All batches processed ✓                         │
└────────┬──────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────┐
│  STEP 6: DATABASE INSERTION (RPC)                │
│  PostgreSQL: process_sites_batch()               │
│  ┌──────────────────────────────────────────┐   │
│  │ Parse JSONB input (batch data)           │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Create TEMP table with deduplication:    │   │
│  │ - DISTINCT ON (site_id)                  │   │
│  │ - Keep last occurrence                   │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ UPSERT into sites table:                 │   │
│  │ INSERT INTO sites (...)                  │   │
│  │ ON CONFLICT (site_id)                    │   │
│  │ DO UPDATE SET (...)                      │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Return: count of processed rows          │   │
│  │ Drop: temporary table                    │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Result: New/updated records in sites table ✓   │
└────────┬──────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────┐
│  STEP 7: JOB COMPLETION                          │
│  Update upload_jobs record                       │
│  ┌──────────────────────────────────────────┐   │
│  │ Set status: "complete"                   │   │
│  │ Set completed_at: NOW()                  │   │
│  │ Set processed_records: final count       │   │
│  │ Clear localStorage: bg_upload_${jobId}   │   │
│  └──────────────────────────────────────────┘   │
│         ↓                                        │
│  ┌──────────────────────────────────────────┐   │
│  │ Dashboard reflects updates                │   │
│  │ (new/updated records visible)            │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ✓ UPLOAD PIPELINE COMPLETE                     │
└──────────────────────────────────────────────────┘
```

---

## 2. Database Schema Relationship Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                            │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐
│         upload_jobs         │
├─────────────────────────────┤
│ ┌─ id (UUID, PK)            │
│ ├─ user_id (UUID)           │
│ ├─ filename (TEXT)          │
│ ├─ status (TEXT)            │◄─── "created"|"queued"|
│ │                           │     "processing"|"complete"|
│ ├─ total_chunks (INT)       │     "error"|"cancelled"
│ ├─ chunks_received (INT)    │
│ ├─ processed_records (INT)  │
│ ├─ error_message (TEXT)     │
│ ├─ created_at               │
│ ├─ updated_at               │
│ └─ completed_at             │
└────────────┬────────────────┘
             │
             │ (1:N)
             │ FK: id
             │
             ↓
┌─────────────────────────────┐
│   upload_job_records        │
├─────────────────────────────┤
│ ┌─ id (UUID, PK)            │
│ ├─ job_id (UUID, FK)────────┼──→ upload_jobs
│ ├─ site_id (UUID, FK)───────┼──→ sites
│ ├─ created_at               │
│ └─ UNIQUE(job_id, site_id)  │
└─────────────────────────────┘


┌─────────────────────────────────────────┐
│              sites                      │
├─────────────────────────────────────────┤
│ ┌─ id (UUID, PK)                        │
│ ├─ site_id (TEXT, UNIQUE)               │
│ │                                       │
│ ├─ exp_date (DATE)                      │
│ ├─ total_rental (DECIMAL(12,2))        │
│ ├─ total_payment_to_pay (DECIMAL...)   │
│ ├─ deposit (DECIMAL(12,2))             │
│ │                                       │
│ ├─ created_at (TIMESTAMPTZ)            │
│ ├─ updated_at (TIMESTAMPTZ)            │
│ └─ cancelled_upload (BOOLEAN)          │
│                                         │
│ Indexes:                                │
│ - idx_sites_site_id (site_id)          │
│ - idx_sites_exp_date (exp_date)        │
│                                         │
│ RLS: Authenticated users can           │
│      read/insert/update                │
└─────────────────────────────────────────┘
```

**Relationships:**
- `upload_job_records.job_id` ← `upload_jobs.id` (One job to many records)
- `upload_job_records.site_id` ← `sites.id` (Many jobs to one site)
- Junction table for tracking which sites belong to which uploads

---

## 3. Component Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT STRUCTURE                           │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│         App.vue / Layout                   │
└────────────────┬───────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    ↓            ↓            ↓
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ index.vue│  │dashboard │  │ dataupload   │
│ (Auth)   │  │   .vue   │  │   .vue       │
└──────────┘  └────┬─────┘  │              │
                   │        │  ┌────────┐  │
                   │        │  │Stepper │  │
                   │        │  └────────┘  │
                   │        │              │
                   │        │ Step 1:      │
                   │        │ File Select  │
                   │        │              │
                   │        │ Step 2:      │
                   │        │ Validate     │
                   │        │              │
                   │        └──────┬───────┘
                   │               │
                   │               ↓
                   │        ┌──────────────────┐
                   │        │ datastaging.vue  │
                   │        │                  │
                   │        │ ┌──────────────┐ │
                   │        │ │ Metrics View │ │
                   │        │ └──────────────┘ │
                   │        │ ┌──────────────┐ │
                   │        │ │ Chat (stub)  │ │
                   │        │ └──────────────┘ │
                   │        │                  │
                   │        │ [Commit Data]    │
                   │        └──────┬───────────┘
                   │               │
                   │               ↓
                   │        (Navigate to Dashboard)
                   │
                   └──────────────┬──────────────┐
                                  │              │
                   ┌──────────────┴──────────────┐
                   │                             │
                   ↓                             ↓
        ┌──────────────────┐       ┌──────────────────────┐
        │ useUploadState   │       │ useBatchUploadService│
        └──────────────────┘       └──────────────────────┘
        ├─ isUploading            ├─ processBulkUpload
        ├─ progress               ├─ startAsyncProcessing
        ├─ status                 ├─ processBackgroundJob
        ├─ statusMessage          ├─ resumeUpload
        ├─ error                  ├─ cancelUpload
        │                         ├─ getJobStatus
        └─ [methods]              └─ [methods]
                                     │
        ┌──────────────────┐         │
        │ useFileUpload    │         │
        └──────────────────┘         │
        ├─ processAndUpload          │
        ├─ parseFile                 │
        └─ processBatch              │
                                     │
        ┌──────────────────┐         │
        │ useSiteData      │         │
        └──────────────────┘         │
        ├─ fetchData                 │
        └─ caching logic             │
                                     ↓
        ┌──────────────────────────────────────┐
        │    Supabase PostgreSQL Database       │
        ├──────────────────────────────────────┤
        │ ├─ sites table                        │
        │ ├─ upload_jobs table                  │
        │ ├─ upload_job_records table           │
        │ ├─ process_sites_batch() RPC          │
        │ └─ mark_cancelled_upload_records()    │
        └──────────────────────────────────────┘
```

---

## 4. State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│              STATE MANAGEMENT FLOW                           │
└─────────────────────────────────────────────────────────────┘

USER INTERACTION
     │
     ├─→ File Select
     │   └─→ dataupload.vue (local state)
     │       ├─ selectedFileName
     │       ├─ dragActive
     │       ├─ errorMessage
     │       └─ currentStep (ref)
     │
     ├─→ Process File
     │   └─→ useFileUpload.ts (service)
     │       ├─ uploadState
     │       │  ├─ status (preparing→uploading→complete)
     │       │  ├─ progress
     │       │  └─ error
     │       │
     │       └─ localStorage: uploadedFileData
     │           ├─ fileData[]
     │           ├─ headers[]
     │           └─ fileName
     │
     ├─→ Review Data
     │   └─→ datastaging.vue (local state)
     │       ├─ fileData (from localStorage)
     │       ├─ metrics (computed from fileData)
     │       ├─ expirationMetrics (computed)
     │       └─ messages[] (chat)
     │
     └─→ Commit Data
         └─→ useBatchUploadService.ts (service)
             ├─ state: BatchUploadState
             │  ├─ status (preparing→uploading→processing→complete)
             │  ├─ progress (0-100)
             │  ├─ totalBatches
             │  ├─ processedBatches
             │  ├─ processedRecords
             │  └─ uploadJobId
             │
             ├─→ Database: upload_jobs (create record)
             │   └─ Job tracking with status updates
             │
             ├─→ localStorage: bg_upload_${jobId}
             │   ├─ transformedData[]
             │   ├─ batchSize
             │   ├─ batches count
             │   └─ jobId
             │
             └─→ useUploadState.ts (UI state)
                 ├─ isUploading (reactive boolean)
                 ├─ progress (0-100)
                 ├─ status (idle→preparing→uploading→...)
                 ├─ statusMessage
                 └─ error (Error | null)
                 
                 └─→ Dashboard observes these values
                     └─ Displays progress in real-time
```

---

## 5. Data Transformation Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│          DATA TRANSFORMATION PIPELINE                         │
└──────────────────────────────────────────────────────────────┘

RAW FILE (CSV/Excel)
┌────────────────────────────────────┐
│ SITE ID | EXP DATE | TOTAL RENTAL..│
│ 1001    | 12/01/24 | RM 10,000     │
│ 1002    | 15/02/24 | RM 15,500.50  │
│ 1002    | 15/02/24 | RM 15,600     │ ← Duplicate
│ 1003    |    -     | RM 20,000     │
│ NULL    | 01/03/24 | RM 5,000      │
└────────────────────────────────────┘
         │
         ↓ parseFile() [useFileUpload.ts]
         │
FileRow[] (JavaScript objects)
┌────────────────────────────────────────────────┐
│ {                                              │
│   "SITE ID": "1001",                           │
│   "EXP DATE": "12/01/24",                      │
│   "TOTAL RENTAL (RM)": "RM 10,000",           │
│   ...                                          │
│ },                                             │
│ {                                              │
│   "SITE ID": "1002",                           │
│   "EXP DATE": "15/02/24",                      │
│   "TOTAL RENTAL (RM)": "RM 15,500.50",        │
│ },                                             │
│ ...                                            │
└────────────────────────────────────────────────┘
         │
         ↓ Stored in localStorage
         │
         ↓ handleCommitData() retrieves
         │
         ↓ processBulkUpload() transforms
         │
SiteInsert[] (Database-ready format)
┌────────────────────────────────────────────────┐
│ {                                              │
│   site_id: "1001",                             │
│   exp_date: "2024-01-12",           ← ISO     │
│   total_rental: 10000,              ← Number  │
│   total_payment_to_pay: 0,                     │
│   deposit: 0,                                  │
│   updated_at: "2024-10-24T10:30:00Z"          │
│ },                                             │
│ {                                              │
│   site_id: "1002",                             │
│   exp_date: "2024-02-15",                      │
│   total_rental: 15600,          ← Latest copy │
│   total_payment_to_pay: 0,                     │
│   deposit: 0,                                  │
│   updated_at: "2024-10-24T10:30:00Z"          │
│ },                                             │
│ {                                              │
│   site_id: "1003",                             │
│   exp_date: null,               ← Invalid date│
│   total_rental: 20000,                         │
│   total_payment_to_pay: 0,                     │
│   deposit: 0,                                  │
│   updated_at: "2024-10-24T10:30:00Z"          │
│ },                                             │
│ {                                              │
│   site_id: "NO ID",             ← Default    │
│   exp_date: "2024-03-01",                      │
│   total_rental: 5000,                          │
│   total_payment_to_pay: 0,                     │
│   deposit: 0,                                  │
│   updated_at: "2024-10-24T10:30:00Z"          │
│ }                                              │
└────────────────────────────────────────────────┘
         │
         ↓ Deduplicate by site_id (keep latest)
         │ Remove duplicate "1002" (first occurrence)
         │
         ↓ Batch to 250 records per RPC call
         │
         ↓ Call: process_sites_batch(JSONB)
         │
DATABASE INSERTION (PostgreSQL RPC)
┌────────────────────────────────────┐
│ 1. Parse JSONB input               │
│ 2. Create TEMP table with          │
│    DISTINCT ON (site_id)           │
│ 3. UPSERT to sites table           │
│    ON CONFLICT (site_id)           │
│    DO UPDATE SET (...)             │
│ 4. Return row count                │
└────────────────────────────────────┘
         │
         ↓
FINAL sites TABLE
┌────────────────────────────────────┐
│ id | site_id | exp_date | ...      │
├────────────────────────────────────┤
│ ..│ 1001    | 2024-01-12           │
│ ..│ 1002    | 2024-02-15           │ ← Updated
│ ..│ 1003    | NULL                 │
│ ..│ NO ID   | 2024-03-01           │
└────────────────────────────────────┘

✓ Duplicates removed
✓ Invalid dates preserved as NULL
✓ Missing IDs handled
✓ Deduplicated by latest occurrence
```

---

## 6. Error Recovery Flow

```
┌──────────────────────────────────────────────────────┐
│        ERROR DETECTION & RECOVERY FLOW               │
└──────────────────────────────────────────────────────┘

USER NAVIGATES TO COMMIT
         │
         ↓
checkIncompleteUploads() [useBatchUploadService]
         │
         ├─ Query upload_jobs WHERE status IN
         │  ("created", "uploading", "processing")
         │
         ↓
┌──────────────────────────┐
│ Incomplete uploads found?│
└──────────┬───────────────┘
           │
      YES  │  NO
      ┌────┴────┐
      ↓         ↓
   ┌────┐  ┌──────────────┐
   │Ask │  │ Start Fresh  │
   │User│  │              │
   └─┬──┘  │ Create new   │
     │     │ upload_jobs  │
     ↓     │ record       │
┌─────────┐│ status:      │
│Resume?  ││ "queued"     │
└────┬────┘└──────┬───────┘
     │            │
  YES│ NO         │
  ┌──┴──┐    ┌────┴──────────────┐
  │     │    │                   │
  ↓     ↓    ↓                   ↓
┌──────────────┐        ┌────────────────┐
│resumeUpload()│        │startAsync      │
│              │        │Processing()    │
│ 1. Get job   │        │                │
│    details   │        │ 1. Create job  │
│ 2. Continue  │        │ 2. Transform   │
│    from last │        │    data        │
│    batch     │        │ 3. Store in    │
│ 3. Process   │        │    localStorage│
│    remaining │        │ 4. Fire async  │
│    batches   │        │    processor   │
└──────┬───────┘        └────────┬───────┘
       │                         │
       └────────────┬────────────┘
                    │
                    ↓
         processBackgroundJob()
         ┌──────────────────────────┐
         │ 1. Get data from LS       │
         │ 2. Update status to       │
         │    "processing"           │
         │ 3. Loop batches:          │
         │    ├─ Extract batch       │
         │    ├─ Call RPC            │
         │    ├─ Update progress     │
         │    └─ Catch errors        │
         │ 4. Mark complete          │
         └────────┬───────────────────┘
                  │
         ERROR?   │
         ┌────────┴────────┐
         │                 │
      YES│ NO              ↓
      ┌──┴────┐        ✓ COMPLETE
      │        │
      ↓        ↓
recordUploadError()
      │
      ├─ Update upload_jobs
      │  status = "error"
      │  error_message = msg
      │
      └─ Continue on dashboard
         with error state

USER VIEW:
─────────
On datastaging.vue:
- If errors exist: Show "Interrupted Upload"
  prompt to resume
- If none: "Commit Data" creates fresh job
- All progress visible in dashboard
```

---

## 7. Current Limitations for Multi-Dataset Extension

```
┌─────────────────────────────────────────────────────────────┐
│    CURRENT SINGLE-DATASET ARCHITECTURE LIMITS               │
└─────────────────────────────────────────────────────────────┘

CURRENT STATE:
┌──────────────────────────────────────┐
│      ONE FILE → ONE DATASET          │
│                                      │
│ CSV/Excel                            │
│     ↓                                │
│ FileRow[] (generic columns)          │
│     ↓                                │
│ Transform to SiteInsert[]            │
│     ↓                                │
│ sites table (fixed schema)           │
│     ↓                                │
│ Dashboard (sites only)               │
└──────────────────────────────────────┘

LIMITATIONS FOR 2+ DATASETS:
───────────────────────────

1. COLUMN MAPPING
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - Column names are hard-coded    │
   │   ("SITE ID", "EXP DATE", etc.)  │
   │ - No way to route to different   │
   │   tables                         │
   │                                 │
   │ Solution Needed:                 │
   │ - Dynamic column mapping         │
   │ - Per-dataset field definitions  │
   │ - Configuration layer            │
   └─────────────────────────────────┘

2. SCHEMA FLEXIBILITY
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - Transform hardcoded for sites  │
   │ - SiteInsert type specific       │
   │ - No generic data structure      │
   │                                 │
   │ Solution Needed:                 │
   │ - Generic data types             │
   │ - Per-dataset Insert types       │
   │ - Dynamic transformation rules   │
   └─────────────────────────────────┘

3. FILE HANDLING
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - One file at a time             │
   │ - Sequential processing          │
   │ - No correlation tracking        │
   │                                 │
   │ Solution Needed:                 │
   │ - Multi-file upload              │
   │ - Batch job for multiple files   │
   │ - File identification            │
   │ - Parallel/sequential loading    │
   └─────────────────────────────────┘

4. DATA CORRELATION
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - No foreign keys                │
   │ - No join logic                  │
   │ - Dedup only by site_id          │
   │ - No validation across tables    │
   │                                 │
   │ Solution Needed:                 │
   │ - Foreign key definitions        │
   │ - Join/correlation keys          │
   │ - Cross-table validation         │
   │ - Data reconciliation            │
   └─────────────────────────────────┘

5. VALIDATION RULES
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - Column name detection fragile  │
   │ - Date format hardcoded          │
   │ - Currency format specific       │
   │ - No dataset-specific rules      │
   │                                 │
   │ Solution Needed:                 │
   │ - Rule engine per dataset        │
   │ - Custom format support          │
   │ - Type-aware validation          │
   │ - Error classification           │
   └─────────────────────────────────┘

6. UI COMPLEXITY
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - Metrics hardcoded for sites    │
   │ - No relationship visualization  │
   │ - Cannot show correlations       │
   │ - Chat doesn't understand data   │
   │                                 │
   │ Solution Needed:                 │
   │ - Dynamic metric calculation     │
   │ - Relationship display           │
   │ - Correlation warnings           │
   │ - Smart suggestions              │
   └─────────────────────────────────┘

7. JOB TRACKING
   ┌─────────────────────────────────┐
   │ Problem:                         │
   │ - One job per upload             │
   │ - No file-to-table mapping       │
   │ - No correlation job tracking    │
   │                                 │
   │ Solution Needed:                 │
   │ - Multi-file job tracking        │
   │ - File-to-dataset mapping table  │
   │ - Correlation processing jobs    │
   │ - Batch status reporting         │
   └─────────────────────────────────┘
```

---

## Conclusion

The current architecture is **single-dataset optimized** with hardcoded column names, fixed database schema, and direct transformation logic. Supporting multiple datasets with correlation would require:

1. Schema abstraction layer
2. Dynamic column mapping system
3. Generic data transformation pipeline
4. Correlation/join logic
5. Enhanced validation framework
6. Multi-file job coordination
7. More complex UI for relationship visualization

The current composable-based architecture is good foundation for refactoring into multi-dataset support.
