# DOSM GDP/GNI Integration - Implementation Plan

**Dataset:** Annual Real GDP & GNI (1970-2024)
**Data Source:** https://storage.dosm.gov.my/gdp/gdp_gni_annual_real.csv
**Catalogue:** https://open.dosm.gov.my/data-catalogue/gdp_gni_annual_real
**Branch:** `dosm_demo` (continuing from CPI work)
**Status:** 📋 Planning

---

## 📊 Dataset Overview

### Data Structure
- **Columns:** `series`, `date`, `gdp`, `gni`, `gdp_capita`, `gni_capita`
- **Series Types:**
  - `abs` - Absolute values in constant 2015 RM millions (GDP/GNI) or RM (per capita)
  - `growth_yoy` - Year-over-year growth rates (%)
- **Time Span:** 1970-2024 (55 years)
- **Total Records:** ~110 rows (55 years × 2 series)
- **Update Frequency:** Annual (next update: Feb 2026)

### Metrics (4 total)
1. **GDP** - Gross Domestic Product
2. **GNI** - Gross National Income
3. **GDP per Capita** - Per person GDP
4. **GNI per Capita** - Per person GNI

### Key Differences from CPI
- **Multiple metrics** (4) vs. CPI's single inflation metric
- **Series types** (abs/growth) vs. CPI's division codes
- **Longer time span** (55 years) vs. CPI's typical 5-10 years
- **Dual series display** (absolute + growth on same charts)
- **Historical context** (economic milestones/events)

---

## 🎯 Implementation Phases

| Phase | Tasks | Priority | Est. Time |
|-------|-------|----------|-----------|
| **Phase 1:** Data Layer & Foundation | 14 | 🔴 Critical | 1.5h |
| **Phase 2:** Validation & Business Logic | 11 | 🔴 Critical | 1.5h |
| **Phase 3:** Upload Page - 3-Step Flow | 18 | 🔴 Critical | 2.5h |
| **Phase 4:** Dashboard - Full Analytics | 28 | 🟡 Important | 4h |
| **Phase 5:** Navigation & Integration | 4 | 🟡 Important | 0.5h |
| **Phase 6:** Polish, Testing & Documentation | 8 | 🟢 Nice to have | 1.5h |
| **TOTAL** | **83** | | **~11-12 hours** |

---

## 🎯 Phase 1: Data Layer & Foundation

**Priority:** 🔴 Critical
**Estimated Time:** 1.5 hours

### 📁 app/types/gdp.ts

Create comprehensive TypeScript interfaces:

- [ ] Create `GDPGNIRecord` interface
  ```typescript
  interface GDPGNIRecord {
    series: 'abs' | 'growth_yoy'
    date: string // ISO format YYYY-MM-DD
    gdp: number
    gni: number
    gdp_capita: number
    gni_capita: number
  }
  ```

- [ ] Create `GDPGNIDataset` interface
  ```typescript
  interface GDPGNIDataset {
    records: GDPGNIRecord[]
    absRecords: GDPGNIRecord[] // Pre-filtered abs series
    growthRecords: GDPGNIRecord[] // Pre-filtered growth series
    lastUpdated: string
    fileName: string
    metadata: {
      dateRange: { start: string; end: string }
      totalYears: number
      recordCount: number
      latestYear: number
    }
  }
  ```

- [ ] Create `GDPGNIValidationError` interface
  - Fields: `row`, `column`, `value`, `error`, `severity`

- [ ] Create `GDPGNIColumnValidation` interface
  - Fields: `emptyCells`, `invalidCells`, `errors[]`, `warnings[]`

- [ ] Create `GDPGNIBasicStats` interface
  ```typescript
  interface GDPGNIBasicStats {
    totalRecords: number
    dateRange: { start: string; end: string }
    latestYear: number
    latestAbsValues: {
      gdp: number
      gni: number
      gdp_capita: number
      gni_capita: number
    }
    latestGrowthRates: {
      gdp: number
      gni: number
      gdp_capita: number
      gni_capita: number
    }
  }
  ```

- [ ] Create `MetricType` type
  ```typescript
  type MetricType = 'gdp' | 'gni' | 'gdp_capita' | 'gni_capita'
  ```

- [ ] Create `HistoricalMilestone` interface
  ```typescript
  interface HistoricalMilestone {
    year: number
    event: string
    description: string
    impact: 'crisis' | 'recovery' | 'milestone'
  }
  ```

### 📁 app/utils/gdpStorage.ts

Implement localStorage persistence utilities:

- [ ] Implement `saveGDPGNIData(data: GDPGNIDataset): void`
  - Save to localStorage with key: `dynalis-gdp-gni-data`
  - Handle JSON stringify errors with try-catch
  - Handle quota exceeded errors

- [ ] Implement `loadGDPGNIData(): GDPGNIDataset | null`
  - Load from localStorage
  - Handle JSON parse errors
  - Validate schema before returning
  - Return null if not found or invalid

- [ ] Implement `clearGDPGNIData(): void`
  - Remove from localStorage
  - Clear any related cache keys

- [ ] Implement `getCacheAge(): number | null`
  - Calculate milliseconds since lastUpdated
  - Return null if no data exists

### 📁 app/stores/gdpStore.ts

Create Nuxt state management store:

- [ ] Create store using `useState` composable pattern
- [ ] Define state properties
  - `gdpGniData: GDPGNIDataset | null`
  - `isLoading: boolean`
  - `error: string | null`
  - `lastUploadedAt: string | null`

- [ ] Implement `loadFromCache()` action
  - Call `loadGDPGNIData()` from storage utility
  - Update state with loaded data
  - Handle load errors gracefully

- [ ] Implement `setUploadedData(records: GDPGNIRecord[], fileName: string)` action
  - Separate records into `absRecords` and `growthRecords`
  - Calculate metadata (dateRange, totalYears, recordCount)
  - Save to localStorage via `saveGDPGNIData()`
  - Update state with new dataset
  - Set `lastUploadedAt` timestamp

- [ ] Implement `clearData()` action
  - Call `clearGDPGNIData()` storage utility
  - Reset all state to initial values

- [ ] Implement `getBasicStats()` getter
  - Calculate `GDPGNIBasicStats` from current data
  - Extract latest abs and growth values
  - Return null if no data available

---

## 🔍 Phase 2: Validation & Business Logic

**Priority:** 🔴 Critical
**Estimated Time:** 1.5 hours

### 📁 app/composables/useGDPGNIData.ts

Core data processing and validation composable:

#### File Processing

- [ ] Implement `processGDPGNIFile(file: File): Promise<GDPGNIRecord[]>`
  - Use PapaParse to parse CSV with proper config
  - Transform raw data into `GDPGNIRecord[]`
  - Handle parsing errors with descriptive messages
  - Validate file size (reasonable limits)

#### Validation Helpers

- [ ] Implement `validateSeriesType(value: string): boolean`
  - Check value is exactly "abs" or "growth_yoy"
  - Case-sensitive validation

- [ ] Implement `validateDate(value: string): boolean`
  - Check ISO format YYYY-MM-DD
  - Validate year is between 1970-2024
  - Use date-fns parse and isValid

- [ ] Implement `validateNumericValue(value: unknown): boolean`
  - Check is numeric using parseFloat
  - Allow negative values (growth can be negative)
  - Reject NaN, Infinity, empty strings

#### Structure Validation

- [ ] Implement `validateGDPGNIStructure(data: Record<string, unknown>[]): GDPGNIValidationError[]`
  - Check required columns: series, date, gdp, gni, gdp_capita, gni_capita
  - Validate each row for data integrity
  - Check series consistency (should have matching abs/growth pairs)
  - Return array of validation errors with severity levels

- [ ] Implement `getColumnValidation(column: string, data: Record<string, unknown>[]): GDPGNIColumnValidation`
  - Count empty cells per column
  - Count invalid cells per column
  - Collect specific validation errors
  - Generate warnings for suspicious values (e.g., unrealistic growth rates)

#### Statistics & Filtering

- [ ] Implement `calculateBasicStats(records: GDPGNIRecord[]): GDPGNIBasicStats`
  - Find min/max dates for date range
  - Calculate total years spanned
  - Extract latest year's abs and growth values
  - Handle edge cases (empty data, single record)

- [ ] Implement `filterBySeriesType(records: GDPGNIRecord[], series: 'abs' | 'growth_yoy'): GDPGNIRecord[]`
  - Filter records by series type
  - Maintain chronological order

- [ ] Implement `filterByDateRange(records: GDPGNIRecord[], startYear: number, endYear: number): GDPGNIRecord[]`
  - Filter records within year range (inclusive)
  - Extract year from date string
  - Return both abs and growth records in range

- [ ] Implement `filterByMetric(records: GDPGNIRecord[], metric: MetricType): Array<{date: string, abs: number, growth: number}>`
  - Extract specific metric from both series types
  - Combine abs and growth values by date
  - Useful for dual-axis charts

#### Historical Context

- [ ] Implement `getHistoricalMilestones(): HistoricalMilestone[]`
  - Return predefined list of economic events:
    - 1997-1998: Asian Financial Crisis
    - 2008-2009: Global Financial Crisis
    - 2020-2021: COVID-19 Pandemic
    - Other significant Malaysian economic milestones
  - Include descriptions and impact classifications

- [ ] Implement `getMilestonesInRange(startYear: number, endYear: number): HistoricalMilestone[]`
  - Filter milestones within specified date range
  - Useful for contextual chart annotations

---

## 📤 Phase 3: Upload Page - 3-Step Flow

**Priority:** 🔴 Critical
**Estimated Time:** 2.5 hours

### 📁 app/pages/dosmgdp.vue

Create dedicated GDP/GNI upload page with 3-step workflow:

#### Page Structure & State

- [ ] Create page with UCard container layout
- [ ] Add UStepper component with 3 steps
  - Step 1: "Upload GDP/GNI File"
  - Step 2: "Validate Structure & Data"
  - Step 3: "Review Statistics & Commit"

- [ ] Define reactive state variables
  ```typescript
  const currentStep = ref(1)
  const selectedFile = ref<File | null>(null)
  const fileData = ref<GDPGNIRecord[]>([])
  const rawData = ref<Record<string, unknown>[]>([])
  const headers = ref<string[]>([])
  const validationErrors = ref<GDPGNIValidationError[]>([])
  const isProcessing = ref(false)
  const errorMessage = ref<string | null>(null)
  ```

#### Step 1: File Upload

- [ ] Create drag & drop upload zone
  - Handle dragenter, dragleave, dragover, drop events
  - Visual feedback with border color change on drag
  - Prevent default browser file handling

- [ ] Add hidden file input with click-to-browse
  - Accept only `.csv` files
  - Trigger from drop zone click

- [ ] Implement file selection handler
  - Validate file extension (.csv only)
  - Check file size (< 5MB recommended)
  - Display selected file name and size
  - Store file in `selectedFile` ref

- [ ] Add informational card about data source
  - Title: "DOSM GDP/GNI Dataset"
  - Link to: https://storage.dosm.gov.my/gdp/gdp_gni_annual_real.csv
  - Instructions: "Download the official dataset and upload here"
  - Expected columns: series, date, gdp, gni, gdp_capita, gni_capita
  - Date range: 1970-2024

- [ ] Add "Process File" button
  - Disabled state when no file selected
  - Loading state during processing
  - Success state on completion

- [ ] Implement file processing logic
  - Call `processGDPGNIFile()` from composable
  - Store parsed data in `fileData` and `rawData`
  - Extract headers
  - Handle processing errors with user-friendly messages
  - Auto-advance to Step 2 on success

#### Step 2: Data Validation

- [ ] Create validation summary cards (grid layout)
  - **Total Records** - Show `fileData.length` with UBadge
  - **Total Columns** - Should be 6 (series, date, 4 metrics)
  - **Missing Values** - Count across all cells
  - **Validation Errors** - Count of critical errors
  - Color-code badges: green (0 errors), yellow (warnings), red (errors)

- [ ] Add data preview table
  - Display first 10 rows with all 6 columns
  - Highlight cells with invalid/empty values
  - Scrollable on mobile
  - Use UTable component

- [ ] Create column quality check section
  - Loop through all 6 columns
  - For each column show:
    - Column name with icon
    - Empty cells count (UBadge)
    - Invalid cells count (UBadge)
    - Expandable list of specific errors (UAccordion)

- [ ] Add series consistency check
  - Verify each year has both 'abs' and 'growth_yoy' records
  - Flag missing pairs as warnings
  - Display in alert box

- [ ] Add overall data quality alert
  - UAlert with dynamic color:
    - Red: Critical errors found (block progression)
    - Yellow: Warnings found (allow with confirmation)
    - Green: All validations passed
  - Display summary message

- [ ] Add navigation buttons
  - "← Back to Upload" → Reset and return to Step 1
  - "Continue to Review →" → Advance to Step 3
    - Disabled if critical errors exist
    - Show confirmation modal if warnings exist

#### Step 3: Review & Commit

- [ ] Create basic statistics summary (grid of cards)
  - **Total Years** - From dateRange calculation
  - **Date Range** - "1970 to 2024"
  - **Total Records** - Abs + Growth combined
  - **Latest Year** - Most recent data year

- [ ] Add latest values showcase (2 sections)
  - **Absolute Values (RM millions / RM)**
    - GDP: XX,XXX.XX million
    - GNI: XX,XXX.XX million
    - GDP per Capita: XX,XXX RM
    - GNI per Capita: XX,XXX RM
  - **Growth Rates (%)**
    - GDP: +X.X%
    - GNI: +X.X%
    - GDP per Capita: +X.X%
    - GNI per Capita: +X.X%

- [ ] Add dataset information card
  - Dataset name and description
  - Upload file name
  - Data source attribution (DOSM)
  - License info (CC BY 4.0)
  - Last DOSM update: Feb 2025
  - Next scheduled update: Feb 2026

- [ ] Create data insights preview section
  - Mini line chart showing 55-year GDP trend (read-only preview)
  - Decade averages table
  - Notable milestones within data range

- [ ] Implement commit data logic
  - Call `gdpStore.setUploadedData()` with records and filename
  - Show loading spinner during save
  - Handle localStorage errors (quota exceeded)
  - Display success toast on completion

- [ ] Add navigation buttons
  - "← Back to Validation" → Return to Step 2
  - "Commit Data & View Dashboard →" → Save and redirect
    - Loading state during commit
    - Redirect to `/dosmgdp-dashboard` on success

- [ ] Implement post-commit redirect
  - Use `router.push('/dosmgdp-dashboard')`
  - Pass success toast message
  - Clear upload state

---

## 📊 Phase 4: Dashboard - Full Analytics

**Priority:** 🟡 Important
**Estimated Time:** 4 hours

### 📁 app/pages/dosmgdp-dashboard.vue

Comprehensive analytics dashboard with multiple visualization approaches:

#### Page Structure & State

- [ ] Create page layout with responsive container
- [ ] Define reactive state
  ```typescript
  const gdpStore = useGDPGNIStore()
  const selectedMetric = ref<MetricType>('gdp')
  const startYear = ref<number>(1970)
  const endYear = ref<number>(2024)
  const filteredData = ref<GDPGNIRecord[]>([])
  const showMilestones = ref<boolean>(true)
  const viewMode = ref<'charts' | 'table'>('charts')
  ```

- [ ] Implement data loading on mount
  - Load from store: `gdpStore.loadFromCache()`
  - Check if data exists
  - Redirect to `/dosmgdp` if no data
  - Initialize filtered data with full dataset

- [ ] Create computed properties
  - `absRecords` - Filtered absolute value records
  - `growthRecords` - Filtered growth rate records
  - `currentMilestones` - Milestones within date range
  - `basicStats` - Calculate from filtered data

#### Header Section

- [ ] Create page header with title
  - Title: "GDP & GNI Analytics Dashboard"
  - Subtitle: "Annual Real Values (1970-2024)"

- [ ] Display dataset metadata badges
  - Last uploaded: Format with `date-fns` (e.g., "2 hours ago")
  - Total records: Show count
  - Date range: "1970 - 2024"
  - Data source: DOSM badge with link

- [ ] Add action buttons
  - "📤 Upload New Data" → Navigate to `/dosmgdp`
  - "📥 Export Current View" → Export filtered data as CSV
  - "🔄 Refresh" → Reload from cache

#### Filter Controls Section

- [ ] Create metric selector dropdown
  - Component: USelectMenu
  - Options:
    - GDP (Gross Domestic Product)
    - GNI (Gross National Income)
    - GDP per Capita
    - GNI per Capita
  - v-model: `selectedMetric`
  - Icon indicators for each metric
  - Update charts on change

- [ ] Add date range filter (2 number inputs)
  - Start Year: Min=1970, Max=endYear
  - End Year: Min=startYear, Max=2024
  - Validation: end >= start
  - Update `filteredData` on change

- [ ] Add quick range buttons
  - "Last 5 Years" → Set range to 2019-2024
  - "Last 10 Years" → Set range to 2014-2024
  - "Last 20 Years" → Set range to 2004-2024
  - "All Time" → Reset to 1970-2024

- [ ] Add milestone toggle switch
  - Label: "Show Historical Milestones"
  - v-model: `showMilestones`
  - Controls chart annotations

- [ ] Add view mode toggle
  - Buttons: "📊 Charts" | "📋 Table"
  - v-model: `viewMode`
  - Switch between visualizations and data table

- [ ] Add "Reset All Filters" button
  - Reset metric, date range, view mode to defaults
  - Show confirmation if user has unsaved exports

#### Summary Statistics Cards

- [ ] Create responsive grid (4 columns on desktop, 2 on tablet, 1 on mobile)

- [ ] Add latest absolute values cards (4 metrics)
  - GDP card: Show latest RM millions with trend indicator (↑/↓)
  - GNI card: Show latest RM millions with trend indicator
  - GDP per Capita card: Show latest RM with trend indicator
  - GNI per Capita card: Show latest RM with trend indicator
  - Each card: Large number, metric name, year, YoY change badge

- [ ] Add latest growth rates cards (4 metrics)
  - Same structure but showing % values
  - Color-coded: green (positive), red (negative)
  - Comparison to 5-year average

#### Charts Section - Individual Metric Selector View

- [ ] Create dual-axis line chart (selected metric)
  - Component: `DOSMGDPDualAxisChart.vue` (new)
  - Left Y-axis: Absolute values
  - Right Y-axis: Growth rates (%)
  - X-axis: Years
  - Props: `metric`, `absRecords`, `growthRecords`, `milestones`
  - Two lines: Abs (blue), Growth (orange)
  - Milestone markers if enabled
  - Full width, responsive

#### Charts Section - Multi-Metric Comparison View

- [ ] Create 4-metric comparison chart (abs values)
  - Component: `DOSMGDPComparisonChart.vue` (new)
  - Multi-line chart showing all 4 metrics' absolute values
  - Dual Y-axis: Left (GDP/GNI millions), Right (per capita RM)
  - Legend with toggle to show/hide individual metrics
  - Props: `absRecords`, `dateRange`
  - Responsive, 2-column width

- [ ] Create 4-metric comparison chart (growth rates)
  - Component: `DOSMGDPGrowthComparisonChart.vue` (new)
  - Multi-line chart showing all 4 metrics' growth rates
  - Single Y-axis (% values)
  - Highlight crisis periods with shaded regions
  - Props: `growthRecords`, `milestones`, `dateRange`
  - Responsive, 2-column width

#### Charts Section - Separate Cards Per Metric

- [ ] Create metric cards grid (2x2 layout)
  - Each card contains:
    - Metric name header
    - Latest value badge
    - Mini dual-axis chart (abs + growth)
    - Quick stats (min, max, average over selected range)

- [ ] Implement GDP card
  - Component: `DOSMGDPMetricCard.vue` (reusable)
  - Props: `metric='gdp'`, `data`, `title='GDP'`

- [ ] Implement GNI card
  - Same component, different props

- [ ] Implement GDP per Capita card
  - Same component, different props

- [ ] Implement GNI per Capita card
  - Same component, different props

#### Historical Context Section

- [ ] Create milestones timeline
  - Component: `DOSMHistoricalTimeline.vue` (new)
  - Horizontal timeline with event markers
  - Filter by current date range
  - Click to highlight event period on charts
  - Show event description in popover

- [ ] Add crisis impact analysis cards
  - For each major crisis in range:
    - Event name and years
    - Impact on each metric (% decline/recovery)
    - Recovery duration
    - Before/during/after comparison

#### Data Table Section

- [ ] Create comprehensive data table
  - Component: `DOSMGDPDataTable.vue` (new)
  - Columns: Year, GDP (abs), GDP (%), GNI (abs), GNI (%), GDP/capita (abs), GDP/capita (%), GNI/capita (abs), GNI/capita (%)
  - Sortable by any column
  - Pagination (20 rows per page)
  - Row highlighting on hover
  - Sticky header on scroll

- [ ] Add table controls
  - Search/filter by year
  - Column visibility toggles
  - Density options (compact/comfortable/spacious)
  - "Select All" for export

- [ ] Implement export functionality
  - Export filtered/selected rows as CSV
  - Include current filters in filename
  - Use PapaParse to unparse

#### Comparison & Analysis Tools

- [ ] Add decade averages summary
  - Calculate average for each decade (1970s, 1980s, ... 2020s)
  - Show in bar chart format
  - Compare metrics across decades

- [ ] Add year-over-year change table
  - Top 5 best growth years per metric
  - Top 5 worst growth years per metric
  - Highlighted in table

---

## 🧭 Phase 5: Navigation & Integration

**Priority:** 🟡 Important
**Estimated Time:** 0.5 hour

### 📁 app/layouts/default.vue

Update sidebar navigation to include GDP/GNI pages:

- [ ] Locate DOSM section in sidebar (below CPI links)

- [ ] Add "GDP/GNI Upload" link
  - Route: `/dosmgdp`
  - Icon: `i-lucide-trending-up`
  - Label: "GDP/GNI Upload"
  - Position: After "DOSM Dashboard" link

- [ ] Add "GDP/GNI Dashboard" link
  - Route: `/dosmgdp-dashboard`
  - Icon: `i-lucide-line-chart`
  - Label: "GDP/GNI Dashboard"
  - Position: After "GDP/GNI Upload" link

- [ ] Test navigation
  - Verify active route highlighting
  - Test navigation between all DOSM pages
  - Check responsive sidebar behavior

---

## 🎨 Phase 6: Polish, Testing & Documentation

**Priority:** 🟢 Nice to have
**Estimated Time:** 1.5 hours

### Error Handling & Edge Cases

- [ ] Test file upload edge cases
  - Empty CSV file
  - CSV with missing columns
  - CSV with extra columns
  - Malformed CSV (syntax errors)
  - Very large files (> 10MB)

- [ ] Test data validation edge cases
  - Missing series types (only abs or only growth)
  - Duplicate years within same series
  - Date gaps (missing years)
  - Extreme outlier values
  - Non-numeric values in numeric columns
  - Invalid series type values

- [ ] Test localStorage edge cases
  - localStorage disabled in browser
  - Quota exceeded error
  - Corrupted data in localStorage
  - Concurrent tab modifications

### Loading & Empty States

- [ ] Add loading states
  - File processing spinner with progress message
  - Chart loading skeletons (use USkeletons)
  - Table loading state with shimmer effect
  - Dashboard initial load spinner

- [ ] Add empty states
  - No data uploaded (dashboard) → CTA to upload
  - No records match filter → Suggest adjusting filters
  - Upload page initial state → Prominent drag-drop zone

### Manual Testing Checklist

- [ ] Test complete upload flow
  - Download official CSV from DOSM
  - Upload via drag-drop
  - Verify validation results
  - Review statistics
  - Commit to storage
  - Navigate to dashboard

- [ ] Test dashboard functionality
  - All 4 metric views render correctly
  - Dual-axis charts display both series
  - Filters work (metric selector, date range)
  - Milestones toggle on/off
  - Table sorting and pagination
  - Export CSV functionality
  - Data persists after page refresh

- [ ] Test error scenarios
  - Upload invalid CSV (should show clear errors)
  - Upload CPI CSV to GDP page (should reject)
  - Clear localStorage and reload (should redirect)
  - Extremely narrow date range (single year)

### Performance Optimization

- [ ] Optimize chart rendering
  - Implement data decimation for large datasets
  - Use canvas rendering mode in Chart.js
  - Add loading indicators before heavy renders

- [ ] Optimize filtering
  - Debounce date range inputs
  - Memoize filtered data computations
  - Use computed properties for derived data

### Code Quality

- [ ] Run linter and fix all issues
  ```bash
  bun run lint:fix
  ```

- [ ] Verify TypeScript types
  - No `any` types used
  - All props properly typed
  - Composable return types explicit

- [ ] Add JSDoc comments
  - All composable functions
  - Complex utility functions
  - Non-obvious business logic

### Documentation

- [ ] Update this plan with actual completion times
- [ ] Document any deviations from original plan
- [ ] Note any issues encountered and resolutions
- [ ] Create implementation summary (similar to tasks.md)

---

## 📦 Component Architecture

### New Components to Create

1. **DOSMGDPDualAxisChart.vue** - Dual-axis chart showing abs + growth for single metric
2. **DOSMGDPComparisonChart.vue** - Multi-line chart comparing all 4 metrics (abs)
3. **DOSMGDPGrowthComparisonChart.vue** - Multi-line chart comparing growth rates
4. **DOSMGDPMetricCard.vue** - Reusable metric card with mini chart
5. **DOSMHistoricalTimeline.vue** - Timeline component for economic milestones
6. **DOSMGDPDataTable.vue** - Comprehensive data table with all metrics

### Component Props Design

```typescript
// DOSMGDPDualAxisChart.vue
interface Props {
  metric: MetricType
  absRecords: GDPGNIRecord[]
  growthRecords: GDPGNIRecord[]
  milestones: HistoricalMilestone[]
  showMilestones: boolean
}

// DOSMGDPMetricCard.vue
interface Props {
  metric: MetricType
  title: string
  data: GDPGNIRecord[]
  dateRange: { start: string; end: string }
}

// DOSMGDPDataTable.vue
interface Props {
  data: GDPGNIRecord[]
  loading: boolean
}
interface Emits {
  (e: 'export', data: GDPGNIRecord[]): void
  (e: 'sort', column: string, direction: 'asc' | 'desc'): void
}
```

---

## 🔧 Technical Considerations

### Chart.js Configuration

- **Dual Y-axis setup** required for abs + growth combined view
- **Milestone annotations** using Chart.js annotation plugin
- **Responsive sizing** with maintainAspectRatio: false
- **Tooltip customization** to show both abs and % values
- **Color palette** consistent with Nuxt UI theme

### Data Processing Performance

- **55 years × 2 series × 4 metrics = 440 data points** (manageable size)
- No need for virtualization or pagination in charts
- localStorage size: ~20-30KB (well within limits)
- Consider memoization for expensive calculations

### Historical Milestones Database

```typescript
const MILESTONES: HistoricalMilestone[] = [
  {
    year: 1997,
    event: 'Asian Financial Crisis',
    description: 'Currency devaluation and economic contraction',
    impact: 'crisis'
  },
  {
    year: 2008,
    event: 'Global Financial Crisis',
    description: 'Worldwide recession affecting export-driven economy',
    impact: 'crisis'
  },
  {
    year: 2020,
    event: 'COVID-19 Pandemic',
    description: 'Economic lockdowns and global trade disruption',
    impact: 'crisis'
  },
  // Add more milestones as needed
]
```

---

## 🎯 Success Criteria

- ✅ All 83 tasks completed
- ✅ Upload flow works end-to-end with official DOSM CSV
- ✅ All 4 metrics display correctly in all chart types
- ✅ Dual-axis charts show both abs and growth series
- ✅ Historical milestones appear on charts
- ✅ Date range filtering works across all views
- ✅ Data persists in localStorage and survives refresh
- ✅ Export functionality produces valid CSV
- ✅ No ESLint errors in new code
- ✅ Production build succeeds
- ✅ Mobile responsive on all pages
- ✅ No console errors or warnings

---

## 📋 Notes & Decisions

### Architecture Decisions

✅ **Separate implementation** - New pages, store, types (not integrated with CPI)
✅ **Combined charts** - Show both abs and growth on same charts with dual axes
✅ **All visualization types** - Metric selector + comparison + cards + summary stats
✅ **Date range filtering** - User can select start/end year
✅ **Historical milestones** - Economic events annotated on charts

### Folder Structure

```
app/
├── components/
│   └── DOSM/
│       ├── GDP/
│       │   ├── DualAxisChart.vue
│       │   ├── ComparisonChart.vue
│       │   ├── GrowthComparisonChart.vue
│       │   ├── MetricCard.vue
│       │   └── DataTable.vue
│       └── HistoricalTimeline.vue
├── composables/
│   └── useGDPGNIData.ts
├── pages/
│   ├── dosmgdp.vue (upload)
│   └── dosmgdp-dashboard.vue
├── stores/
│   └── gdpStore.ts
├── types/
│   └── gdp.ts
└── utils/
    └── gdpStorage.ts
```

### Dependencies

- ✅ **PapaParse** - Already installed (used in CPI)
- ✅ **Chart.js** - Already installed (used in CPI)
- ✅ **date-fns** - Already installed (date formatting)
- ⚠️ **chartjs-plugin-annotation** - May need to install for milestone markers

### Timeline Estimate

- **Phase 1:** 1.5 hours
- **Phase 2:** 1.5 hours
- **Phase 3:** 2.5 hours
- **Phase 4:** 4 hours
- **Phase 5:** 0.5 hour
- **Phase 6:** 1.5 hours
- **Total:** ~11-12 hours

---

**Last Updated:** 2025-10-24
**Status:** 📋 Ready for Implementation
**Created By:** Claude Code (Sonnet 4.5)
