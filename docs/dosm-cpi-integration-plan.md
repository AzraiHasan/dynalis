# DOSM CPI Data Integration Plan

**Branch:** `dosm_demo`
**Target Data Source:** https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv
**Implementation Approach:** 3-Step Upload Flow + Full Dashboard (Similar to dataupload.vue)
**Estimated Effort:** 6-8 hours

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
**Choice:** 3-Step Upload Flow (`/dosmupload`) + Full Dashboard (`/dosm-dashboard`)

**Rationale:**
- ✅ Consistent user experience with existing site data workflow
- ✅ Familiar 3-step pattern: Upload → Validate → Review & Commit
- ✅ Separate upload and analytics concerns
- ✅ Full-featured dashboard for data exploration
- ✅ Sidebar navigation integration (below dataupload button)
- ✅ Professional data management workflow

**Architecture:**
- `/dosmupload` - 3-step file upload flow (similar to dataupload.vue)
  - Step 1: File Upload with drag & drop
  - Step 2: Data Validation with strict checks
  - Step 3: Review & Commit with basic statistics
- `/dosm-dashboard` - Full analytics dashboard
  - Multiple chart types (line, bar, comparison)
  - Advanced filtering and date range selection
  - Export functionality
  - Data table with sorting

---

## Implementation Plan

### Phase 1: Data Layer & Foundation (1.5 hours)

#### 1.1 Create Type Definitions
**File:** `app/types/cpi.ts`

```typescript
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
 * Validation error for CPI data
 */
export interface CPIValidationError {
  row: number;
  column: string;
  value: any;
  error: string;
}

/**
 * Column validation result
 */
export interface CPIColumnValidation {
  emptyCells: number;
  invalidCells: number;
  errors: CPIValidationError[];
}

/**
 * Basic statistics for Step 3 Review
 */
export interface CPIBasicStats {
  totalRecords: number;
  dateRange: { start: string; end: string };
  numberOfDivisions: number;
  latestYear: string;
}
```

#### 1.2 Create localStorage Utilities
**File:** `app/utils/cpiStorage.ts`

**Functions:**
- `saveCPIData(data: CPIDataset)` - Save to localStorage
- `loadCPIData(): CPIDataset | null` - Load from localStorage
- `clearCPIData()` - Remove from localStorage
- `getCacheAge(): number` - Calculate cache age in milliseconds

**Storage Key:** `dynalis-cpi-data`

#### 1.3 Create CPI Store
**File:** `app/stores/cpiStore.ts`

**State:**
- `cpiData: CPIDataset | null`
- `isLoading: boolean`
- `error: Error | null`
- `lastUploadedAt: Date | null`

**Actions:**
- `loadFromCache()` - Load data from localStorage
- `setUploadedData(data: CPIRecord[], fileName: string)` - Process and store uploaded data
- `clearData()` - Clear cache and reset state
- `getBasicStats(): CPIBasicStats` - Calculate statistics for Step 3

### Phase 2: Validation & Business Logic (1.5 hours)

#### 2.1 Create CPI Data Composable
**File:** `app/composables/useCPIData.ts`

**Key Functions:**
- `processCPIFile(file: File): Promise<CPIRecord[]>` - Parse CSV using PapaParse
- `validateCPIStructure(data: any[]): CPIValidationError[]` - Strict validation:
  - Check required columns exist (date, division, inflation)
  - Validate date format (ISO YYYY-MM-DD)
  - Validate division values ('overall' or '01'-'13')
  - Validate inflation is numeric (can be negative)
  - Check for empty/missing values
- `getColumnValidation(column: string, data: any[]): CPIColumnValidation`
- `calculateBasicStats(records: CPIRecord[]): CPIBasicStats`
- `filterByDivision(division: string): CPIRecord[]`
- `filterByDateRange(start: string, end: string): CPIRecord[]`

### Phase 3: Upload Page - 3-Step Flow (2-3 hours)

#### 3.1 Create Upload Page
**File:** `app/pages/dosmupload.vue`

**Step 1: File Upload**
- Drag & drop file upload zone (similar to dataupload.vue)
- File type validation (.csv only)
- File size display
- "Process File" button
- Error message display
- Info card: "Download CSV from DOSM and upload here"

**Step 2: Data Validation**
- Summary statistics cards:
  - Total Rows
  - Total Columns (should be 3)
  - Missing Values count
  - Invalid Values count
- Data preview table (first 5 rows)
- Column quality check cards (one per column):
  - Empty cells count
  - Invalid cells count
  - Validation errors list
- Data quality alert (warning if issues detected)
- Navigation: Back to Upload | Continue to Review

**Step 3: Review & Commit**
- Basic Statistics cards:
  - Total Records
  - Date Range (earliest to latest year)
  - Number of Divisions
  - Latest Year Available
- Data type information card
- Navigation: Back to Validation | Commit Data & Continue
- On commit: Save to cpiStore, redirect to `/dosm-dashboard`

#### 3.2 Create Upload Components
**File:** `app/components/DOSM/UploadZone.vue`
- Reusable drag & drop upload component
- File selection state management
- Visual feedback for drag events

**File:** `app/components/DOSM/ValidationCard.vue`
- Display column validation results
- Empty/invalid cell counts
- Error list display

**File:** `app/components/DOSM/StatsCard.vue`
- Display basic statistics for Step 3
- Icon + metric value + description layout

### Phase 4: Dashboard Page - Full Analytics (2-3 hours)

#### 4.1 Create Dashboard Page
**File:** `app/pages/dosm-dashboard.vue`

**Header Section:**
- Page title: "DOSM CPI Analytics Dashboard"
- Metadata display:
  - Last uploaded: [timestamp]
  - Record count: [number]
  - Date range: [start] - [end]
- "Upload New Data" button (redirects to /dosmupload)

**Filter Controls Section:**
- Division selector dropdown (overall, 01-13)
- Date range picker (start year - end year)
- "Reset Filters" button
- "Export Data" button

**Charts Section:**
- Large line chart: Overall inflation trend over time (primary chart)
- Bar chart: Latest year inflation by division
- Multi-line comparison chart: Compare multiple divisions
- Optional: Year-over-year change chart

**Data Table Section:**
- Sortable columns (date, division, inflation)
- Pagination (50 rows per page)
- Search/filter integration
- Export to CSV functionality

**No Data State:**
- Empty state message: "No CPI data available"
- Button: "Upload CPI Data" → redirects to /dosmupload

#### 4.2 Create Dashboard Components

**File:** `app/components/DOSM/InflationLineChart.vue`
- Line chart for inflation trends
- Chart.js integration (already installed)
- Responsive design
- Tooltip with formatted values

**File:** `app/components/DOSM/DivisionBarChart.vue`
- Bar chart for division comparison
- Latest year data or selected year
- Color-coded bars

**File:** `app/components/DOSM/ComparisonChart.vue`
- Multi-line chart for division comparison
- Legend with division selection
- Toggle divisions on/off

**File:** `app/components/DOSM/CPIDataTable.vue`
- Full-featured data table
- Sorting, filtering, pagination
- Export functionality
- Responsive design

**File:** `app/components/DOSM/DashboardHeader.vue`
- Metadata display
- Action buttons
- Status indicators

### Phase 5: Navigation & Integration (0.5 hour)

#### 5.1 Update Navigation
**File:** `app/layouts/default.vue` (or relevant navigation component)

Add sidebar links below dataupload:
```vue
<ULink to="/dosmupload" icon="i-lucide-upload">
  DOSM Upload
</ULink>
<ULink to="/dosm-dashboard" icon="i-lucide-chart-line">
  DOSM Dashboard
</ULink>
```

#### 5.2 Add Route Guards (if needed)
- Check if CPI data exists before allowing dashboard access
- Redirect to /dosmupload if no data

### Phase 6: Polish, Testing & Documentation (1 hour)

#### 6.1 Error Handling
- File upload errors
- Validation errors with clear messages
- localStorage full error
- Network errors (if any)

#### 6.2 Loading States
- File processing spinner
- Chart loading skeletons
- Table loading states

#### 6.3 Empty States
- No data uploaded yet
- No records match filters
- Missing columns in CSV

#### 6.4 Documentation
- Update CLAUDE.md with new module
- JSDoc comments for all public functions
- README for DOSM module (optional)

#### 6.5 Testing
- Manual testing of 3-step flow
- Validation with various CSV formats
- Dashboard filtering and charts
- Export functionality
- Browser compatibility

---

## File Structure

```
dynalis/
├── app/
│   ├── components/
│   │   └── DOSM/                       # DOSM-specific components
│   │       ├── UploadZone.vue         # File upload drag & drop
│   │       ├── ValidationCard.vue     # Step 2 validation display
│   │       ├── StatsCard.vue          # Step 3 statistics display
│   │       ├── DashboardHeader.vue    # Dashboard metadata header
│   │       ├── InflationLineChart.vue # Line chart for trends
│   │       ├── DivisionBarChart.vue   # Bar chart for divisions
│   │       ├── ComparisonChart.vue    # Multi-line comparison
│   │       └── CPIDataTable.vue       # Full-featured data table
│   │
│   ├── composables/
│   │   ├── useCPIData.ts              # CPI data logic & validation
│   │   └── (reuses useFileUpload.ts)  # Existing file processing
│   │
│   ├── pages/
│   │   ├── dosmupload.vue             # 3-step upload flow
│   │   └── dosm-dashboard.vue         # Full analytics dashboard
│   │
│   ├── stores/
│   │   └── cpiStore.ts                # CPI data store (separate from site data)
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

**New Files:** 10 files
- 2 pages (dosmupload.vue, dosm-dashboard.vue)
- 8 components (DOSM folder)
- 1 composable (useCPIData.ts)
- 1 store (cpiStore.ts)
- 1 type file (cpi.ts)
- 1 utility file (cpiStorage.ts)

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

### Page: DOSM Upload (`/dosmupload`)

**Layout:** 3-step stepper with progressive disclosure (similar to dataupload.vue)

```vue
<template>
  <div>
    <UCard class="mb-6">
      <template #header>
        <h1 class="text-xl font-semibold">DOSM CPI Data Upload</h1>
      </template>

      <!-- Step Indicator -->
      <UStepper v-model="currentStep" :items="stepItems" class="mb-6" />

      <!-- Step 1: File Upload -->
      <div v-if="currentStep === 1" class="space-y-4">
        <!-- Drag & drop upload zone -->
        <!-- File selection display -->
        <!-- Process button -->
        <!-- Info card about data source -->
      </div>

      <!-- Step 2: Data Validation -->
      <div v-if="currentStep === 2" class="space-y-6">
        <!-- Summary statistics cards -->
        <!-- Data preview table (first 5 rows) -->
        <!-- Column quality check cards -->
        <!-- Data quality alert -->
        <!-- Navigation buttons -->
      </div>

      <!-- Step 3: Review & Commit -->
      <div v-if="currentStep === 3" class="space-y-6">
        <!-- Basic statistics cards -->
        <!-- Data type information -->
        <!-- Commit button -->
      </div>
    </UCard>
  </div>
</template>
```

**Key Features:**
- UStepper component for step navigation
- Disabled stepper until file is processed
- Progressive validation (can't skip steps)
- On commit: Save to cpiStore, redirect to /dosm-dashboard

### Page: DOSM Dashboard (`/dosm-dashboard`)

**Layout:** Full dashboard with header, filters, charts, and data table

```vue
<template>
  <div class="container mx-auto p-6">
    <!-- Header Section -->
    <DOSMDashboardHeader
      :last-updated="cpiStore.lastUploadedAt"
      :record-count="cpiStore.metadata.recordCount"
      :date-range="cpiStore.metadata.dateRange"
      @upload-new="navigateToUpload"
    />

    <!-- Filter Controls -->
    <div class="my-6 flex gap-4">
      <USelect v-model="selectedDivision" :options="divisionOptions" />
      <UButton @click="resetFilters">Reset Filters</UButton>
      <UButton @click="exportData" icon="i-lucide-download">Export</UButton>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <DOSMInflationLineChart :data="chartData" class="lg:col-span-2" />
      <DOSMDivisionBarChart :data="latestYearData" />
      <DOSMComparisonChart :data="comparisonData" />
    </div>

    <!-- Data Table -->
    <DOSMCPIDataTable
      :data="filteredData"
      :loading="isLoading"
      @sort="handleSort"
      @export="exportData"
    />
  </div>
</template>
```

**Key Features:**
- Full-width header with metadata
- Filter controls for division and date range
- Multiple chart types (line, bar, comparison)
- Sortable, filterable data table
- Export functionality
- No data state with redirect to upload

### Component Specifications

#### UploadZone.vue
- **Props:** `disabled: boolean`
- **Events:** `@file-selected`, `@file-dropped`
- **Features:**
  - Drag & drop zone with visual feedback
  - Click to browse files
  - File type validation (.csv only)
  - File size display
  - Error message display

#### ValidationCard.vue
- **Props:** `column: string`, `validation: CPIColumnValidation`
- **Features:**
  - Column name header
  - Empty cells count with badge
  - Invalid cells count with badge
  - Expandable error list
  - Color-coded severity (green/yellow/red)

#### StatsCard.vue
- **Props:** `title: string`, `value: string | number`, `icon: string`, `description?: string`
- **Features:**
  - Icon + title + value layout
  - Optional description text
  - Responsive design
  - Color variants

#### DashboardHeader.vue
- **Props:** `lastUpdated: Date`, `recordCount: number`, `dateRange: { start, end }`
- **Events:** `@upload-new`
- **Features:**
  - Page title
  - Metadata display (upload date, record count, date range)
  - "Upload New Data" button
  - Status indicators

#### InflationLineChart.vue
- **Props:** `data: CPIRecord[]`, `division?: string`
- **Features:**
  - Chart.js line chart
  - X-axis: Years
  - Y-axis: Inflation rate (%)
  - Tooltip with formatted values
  - Responsive design
  - Legend

#### DivisionBarChart.vue
- **Props:** `data: CPIRecord[]`, `year: string`
- **Features:**
  - Chart.js bar chart
  - X-axis: Division codes
  - Y-axis: Inflation rate (%)
  - Color-coded bars
  - Hover tooltips

#### ComparisonChart.vue
- **Props:** `data: CPIRecord[]`, `divisions: string[]`
- **Features:**
  - Multi-line chart
  - Toggle divisions on/off via legend
  - Compare multiple divisions over time
  - Interactive legend

#### CPIDataTable.vue
- **Props:** `data: CPIRecord[]`, `loading: boolean`
- **Events:** `@sort`, `@export`
- **Features:**
  - Sortable columns (date, division, inflation)
  - Pagination (50 rows per page)
  - Search functionality
  - Loading skeleton
  - Empty state
  - Export to CSV button

---

## Testing Strategy

### Manual Testing Checklist

#### Step 1: File Upload
- [ ] Drag & drop works for .csv files
- [ ] Click to browse works
- [ ] File selection displays file name and size
- [ ] Invalid file types are rejected (.xlsx, .txt, etc.)
- [ ] "Process File" button is disabled until file selected
- [ ] Processing shows loading state
- [ ] Auto-advance to Step 2 after successful processing

#### Step 2: Data Validation
- [ ] Summary statistics cards display correctly
  - [ ] Total Rows count is accurate
  - [ ] Total Columns shows 3 (date, division, inflation)
  - [ ] Missing Values count is correct
  - [ ] Invalid Values count is correct
- [ ] Data preview table shows first 5 rows
- [ ] Column quality check cards display for all 3 columns
  - [ ] Empty cells count per column
  - [ ] Invalid cells count per column
  - [ ] Validation errors list (if any)
- [ ] Data quality alert shows when issues detected
- [ ] "Back to Upload" button returns to Step 1
- [ ] "Continue to Review" button advances to Step 3
- [ ] Can't skip steps using stepper

#### Step 3: Review & Commit
- [ ] Basic statistics cards display:
  - [ ] Total Records
  - [ ] Date Range (earliest to latest year)
  - [ ] Number of Divisions
  - [ ] Latest Year Available
- [ ] "Back to Validation" button returns to Step 2
- [ ] "Commit Data & Continue" button:
  - [ ] Shows loading state during commit
  - [ ] Saves data to cpiStore
  - [ ] Saves data to localStorage
  - [ ] Redirects to /dosm-dashboard

#### Dashboard: Header & Navigation
- [ ] Dashboard header displays:
  - [ ] Last uploaded timestamp
  - [ ] Record count
  - [ ] Date range (start - end)
- [ ] "Upload New Data" button redirects to /dosmupload
- [ ] No data state displays when localStorage empty
- [ ] "Upload CPI Data" button in empty state works

#### Dashboard: Filter Controls
- [ ] Division selector dropdown:
  - [ ] Shows all divisions (overall, 01-13)
  - [ ] Filtering updates charts and table
  - [ ] Default shows all divisions
- [ ] Date range picker (if implemented):
  - [ ] Start year selector works
  - [ ] End year selector works
  - [ ] Filtering updates charts and table
- [ ] "Reset Filters" button clears all filters
- [ ] "Export Data" button downloads CSV

#### Dashboard: Charts
- [ ] Line chart (Overall Inflation Trend):
  - [ ] X-axis shows years correctly
  - [ ] Y-axis shows inflation rates
  - [ ] Line renders correctly
  - [ ] Tooltips show on hover
  - [ ] Responsive on mobile
- [ ] Bar chart (Division Comparison):
  - [ ] Bars render for all divisions
  - [ ] Colors are distinct
  - [ ] Tooltips show values
  - [ ] Responsive layout
- [ ] Comparison chart (Multi-line):
  - [ ] Multiple lines render
  - [ ] Legend works
  - [ ] Can toggle divisions on/off
  - [ ] Interactive and smooth

#### Dashboard: Data Table
- [ ] Table displays all records
- [ ] Sorting works:
  - [ ] Sort by date (asc/desc)
  - [ ] Sort by division (asc/desc)
  - [ ] Sort by inflation (asc/desc)
- [ ] Pagination works (50 rows per page)
- [ ] Search functionality works (if implemented)
- [ ] Export button downloads filtered data
- [ ] Loading skeleton displays while loading
- [ ] Empty state shows when no results

#### Data Persistence
- [ ] Data persists after page refresh
- [ ] Data persists after browser close/reopen
- [ ] Re-uploading replaces existing data
- [ ] localStorage key is correct: `dynalis-cpi-data`
- [ ] Data structure matches CPIDataset interface

#### Validation: Strict Checks
- [ ] Date column validation:
  - [ ] Accepts ISO format (YYYY-MM-DD)
  - [ ] Rejects invalid dates
  - [ ] Rejects empty dates
- [ ] Division column validation:
  - [ ] Accepts "overall"
  - [ ] Accepts "01" through "13"
  - [ ] Rejects other values
  - [ ] Rejects empty values
- [ ] Inflation column validation:
  - [ ] Accepts positive numbers
  - [ ] Accepts negative numbers
  - [ ] Accepts decimal values
  - [ ] Rejects non-numeric values
  - [ ] Rejects empty values

#### Edge Cases
- [ ] Empty CSV file
- [ ] CSV with missing columns
- [ ] CSV with extra columns (should still work)
- [ ] CSV with wrong column names
- [ ] Large file (close to 5MB limit)
- [ ] localStorage full scenario
- [ ] Corrupted cache data
- [ ] Browser with localStorage disabled

#### Navigation & Sidebar
- [ ] "DOSM Upload" link in sidebar works
- [ ] "DOSM Dashboard" link in sidebar works
- [ ] Links positioned below "Data Upload" in sidebar
- [ ] Active route highlighting works
- [ ] Navigation maintains scroll position (if needed)

#### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (Chrome, Safari iOS)

#### Demo Mode Integration
- [ ] Works in demo mode
- [ ] No conflicts with site data workflow
- [ ] Separate from site data in localStorage
- [ ] Can use both DOSM and site upload simultaneously

### Future: Automated Tests

```typescript
// Unit Tests
describe('useCPIData', () => {
  it('processes and parses CPI CSV file', async () => {})
  it('validates CSV structure with strict rules', async () => {})
  it('detects invalid date formats', () => {})
  it('detects invalid division codes', () => {})
  it('accepts negative inflation values', () => {})
  it('calculates basic statistics correctly', () => {})
  it('filters by division', () => {})
  it('filters by date range', () => {})
})

describe('cpiStore', () => {
  it('loads data from localStorage', () => {})
  it('saves data to localStorage', () => {})
  it('clears data correctly', () => {})
  it('calculates metadata correctly', () => {})
})

// Integration Tests
describe('DOSM Upload Flow', () => {
  it('completes full 3-step upload flow', async () => {})
  it('validates data in Step 2', async () => {})
  it('commits data and redirects to dashboard', async () => {})
  it('handles validation errors gracefully', async () => {})
})

describe('DOSM Dashboard', () => {
  it('loads cached data on mount', async () => {})
  it('renders all charts correctly', async () => {})
  it('filters data by division', async () => {})
  it('exports data to CSV', async () => {})
})
```

---

## Timeline

### Total Estimated Time: 6-8 hours

This is a significant increase from the original 3-4 hour estimate due to:
- Full 3-step upload flow (similar to dataupload.vue)
- Multiple chart components for dashboard
- Full-featured data table with filtering/export
- Comprehensive validation logic
- Navigation integration

---

### Phase 1: Data Layer & Foundation (1.5 hours)

**Task Breakdown:**
- Create type definitions with validation types (30 min)
- Create localStorage utilities (15 min)
- Create CPI store with actions and getters (45 min)

**Deliverables:**
- `app/types/cpi.ts` - All interfaces defined
- `app/utils/cpiStorage.ts` - Storage functions working
- `app/stores/cpiStore.ts` - Store ready for use

---

### Phase 2: Validation & Business Logic (1.5 hours)

**Task Breakdown:**
- Create useCPIData composable (30 min)
- Implement strict validation logic (45 min):
  - Date format validation (ISO YYYY-MM-DD)
  - Division code validation (overall, 01-13)
  - Inflation numeric validation
  - Empty/missing value checks
- Implement filtering and stats calculation (15 min)

**Deliverables:**
- `app/composables/useCPIData.ts` - Complete with all validation

---

### Phase 3: Upload Page - 3-Step Flow (2-3 hours)

**Task Breakdown:**
- **Hour 1: Page Structure & Step 1**
  - Create dosmupload.vue with UStepper (15 min)
  - Implement Step 1: File Upload with drag & drop (45 min)
  - Add file processing and navigation logic (15 min + 15 min buffer)

- **Hour 2: Steps 2 & 3**
  - Implement Step 2: Validation UI (45 min)
    - Summary cards
    - Data preview table
    - Column quality check cards
  - Implement Step 3: Review & Commit (30 min)
    - Basic statistics cards
    - Commit logic and navigation

- **Hour 3: Upload Components** (Optional, can inline in page)
  - Create UploadZone.vue (30 min)
  - Create ValidationCard.vue (30 min)
  - Create StatsCard.vue (30 min)

**Deliverables:**
- `app/pages/dosmupload.vue` - Complete 3-step flow
- `app/components/DOSM/` - Reusable upload components

---

### Phase 4: Dashboard Page - Full Analytics (2-3 hours)

**Task Breakdown:**
- **Hour 1: Dashboard Page & Header**
  - Create dosm-dashboard.vue structure (15 min)
  - Implement DashboardHeader component (30 min)
  - Add filter controls (division selector, export button) (30 min)
  - Handle no data state (15 min)

- **Hour 2: Charts**
  - Implement InflationLineChart.vue (45 min)
  - Implement DivisionBarChart.vue (30 min)
  - Implement ComparisonChart.vue (45 min)

- **Hour 3: Data Table & Polish**
  - Implement CPIDataTable.vue (45 min)
  - Add sorting, pagination, export (30 min)
  - Testing and bug fixes (45 min)

**Deliverables:**
- `app/pages/dosm-dashboard.vue` - Complete dashboard
- `app/components/DOSM/` - All chart and table components

---

### Phase 5: Navigation & Integration (0.5 hour)

**Task Breakdown:**
- Update sidebar navigation (15 min)
- Test navigation flow (10 min)
- Add route guards if needed (10 min)
- Final integration testing (15 min)

**Deliverables:**
- Updated `app/layouts/default.vue` (or navigation component)
- Working navigation links

---

### Phase 6: Polish, Testing & Documentation (1 hour)

**Task Breakdown:**
- Error handling and edge cases (20 min)
- Loading states and empty states (15 min)
- Manual testing of entire flow (20 min)
- Bug fixes (20 min)
- Update CLAUDE.md (10 min)
- JSDoc comments (15 min)

**Deliverables:**
- Polished, production-ready module
- Updated documentation

---

### Optional Enhancements (if time permits)

**Advanced Features (1-2 hours):**
- Date range picker for filtering (30 min)
- Year-over-year change calculations (30 min)
- Advanced export options (PDF, formatted Excel) (45 min)
- Mobile responsive optimization (30 min)
- Keyboard shortcuts for navigation (15 min)

---

### Breakdown by Complexity

**Easy Tasks (Total: 2 hours):**
- Type definitions
- localStorage utilities
- Basic page structure
- Simple components (StatsCard)

**Medium Tasks (Total: 3 hours):**
- Store implementation
- Validation logic
- Upload flow Steps 1-3
- Data table with sorting/pagination

**Complex Tasks (Total: 2-3 hours):**
- Chart components (3 types)
- Dashboard with filtering
- Full integration testing
- Error handling and edge cases

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
- ✅ 3-step upload flow (Upload → Validate → Review & Commit)
- ✅ Upload CPI CSV file with drag & drop
- ✅ Strict validation (date format, division codes, numeric inflation)
- ✅ Parse and validate CSV structure
- ✅ Cache in localStorage (separate from site data)
- ✅ Full analytics dashboard (`/dosm-dashboard`)
- ✅ Multiple chart types (line chart, bar chart, comparison chart)
- ✅ Display in sortable, paginated table
- ✅ Filter by division
- ✅ Export to CSV
- ✅ Show upload status and metadata
- ✅ Clear/re-upload functionality
- ✅ Comprehensive error handling
- ✅ Loading and empty states
- ✅ Sidebar navigation integration

### Nice to Have (Future Enhancements)
- 📅 Date range picker for filtering
- 📊 Year-over-year change calculations
- 📥 Advanced export (PDF, formatted Excel)
- 📱 Mobile responsive optimization
- ⌨️ Keyboard shortcuts
- 🔍 Search within table
- 📈 Trend forecasting (simple moving average)
- 🎨 Custom chart themes

### Quality Standards
- 🔒 Type-safe (no `any` types without ESLint disable)
- 📝 Well-documented code
- 🐛 Error boundaries
- ♿ Accessible UI components
- 🚀 Fast load times (< 2 seconds)

---

## Notes

### Design Decisions Log

**2024-10-24 (v1.0):** Initial plan created
- Chose client-side implementation for consistency with demo mode
- Decided on separate module (Option B) for clean architecture
- Selected file upload approach to reuse existing infrastructure
- Deferred server-side storage to future phase
- Prioritized simplicity over feature completeness
- Original estimate: 3-4 hours

**2024-10-24 (v2.0):** Major architecture revision based on user requirements
- **Key Change:** Replaced simple single-page upload with 3-step flow similar to dataupload.vue
- **Key Change:** Replaced basic analytics page with full dashboard experience
- Added comprehensive validation (strict checks for date, division, inflation)
- Included multiple chart types in MVP (line, bar, comparison)
- Added sidebar navigation integration
- Separate store and localStorage key for data isolation
- Updated estimate: 6-8 hours (due to increased scope and complexity)

**Rationale for v2.0 Changes:**
- Consistency: Match existing upload workflow for familiar UX
- Professional: Full dashboard provides better data exploration
- Complete: Charts included in MVP for immediate value
- Scalable: Modular component architecture for future enhancements

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

**Document Version:** 2.0
**Last Updated:** 2024-10-24
**Author:** Claude Code
**Status:** Ready for Implementation

---

## Revision History

**v1.0 (2024-10-24):**
- Initial plan with simple file upload page and basic analytics
- Estimated 3-4 hours
- Single page: cpi-analytics.vue

**v2.0 (2024-10-24):**
- Major revision based on user clarifications
- Changed to 3-step upload flow + full dashboard
- Estimated 6-8 hours
- Two pages: dosmupload.vue + dosm-dashboard.vue
- 8 new components in DOSM folder
- Comprehensive validation and multiple chart types in MVP
- Sidebar navigation integration
