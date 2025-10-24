# DOSM CPI Data Integration Plan

**Branch:** `dosm_demo`
**Target Data Source:** https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv
**Implementation Approach:** Option B - Separate Module with File Upload
**Estimated Effort:** 3-4 hours

---

## Table of Contents

1. [Overview](#overview)
2. [Data Analysis](#data-analysis)
3. [Architecture Decisions](#architecture-decisions)
4. [Implementation Plan](#implementation-plan)
5. [File Structure](#file-structure)
6. [Data Models](#data-models)
7. [API Endpoints](#api-endpoints)
8. [UI Components](#ui-components)
9. [Testing Strategy](#testing-strategy)
10. [Timeline](#timeline)

---

## Overview

### Objective
Integrate Malaysia's Consumer Price Index (CPI) annual inflation data from DOSM (Department of Statistics Malaysia) into the Dynalis platform as a separate analytics module.

### Current System
- **Architecture:** Client-side only (SSR disabled)
- **Data Storage:** localStorage (demo mode)
- **File Processing:** PapaParse for CSV, XLSX for Excel
- **Current Limits:** 5MB (artificial demo limit)

### Target Integration
- **Data Type:** CPI annual inflation (time-series economic data)
- **File Size:** ~50 KB (~355 rows)
- **Format:** CSV with 3 columns (date, division, inflation)
- **Upload Method:** File upload (user downloads CSV from DOSM, then uploads)
- **Update Frequency:** Annual (government data)

---

## Data Analysis

### CSV Structure
```csv
date,division,inflation
1961-01-01,overall,-0.18040772163184782
1962-01-01,overall,0.10844026784821992
1963-01-01,overall,3.10525365608334
...
```

### Columns
| Column | Type | Description |
|--------|------|-------------|
| `date` | TEXT | ISO date format (YYYY-MM-DD), January 1st of each year |
| `division` | TEXT | Category identifier (`overall`, `01`-`13`) |
| `inflation` | REAL | Inflation rate (percentage, can be negative) |

### Data Characteristics
- **Date Range:** 1961 - 2024 (64 years)
- **Divisions:**
  - `overall` - Aggregate inflation across all categories
  - `01` to `13` - Regional or sectoral breakdowns
- **Row Count:** ~355 rows
- **Data Quality:** Official government statistics (high quality)

---

## Architecture Decisions

### Decision 1: Storage Strategy
**Choice:** Client-side localStorage (consistent with current demo mode)

**Rationale:**
- ✅ Maintains consistency with existing architecture
- ✅ No server infrastructure needed immediately
- ✅ Fast access for small dataset (50KB)
- ✅ Suitable for reference data that updates infrequently
- ⚠️ Future: Can migrate to SQLite when backend is implemented

**Alternative Considered:** Server-side SQLite
- Would require full backend implementation
- Overkill for current demo mode
- Can be added later without major refactor

### Decision 2: Data Input Method
**Choice:** File upload (user downloads CSV from DOSM, then uploads via file input)

**Rationale:**
- ✅ Reuses existing file upload infrastructure (`useFileUpload.ts`)
- ✅ Consistent with existing site data workflow
- ✅ User has full control over data source/version
- ✅ Works offline after initial download
- ✅ No CORS or network issues
- ✅ Minimal new code required

**Alternative Considered:** Direct URL fetch
- Would require new URL fetching composable
- Network dependency for every refresh
- CORS potential issues
- More complex error handling for network failures

### Decision 3: Module Structure
**Choice:** Separate standalone module (Option B)

**Rationale:**
- ✅ Clean separation from site management features
- ✅ Different data schema (inflation vs. site rental)
- ✅ Different use case (analytics vs. CRUD)
- ✅ Easier to maintain and extend
- ✅ Can be developed/tested independently

### Decision 4: UI Integration
**Choice:** New dedicated page (`/cpi-analytics`)

**Rationale:**
- ✅ Focused analytics interface
- ✅ Doesn't clutter existing upload workflow
- ✅ Room for data visualizations
- ✅ Can add to navigation menu

---

## Implementation Plan

### Phase 1: Data Layer (1-2 hours)

#### 1.1 Create Data Types
**File:** `app/types/cpi.ts`

```typescript
export interface CPIRecord {
  date: string;          // ISO date format
  division: string;      // 'overall' or '01'-'13'
  inflation: number;     // Inflation rate
}

export interface CPIDataset {
  records: CPIRecord[];
  lastUpdated: string;   // Timestamp of last fetch
  source: string;        // URL of data source
  metadata: {
    dateRange: { start: string; end: string };
    divisions: string[];
    recordCount: number;
  };
}
```

#### 1.2 Create Composable for CPI Data Management
**File:** `app/composables/useCPIData.ts`

**Responsibilities:**
- Adapt uploaded file data to CPI format
- Validate CPI CSV structure (date, division, inflation columns)
- Cache in localStorage
- Provide data access methods
- Handle data queries and filtering

**Key Functions:**
- `processCPIFile(file: File)` - Leverage existing `useFileUpload` for parsing
- `validateCPIStructure(data)` - Ensure required columns exist
- `getCachedData()` - Retrieve from localStorage
- `getOverallInflation()` - Filter for overall category
- `getDivisionInflation(division)` - Filter by division
- `getYearRange(startYear, endYear)` - Date range filter

#### 1.3 Create Store for CPI Data
**File:** `app/stores/cpiStore.ts`

**State:**
- `cpiData: CPIDataset | null`
- `isLoading: boolean`
- `error: Error | null`
- `lastFetchedAt: Date | null`

**Actions:**
- `loadData()` - Load from cache or uploaded file
- `setUploadedData(data)` - Store uploaded CPI data
- `clearData()` - Clear cache

### Phase 2: Storage & Validation Layer (0.5 hour)

#### 2.1 localStorage Management
**File:** `app/utils/cpiStorage.ts`

**Functions:**
- `saveCPIData(data)` - Save to localStorage
- `loadCPIData()` - Load from localStorage
- `clearCPIData()` - Remove from localStorage
- `getCacheAge()` - Calculate cache age

**Storage Key:** `dynalis-cpi-data`

### Phase 3: UI Components (2-3 hours)

#### 3.1 Main CPI Analytics Page
**File:** `app/pages/cpi-analytics.vue`

**Sections:**
1. **Header**
   - Title: "CPI Inflation Analytics"
   - Data source info (link to DOSM)
   - Instructions: "Download CSV from DOSM and upload below"
   - Last uploaded timestamp

2. **File Upload Section**
   - File input (accepts .csv files)
   - Upload button with loading state
   - Reuse existing `useFileUpload` composable
   - Validation: Check for required columns (date, division, inflation)

3. **Data Status Card**
   - Record count
   - Date range
   - Upload timestamp
   - Clear data button

4. **Data Table**
   - Sortable columns (date, division, inflation)
   - Filterable by division
   - Search by year
   - Export to CSV option

5. **Visualizations** (Optional - Nice to have)
   - Line chart: Overall inflation trend over time
   - Bar chart: Latest inflation by division
   - Summary statistics

#### 3.2 Reusable Components

**File:** `app/components/CPI/DataTable.vue`
- Display CPI data in sortable table
- Column sorting
- Pagination (50 rows per page)
- Export functionality

**File:** `app/components/CPI/StatusCard.vue`
- Show data status
- Upload timestamp
- Loading states
- Error display

**File:** `app/components/CPI/InflationChart.vue` (Optional)
- Chart.js integration
- Time-series line chart
- Division comparison

#### 3.3 Navigation Integration
**File:** `app/layouts/default.vue` (or navigation component)

Add menu item:
```vue
<ULink to="/cpi-analytics">
  CPI Analytics
</ULink>
```

### Phase 4: Error Handling & Edge Cases (0.5 hour)

#### Error Scenarios
1. **Invalid File Type**
   - Only accept .csv files
   - Show clear error message
   - Provide link to correct file format

2. **Invalid CSV Structure**
   - Validate column names (date, division, inflation)
   - Check data types
   - Show validation errors with examples

3. **Empty File**
   - Handle gracefully
   - Show "File contains no data" message

4. **File Too Large**
   - Check file size (should be < 5MB for demo)
   - Show size limit error

5. **localStorage Full**
   - Clear old data
   - Show storage warning

### Phase 5: Polish & Documentation (0.5 hour)

1. **Code Documentation**
   - JSDoc comments for public functions
   - Type documentation
   - Usage examples

2. **User Documentation**
   - Update CLAUDE.md with new module info
   - Add comments in code

3. **Demo Mode Integration**
   - Ensure works in demo mode
   - Add sample data if needed

---

## File Structure

```
dynalis/
├── app/
│   ├── components/
│   │   └── CPI/
│   │       ├── DataTable.vue           # CPI data table component
│   │       ├── StatusCard.vue          # Data status display
│   │       └── InflationChart.vue      # Chart visualization (optional)
│   │
│   ├── composables/
│   │   ├── useCPIData.ts              # Main CPI data composable
│   │   └── (reuses useFileUpload.ts)  # Existing file upload
│   │
│   ├── pages/
│   │   └── cpi-analytics.vue          # Main CPI analytics page
│   │
│   ├── stores/
│   │   └── cpiStore.ts                # CPI data store
│   │
│   ├── types/
│   │   └── cpi.ts                     # CPI type definitions
│   │
│   └── utils/
│       └── cpiStorage.ts              # localStorage utilities
│
└── docs/
    └── dosm-cpi-integration-plan.md   # This document
```

---

## Data Models

### Type Definitions

```typescript
// app/types/cpi.ts

/**
 * Single CPI inflation record
 */
export interface CPIRecord {
  date: string;          // ISO 8601 date (YYYY-MM-DD)
  division: string;      // 'overall' or '01' through '13'
  inflation: number;     // Inflation rate (can be negative)
}

/**
 * Complete CPI dataset with metadata
 */
export interface CPIDataset {
  records: CPIRecord[];
  lastUpdated: string;   // ISO timestamp of last upload
  fileName: string;      // Uploaded file name
  metadata: {
    dateRange: {
      start: string;     // Earliest date in dataset
      end: string;       // Latest date in dataset
    };
    divisions: string[]; // Unique division codes
    recordCount: number; // Total number of records
  };
}

/**
 * Upload status tracking
 */
export interface CPIUploadStatus {
  isLoading: boolean;
  error: Error | null;
  lastUpload: Date | null;
  fileName: string | null;
}

/**
 * Filter options for CPI data queries
 */
export interface CPIFilters {
  division?: string;     // Filter by division
  startYear?: number;    // Filter by year range
  endYear?: number;
  sortBy?: 'date' | 'division' | 'inflation';
  sortOrder?: 'asc' | 'desc';
}
```

### Storage Schema

```typescript
// localStorage structure
{
  "dynalis-cpi-data": {
    "records": CPIRecord[],
    "lastUpdated": "2024-10-24T15:30:00Z",
    "fileName": "cpi_2d_annual_inflation.csv",
    "metadata": {
      "dateRange": {
        "start": "1961-01-01",
        "end": "2024-01-01"
      },
      "divisions": ["overall", "01", "02", ..., "13"],
      "recordCount": 355
    }
  }
}
```

---

## API Endpoints

### Current Phase: Client-Side Only

No server endpoints needed for initial implementation.

### Future Phase: Server-Side (Optional)

If backend is implemented later:

#### `GET /api/cpi/data`
- Returns cached CPI data
- Query params: `?division=overall&startYear=2020&endYear=2024`

#### `POST /api/cpi/upload`
- Accepts file upload from client
- Validates and processes CPI data
- Stores in database
- Returns processed data summary

#### `GET /api/cpi/metadata`
- Returns dataset metadata only
- Useful for cache validation

---

## UI Components

### Page: CPI Analytics (`/cpi-analytics`)

```vue
<template>
  <div class="container mx-auto p-6">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold">CPI Inflation Analytics</h1>
      <p class="text-gray-600">
        Malaysia Consumer Price Index - Annual Inflation Data
      </p>
      <UAlert class="mt-4" color="blue" variant="soft">
        Download CSV from <a href="https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv"
        target="_blank" class="underline">DOSM</a> and upload below
      </UAlert>
    </header>

    <!-- File Upload Section -->
    <div v-if="!hasData" class="mb-8">
      <input
        type="file"
        accept=".csv"
        @change="handleFileUpload"
        ref="fileInput"
      />
      <UButton
        :loading="isUploading"
        @click="processFile"
        :disabled="!selectedFile"
      >
        Upload CPI Data
      </UButton>
    </div>

    <!-- Status Card (shown after upload) -->
    <CPIStatusCard
      v-if="hasData"
      :last-updated="lastUpdated"
      :record-count="recordCount"
      :file-name="fileName"
      @clear="clearData"
    />

    <!-- Filters -->
    <div v-if="hasData" class="my-6">
      <USelect
        v-model="selectedDivision"
        :options="divisions"
        placeholder="Filter by division"
      />
    </div>

    <!-- Data Table -->
    <CPIDataTable
      v-if="hasData"
      :data="filteredData"
      :loading="isLoading"
      @export="exportData"
    />

    <!-- Chart (Optional) -->
    <CPIInflationChart
      v-if="hasData && chartData"
      :data="chartData"
      class="mt-8"
    />
  </div>
</template>
```

### Component: Status Card

**Features:**
- Upload timestamp display
- File name display
- Record count badge
- Date range display
- Clear data button
- Error display

### Component: Data Table

**Features:**
- Sortable columns (click header to sort)
- Sticky header
- Responsive design
- Export to CSV button
- Loading skeleton
- Empty state

### Component: Chart (Optional)

**Chart Types:**
1. **Line Chart** - Overall inflation trend
2. **Bar Chart** - Division comparison
3. **Scatter Plot** - Correlation analysis

---

## Testing Strategy

### Manual Testing Checklist

#### File Upload & Processing
- [ ] File upload works for .csv files
- [ ] Data is correctly parsed
- [ ] Data is cached in localStorage
- [ ] Cache is loaded on page refresh
- [ ] Re-upload replaces existing data
- [ ] Invalid file types rejected
- [ ] Invalid CSV structure detected

#### Data Display
- [ ] Table shows all records
- [ ] Sorting works for all columns
- [ ] Filters work correctly
- [ ] Export generates valid CSV
- [ ] Loading states display properly
- [ ] Empty state displays when no data

#### Edge Cases
- [ ] Large file handling (within 5MB limit)
- [ ] Empty CSV file
- [ ] localStorage full scenario
- [ ] Corrupted cache data
- [ ] Browser with localStorage disabled

#### Browser Compatibility
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari

#### Demo Mode
- [ ] Works in demo mode
- [ ] Data persists across sessions
- [ ] Clear demo data removes CPI data

### Future: Automated Tests

```typescript
// Example test structure
describe('useCPIData', () => {
  it('uploads and parses CPI file', async () => {})
  it('validates CSV structure', async () => {})
  it('caches data in localStorage', async () => {})
  it('filters by division', () => {})
  it('handles invalid file types', async () => {})
})
```

---

## Timeline

### Day 1: Core Implementation (3-4 hours)

**Hour 1: Data Layer**
- ✅ Create type definitions (`app/types/cpi.ts`)
- ✅ Create localStorage utilities (`app/utils/cpiStorage.ts`)
- ✅ Create CPI store (`app/stores/cpiStore.ts`)

**Hour 2: Business Logic**
- ✅ Implement CPI data composable (`app/composables/useCPIData.ts`)
- ✅ Integrate with existing `useFileUpload` composable
- ✅ Add CSV validation for CPI structure
- ✅ Add error handling

**Hour 3: Basic UI**
- ✅ Create main page (`app/pages/cpi-analytics.vue`)
- ✅ Add file upload interface
- ✅ Implement status card component
- ✅ Add basic data table

**Hour 4: Testing & Polish** (Optional)
- ✅ Manual testing
- ✅ Fix bugs
- ✅ Add loading states
- ✅ Error messages
- ✅ Add filtering and sorting

### Enhancement Phase (1-2 hours) - Optional

**Hour 1: Visualization**
- Integrate Chart.js
- Create line chart for overall inflation trends
- Add bar chart for division comparison
- Add interactivity

---

## Future Enhancements

### Phase 2 Features (Post-Demo)
1. **Server-Side Integration**
   - Migrate to SQLite storage
   - Scheduled data refresh
   - API endpoints

2. **Advanced Analytics**
   - Trend analysis
   - Forecasting (simple moving average)
   - Division comparisons
   - Year-over-year changes

3. **Multiple Datasets**
   - Add more DOSM datasets
   - Cross-dataset analysis
   - Unified analytics dashboard

4. **Export Options**
   - PDF reports
   - Excel with formatting
   - Chart images

5. **User Preferences**
   - Save filter preferences
   - Custom date ranges
   - Favorite divisions

---

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ Upload CPI CSV file
- ✅ Parse and validate CSV structure
- ✅ Cache in localStorage
- ✅ Display in sortable table
- ✅ Show upload status and metadata
- ✅ Clear/re-upload functionality
- ✅ Basic error handling

### Nice to Have
- 📊 Data visualization (charts)
- 📥 Export to CSV
- 🔍 Advanced filtering
- 📱 Mobile responsive
- 🎨 Polished UI/UX

### Quality Standards
- 🔒 Type-safe (no `any` types without ESLint disable)
- 📝 Well-documented code
- 🐛 Error boundaries
- ♿ Accessible UI components
- 🚀 Fast load times (< 2 seconds)

---

## Notes

### Design Decisions Log

**2024-10-24:** Initial plan created
- Chose client-side implementation for consistency with demo mode
- Decided on separate module (Option B) for clean architecture
- Selected file upload approach to reuse existing infrastructure
- Deferred server-side storage to future phase
- Prioritized simplicity over feature completeness

### Open Questions

1. **Should we add authentication?**
   - Current answer: No, CPI data is public reference data
   - Future: May add user preferences (requires auth)

2. **Should we support direct URL fetch in addition to file upload?**
   - Current answer: No, file upload only for MVP
   - Future: May add URL fetch option for convenience

3. **Should we support multiple DOSM datasets?**
   - Current answer: No, start with single dataset
   - Future: Generalize for multiple datasets

---

## References

- **DOSM Data Source:** https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv
- **DOSM Official Site:** https://www.dosm.gov.my/
- **PapaParse Documentation:** https://www.papaparse.com/docs
- **Nuxt UI Components:** https://ui.nuxt.com/

---

**Document Version:** 1.0
**Last Updated:** 2024-10-24
**Author:** Claude Code
**Status:** Draft → Ready for Implementation
