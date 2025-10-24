# Dynalis Data Upload System - Investigation Index

This directory now contains comprehensive documentation about the Dynalis system architecture, specifically focused on understanding the current single-dataset upload system and the complexities of extending it to support multiple datasets with data correlation.

## Generated Documentation Files

### 1. INVESTIGATION_SUMMARY.md (14 KB)
**Executive Summary - Start Here**

Quick overview of:
- System purpose and scope
- Single dataset structure (SITES table)
- 7-step upload pipeline
- Database tables and relationships
- Key complexities for multi-dataset extension
- Current system strengths and limitations
- Recommended phased approach for extension

**Best For:** Quick understanding, presentations, management briefs

---

### 2. ARCHITECTURE_ANALYSIS.md (19 KB)
**Comprehensive Technical Deep-Dive**

8-part detailed analysis:
1. Current single dataset structure (SITES table schema)
2. End-to-end upload pipeline with step details
3. Data storage and tracking mechanisms
4. Validation and quality checks
5. Key design patterns and architecture
6. Current limitations
7. Type definitions
8. Summary of strengths/weaknesses

Includes detailed code examples and SQL structures.

**Best For:** Developers, architects, implementation planning

---

### 3. ARCHITECTURE_DIAGRAMS.md (42 KB)
**Visual System Flow Diagrams**

7 ASCII diagrams showing:
1. Complete end-to-end data flow pipeline
2. Database schema relationships
3. Component architecture structure
4. State management flow
5. Data transformation pipeline (input to output)
6. Error recovery and retry flow
7. Current limitations for multi-dataset extension

Each diagram includes detailed annotations and explanations.

**Best For:** Visual learners, presentations, understanding flow

---

## Quick Reference: Key Findings

### Current System Architecture

**Type:** Single-dataset batch upload system for site rental/payment data

**Primary Dataset:** SITES
```
- site_id (unique identifier)
- exp_date (contract expiration)
- total_rental, total_payment_to_pay, deposit (financial metrics)
```

**Input Format:** CSV/Excel with specific column names (case-sensitive)
```
SITE ID | EXP DATE | TOTAL RENTAL (RM) | TOTAL PAYMENT TO PAY (RM) | DEPOSIT (RM)
```

**Processing Pipeline:** 7 Steps
1. File selection and validation
2. Parse and store locally (100-row batches)
3. Preview and quality checks
4. Job creation and coordination
5. Background batch processing (250-row batches)
6. PostgreSQL RPC insertion with UPSERT
7. Job completion and dashboard update

**Database Tables:** 3
- `sites` - Main rental data
- `upload_jobs` - Job tracking with progress
- `upload_job_records` - Junction table for tracking

---

## Critical Insights for Multi-Dataset Extension

### Why It's Complex:

1. **Hardcoded Column Names**
   - Field names are hard-coded throughout ("SITE ID", "EXP DATE")
   - No configuration/mapping layer
   - Different datasets need different fields

2. **Fixed Transformation Logic**
   - `processBulkUpload()` only transforms to SiteInsert type
   - Validation rules specific to sites (dates, currency in RM)
   - Metrics calculation hardcoded for sites table

3. **Single File at a Time**
   - Only one file per upload session
   - Cannot correlate multiple files simultaneously
   - No file-to-dataset mapping

4. **No Data Correlation**
   - No foreign key relationships
   - No join operations
   - Deduplication only by site_id within single table
   - No cross-table validation

5. **UI is Dataset-Specific**
   - Metrics hardcoded for sites (rental sums, expiration analysis)
   - Preview layout specific to 5 site columns
   - Cannot show relationships or correlations

---

## Architecture Strengths

1. **Clean Component Structure** - Excellent separation via Vue 3 Composables
2. **Error Recovery** - Can resume interrupted uploads
3. **Performance** - In-memory and RPC batching prevents memory issues
4. **Progress Tracking** - Real-time updates during background processing
5. **Type Safety** - TypeScript throughout
6. **Deduplication** - Automatic duplicate handling by natural key
7. **Background Processing** - Non-blocking UI during long operations

---

## Recommended Approach for Adding 2 More Datasets

### Phase 1: Abstraction Layer
- Extract column names to configuration
- Create generic transformation pipeline
- Build rule engine for validation

### Phase 2: Database Schema
- Create new tables for datasets 2 & 3
- Add foreign key relationships
- Create correlation tracking

### Phase 3: Multi-File Support
- Extend upload interface
- Implement file-to-dataset routing
- Coordinate batch processing

### Phase 4: Correlation Logic
- Build join/validation engine
- Implement cross-table validation
- Add reconciliation features

### Phase 5: UI Enhancement
- Dynamic metrics calculation
- Relationship visualization
- Conflict resolution

**Estimated effort:** 3-5x current code volume with new architectural concerns

---

## Files Investigated

### UI Components (2)
- `app/pages/dataupload.vue` (665 lines)
- `app/pages/datastaging.vue` (775 lines)

### Business Logic (4)
- `app/composables/useBatchUploadService.ts` (688 lines)
- `app/composables/useFileUpload.ts` (163 lines)
- `app/composables/useUploadState.ts` (48 lines)
- `app/composables/useSiteData.ts` (47 lines)

### Database & Types (3)
- `app/types/supabase.ts` (26 lines)
- `app/utils/supabaseService.ts` (121 lines)
- `app/utils/dateUtils.ts` (54 lines)

### Database Migrations (6)
- `supabase/migrations/20250324051048_create_sites_table.sql`
- `supabase/migrations/20250324070815_create_upload_tracking.sql`
- `supabase/migrations/20250324070927_create_upload_jobs.sql`
- `supabase/migrations/20250324071118_add_bulk_upload_function.sql`
- `supabase/migrations/20250325035054_mark_cancelled_upload_records.sql`
- `supabase/migrations/20250325053634_process_sites_batch.sql`

---

## How to Use These Documents

### For Project Managers
- Read INVESTIGATION_SUMMARY.md (sections 1-3, 8-9)
- Understand scope and complexity
- Use recommended phased approach

### For Developers Extending the System
1. Start with INVESTIGATION_SUMMARY.md for overview
2. Study ARCHITECTURE_ANALYSIS.md Part 2 (Upload Pipeline)
3. Review ARCHITECTURE_DIAGRAMS.md for visual understanding
4. Study current code using this as reference

### For Architects Designing Multi-Dataset Support
1. Read INVESTIGATION_SUMMARY.md carefully
2. Study ARCHITECTURE_ANALYSIS.md entirely
3. Review ARCHITECTURE_DIAGRAMS.md extensively
4. Focus on "Key Complexities" and "Recommended Approach"
5. Use as basis for new architecture design

### For Code Reviews
- Reference current patterns in ARCHITECTURE_ANALYSIS.md Part 5
- Compare new code to documented architecture
- Use as standardization guide

---

## Key Metrics

| Aspect | Current System |
|--------|----------------|
| Datasets Supported | 1 (sites) |
| Tables | 3 (sites, upload_jobs, upload_job_records) |
| File Types | CSV, Excel (.csv, .xlsx, .xls) |
| Batch Size (in-memory) | 100 rows |
| Batch Size (RPC) | 250 rows |
| Date Formats Supported | 6 formats |
| Deduplication Key | site_id (unique) |
| State Layers | 4 (component, composable, localStorage, database) |
| Validation Types | File, column, type |
| Error Recovery | Yes (upload resumption) |

---

## Conclusion

This investigation reveals a **well-architected single-dataset system** that would require **significant refactoring** to support multiple datasets with correlation. The good news: the Vue 3 Composables pattern is an excellent foundation for abstraction and reuse.

**Next Steps:**
1. Use these documents as architectural reference
2. Plan multi-dataset extension following recommended phases
3. Create abstraction layer before adding new datasets
4. Implement generic transformation and validation engines
5. Redesign database schema with relationships

---

Generated: October 24, 2025
Investigation Scope: Complete upload pipeline, database schema, type definitions, and architectural patterns
