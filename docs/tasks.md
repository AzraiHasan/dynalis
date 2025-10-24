# DOSM GDP/GNI Integration - Implementation Tasks

**Branch:** `dosm_demo`
**Plan Document:** [dosm-gdp-integration-plan.md](./dosm-gdp-integration-plan.md)
**Estimated Time:** ~11-12 hours
**Status:** 🚧 0/83 tasks completed (0%)

---

## 📊 Progress Overview

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1: Data Layer & Foundation | 14 | 0 | 🔴 Not Started |
| Phase 2: Validation & Business Logic | 11 | 0 | 🔴 Not Started |
| Phase 3: Upload Page - 3-Step Flow | 18 | 0 | 🔴 Not Started |
| Phase 4: Dashboard - Full Analytics | 28 | 0 | 🔴 Not Started |
| Phase 5: Navigation & Integration | 4 | 0 | 🔴 Not Started |
| Phase 6: Polish, Testing & Documentation | 8 | 0 | 🔴 Not Started |
| **TOTAL** | **83** | **0** | **🔴 0%** |

---

## 🎯 Phase 1: Data Layer & Foundation (1.5 hours)

**Status:** 🔴 0/14 tasks completed
**Priority:** 🔴 Critical - Foundation for all other phases

### 📁 app/types/gdp.ts

- [ ] Create `GDPGNIRecord` interface
  - Fields: series ('abs' | 'growth_yoy'), date (string), gdp (number), gni (number), gdp_capita (number), gni_capita (number)
  - Add JSDoc comments explaining each field

- [ ] Create `GDPGNIDataset` interface
  - Fields: records, absRecords, growthRecords, lastUpdated, fileName, metadata
  - Include dateRange, totalYears, recordCount, latestYear in metadata

- [ ] Create `GDPGNIValidationError` interface
  - Fields: row, column, value, error, severity

- [ ] Create `GDPGNIColumnValidation` interface
  - Fields: emptyCells, invalidCells, errors[], warnings[]

- [ ] Create `GDPGNIBasicStats` interface
  - Fields: totalRecords, dateRange, latestYear, latestAbsValues, latestGrowthRates
  - latestAbsValues: { gdp, gni, gdp_capita, gni_capita }
  - latestGrowthRates: { gdp, gni, gdp_capita, gni_capita }

- [ ] Create `MetricType` type
  - Type: 'gdp' | 'gni' | 'gdp_capita' | 'gni_capita'

- [ ] Create `HistoricalMilestone` interface
  - Fields: year, event, description, impact ('crisis' | 'recovery' | 'milestone')

### 📁 app/utils/gdpStorage.ts

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

- [ ] Create store with Nuxt `useState` composable pattern
- [ ] Define state: `gdpGniData`, `isLoading`, `error`, `lastUploadedAt`
- [ ] Implement `loadFromCache()` action
  - Load data using gdpStorage.loadGDPGNIData()
  - Update state with loaded data
  - Handle load errors gracefully

- [ ] Implement `setUploadedData(records: GDPGNIRecord[], fileName: string)` action
  - Separate records into absRecords and growthRecords
  - Calculate metadata (dateRange, totalYears, recordCount)
  - Save to localStorage via saveGDPGNIData()
  - Update state with new dataset
  - Set lastUploadedAt timestamp

---

## 🔍 Phase 2: Validation & Business Logic (1.5 hours)

**Status:** 🔴 0/11 tasks completed
**Priority:** 🔴 Critical - Needed for upload flow

### 📁 app/composables/useGDPGNIData.ts

- [ ] Implement `processGDPGNIFile(file: File): Promise<GDPGNIRecord[]>`
  - Use PapaParse to parse CSV with proper config
  - Transform raw data into GDPGNIRecord[]
  - Handle parsing errors with descriptive messages
  - Validate file size (< 5MB recommended)

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

- [ ] Implement `validateGDPGNIStructure(data: Record<string, unknown>[]): GDPGNIValidationError[]`
  - Check required columns: series, date, gdp, gni, gdp_capita, gni_capita
  - Validate each row for data integrity
  - Check series consistency (matching abs/growth pairs)
  - Return array of validation errors with severity levels

- [ ] Implement `getColumnValidation(column: string, data: Record<string, unknown>[]): GDPGNIColumnValidation`
  - Count empty cells per column
  - Count invalid cells per column
  - Collect specific validation errors
  - Generate warnings for suspicious values

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

- [ ] Implement `getHistoricalMilestones(): HistoricalMilestone[]`
  - Return predefined list: 1997-1998 Asian Crisis, 2008-2009 Global Crisis, 2020-2021 COVID-19
  - Include descriptions and impact classifications

- [ ] Implement `getMilestonesInRange(startYear: number, endYear: number): HistoricalMilestone[]`
  - Filter milestones within specified date range
  - Useful for contextual chart annotations

---

## 📤 Phase 3: Upload Page - 3-Step Flow (2.5 hours)

**Status:** 🔴 0/18 tasks completed
**Priority:** 🔴 Critical - Core user workflow

### 📁 app/pages/dosmgdp.vue

#### Step Structure & State
- [ ] Create page with UCard layout
- [ ] Add UStepper component with 3 steps
  - Step 1: "Upload GDP/GNI File"
  - Step 2: "Validate Structure & Data"
  - Step 3: "Review Statistics & Commit"
- [ ] Define reactive state variables
  - currentStep, selectedFile, fileData, rawData, headers, validationErrors, isProcessing, errorMessage

#### Step 1: File Upload
- [ ] Create drag & drop upload zone
  - Handle dragenter, dragleave, dragover, drop events
  - Visual feedback for drag state with border color changes
- [ ] Add file input (hidden) with click to browse
  - Accept only .csv files
  - Trigger from drop zone click
- [ ] Implement file validation
  - Check file extension (.csv only)
  - Validate file size (< 5MB)
  - Display file name and size
- [ ] Add info card about DOSM data source
  - Link to https://storage.dosm.gov.my/gdp/gdp_gni_annual_real.csv
  - Expected columns: series, date, gdp, gni, gdp_capita, gni_capita
  - Date range: 1970-2024
- [ ] Add "Process File" button
  - Disabled until file selected
  - Show loading state during processing
- [ ] Implement file processing logic
  - Call useGDPGNIData.processGDPGNIFile()
  - Store fileData, rawData, and headers
  - Auto-advance to Step 2 on success

#### Step 2: Data Validation
- [ ] Create summary statistics cards
  - Total Records (fileData.length)
  - Total Columns (should be 6)
  - Missing Values count
  - Validation Errors count
  - Color-coded badges
- [ ] Add data preview table (first 10 rows)
  - Show all 6 columns
  - Highlight invalid/empty cells
  - Use UTable component
- [ ] Create column quality check cards (loop through 6 columns)
  - Display column name with icon
  - Show empty cells count (UBadge)
  - Show invalid cells count (UBadge)
  - List validation errors (expandable with UAccordion)
- [ ] Add series consistency check
  - Verify each year has both 'abs' and 'growth_yoy' records
  - Flag missing pairs as warnings
- [ ] Add data quality alert
  - Red: Critical errors (block progression)
  - Yellow: Warnings (allow with confirmation)
  - Green: All validations passed
- [ ] Add navigation buttons
  - "Back to Upload" → currentStep = 1
  - "Continue to Review" → currentStep = 3 (disabled if critical errors)

#### Step 3: Review & Commit
- [ ] Create basic statistics cards (grid layout)
  - Total Years, Date Range, Total Records, Latest Year
- [ ] Add latest values showcase (2 sections)
  - Absolute Values section (GDP, GNI, GDP/capita, GNI/capita in RM millions/RM)
  - Growth Rates section (4 metrics in %)
- [ ] Add dataset information card
  - Dataset name, file name, DOSM attribution, CC BY 4.0 license
  - Last DOSM update: Feb 2025, Next update: Feb 2026
- [ ] Implement commit logic
  - Call gdpStore.setUploadedData()
  - Show loading spinner
  - Handle localStorage errors
  - Display success toast
- [ ] Add navigation buttons
  - "Back to Validation" → currentStep = 2
  - "Commit Data & View Dashboard" → save and redirect
- [ ] Implement redirect to /dosmgdp-dashboard
  - Use router.push('/dosmgdp-dashboard')
  - Clear upload state

---

## 📊 Phase 4: Dashboard - Full Analytics (4 hours)

**Status:** 🔴 0/28 tasks completed
**Priority:** 🟡 Important - Main data viewing interface

### 📁 app/pages/dosmgdp-dashboard.vue

#### Page Structure & State
- [ ] Create page layout with responsive container
- [ ] Define reactive state
  - selectedMetric, startYear, endYear, filteredData, showMilestones, viewMode
- [ ] Load data from store on mount
  - Check if data exists, redirect to /dosmgdp if empty
- [ ] Create computed properties
  - absRecords, growthRecords, currentMilestones, basicStats

#### Header Section
- [ ] Create page header with title and subtitle
  - Title: "GDP & GNI Analytics Dashboard"
  - Subtitle: "Annual Real Values (1970-2024)"
- [ ] Display metadata badges
  - Last uploaded (formatted with date-fns)
  - Total records, Date range, DOSM badge with link
- [ ] Add action buttons
  - "Upload New Data" → /dosmgdp
  - "Export Current View" → Export CSV
  - "Refresh" → Reload from cache

#### Filter Controls
- [ ] Create metric selector dropdown (USelectMenu)
  - Options: GDP, GNI, GDP per Capita, GNI per Capita
  - v-model: selectedMetric
  - Icons for each metric
- [ ] Add date range filter (2 number inputs)
  - Start Year (min=1970, max=endYear)
  - End Year (min=startYear, max=2024)
  - Validation: end >= start
- [ ] Add quick range buttons
  - "Last 5 Years" (2019-2024)
  - "Last 10 Years" (2014-2024)
  - "Last 20 Years" (2004-2024)
  - "All Time" (1970-2024)
- [ ] Add milestone toggle switch
  - Label: "Show Historical Milestones"
  - v-model: showMilestones
- [ ] Add view mode toggle
  - Buttons: "Charts" | "Table"
  - v-model: viewMode
- [ ] Add "Reset All Filters" button
  - Reset to defaults

#### Summary Statistics Cards
- [ ] Create responsive grid (4 cols desktop, 2 tablet, 1 mobile)
- [ ] Add latest absolute values cards (4 metrics)
  - Large number, metric name, year, YoY change badge
  - Trend indicator (↑/↓)
- [ ] Add latest growth rates cards (4 metrics)
  - % values, color-coded (green positive, red negative)
  - Comparison to 5-year average

#### Charts Section - Dual Axis View
- [ ] Create dual-axis line chart component
  - Component: `DOSMGDPDualAxisChart.vue`
  - Left Y-axis: Absolute values
  - Right Y-axis: Growth rates (%)
  - Two lines: Abs (blue), Growth (orange)
  - Milestone markers if enabled
  - Props: metric, absRecords, growthRecords, milestones

#### Charts Section - Multi-Metric Comparison
- [ ] Create 4-metric comparison chart (abs values)
  - Component: `DOSMGDPComparisonChart.vue`
  - Dual Y-axis: GDP/GNI (left), per capita (right)
  - Legend with toggle for individual metrics
- [ ] Create 4-metric growth comparison chart
  - Component: `DOSMGDPGrowthComparisonChart.vue`
  - Single Y-axis (% values)
  - Highlight crisis periods with shaded regions

#### Charts Section - Metric Cards
- [ ] Create reusable metric card component
  - Component: `DOSMGDPMetricCard.vue`
  - Mini dual-axis chart, latest value, quick stats (min/max/avg)
- [ ] Add GDP metric card
- [ ] Add GNI metric card
- [ ] Add GDP per Capita metric card
- [ ] Add GNI per Capita metric card

#### Historical Context
- [ ] Create historical timeline component
  - Component: `DOSMHistoricalTimeline.vue`
  - Horizontal timeline with event markers
  - Click to highlight on charts
  - Event descriptions in popover
- [ ] Add crisis impact analysis cards
  - Show % decline/recovery for each crisis
  - Before/during/after comparison

#### Data Table
- [ ] Create comprehensive data table component
  - Component: `DOSMGDPDataTable.vue`
  - 9 columns: Year + 4 metrics × 2 series
  - Sortable, paginated (20 rows/page)
  - Sticky header
- [ ] Add table controls
  - Search by year
  - Column visibility toggles
  - Density options
- [ ] Implement export functionality
  - Export filtered rows as CSV
  - Use PapaParse unparse

#### Comparison & Analysis
- [ ] Add decade averages chart
  - Bar chart by decade (1970s, 1980s, etc.)
  - Compare metrics across decades
- [ ] Add year-over-year change table
  - Top 5 best/worst growth years per metric

---

## 🧭 Phase 5: Navigation & Integration (0.5 hour)

**Status:** 🔴 0/4 tasks completed
**Priority:** 🟡 Important - User discovery

### 📁 app/layouts/default.vue

- [ ] Locate DOSM section in sidebar (below CPI links)
- [ ] Add "GDP/GNI Upload" link
  - Route: /dosmgdp
  - Icon: i-lucide-trending-up
  - Label: "GDP/GNI Upload"
- [ ] Add "GDP/GNI Dashboard" link
  - Route: /dosmgdp-dashboard
  - Icon: i-lucide-line-chart
  - Label: "GDP/GNI Dashboard"
- [ ] Test navigation and active route highlighting

---

## 🎨 Phase 6: Polish, Testing & Documentation (1.5 hours)

**Status:** 🔴 0/8 tasks completed
**Priority:** 🟢 Nice to have - Quality improvements

### Error Handling & Edge Cases

- [ ] Test file upload edge cases
  - Empty CSV, missing columns, extra columns, malformed CSV, large files
- [ ] Test data validation edge cases
  - Missing series types, duplicate years, date gaps, extreme outliers
  - Non-numeric values, invalid series values
- [ ] Test localStorage edge cases
  - Disabled localStorage, quota exceeded, corrupted data

### Loading & Empty States

- [ ] Add loading states to all async operations
  - File processing spinner
  - Chart loading skeletons
  - Table loading state
- [ ] Add empty states
  - No data uploaded (dashboard)
  - No records match filter
  - Upload page initial state

### Manual Testing

- [ ] Test complete upload flow
  - Download official DOSM CSV
  - Upload via drag-drop
  - Verify validation, commit, view dashboard
- [ ] Test dashboard functionality
  - All charts render correctly
  - Dual-axis charts show both series
  - Filters work (metric, date range)
  - Milestones toggle on/off
  - Table sorting, pagination, export
  - Data persists after refresh

### Code Quality

- [ ] Run linter and fix issues (bun run lint:fix)
- [ ] Add JSDoc comments to all functions
- [ ] Update this file with completion times and notes

---

## 📝 Implementation Notes

### Dataset Characteristics
- **4 metrics:** GDP, GNI, GDP per capita, GNI per capita
- **2 series types:** Absolute (RM millions/RM) and Year-over-year growth (%)
- **55 years:** 1970-2024
- **~110 records:** 55 years × 2 series

### Key Differences from CPI
- Multiple metrics (4) vs. single inflation metric
- Series types (abs/growth) vs. division codes
- Longer time span (55 years) vs. ~5-10 years
- Dual-axis charts required
- Historical milestone context

### Files to Create

**Types & Utilities:**
- `app/types/gdp.ts` - TypeScript interfaces
- `app/utils/gdpStorage.ts` - localStorage utilities
- `app/stores/gdpStore.ts` - State management

**Composables:**
- `app/composables/useGDPGNIData.ts` - Data processing and validation

**Pages:**
- `app/pages/dosmgdp.vue` - 3-step upload flow
- `app/pages/dosmgdp-dashboard.vue` - Analytics dashboard

**Components:**
- `app/components/DOSM/GDP/DualAxisChart.vue` - Single metric dual-axis chart
- `app/components/DOSM/GDP/ComparisonChart.vue` - Multi-metric comparison (abs)
- `app/components/DOSM/GDP/GrowthComparisonChart.vue` - Multi-metric comparison (growth)
- `app/components/DOSM/GDP/MetricCard.vue` - Reusable metric card with mini chart
- `app/components/DOSM/GDP/DataTable.vue` - Comprehensive data table
- `app/components/DOSM/HistoricalTimeline.vue` - Timeline for economic events

**Modified:**
- `app/layouts/default.vue` - Add GDP/GNI navigation links

### Dependencies
- ✅ **PapaParse** - Already installed
- ✅ **Chart.js** - Already installed
- ✅ **date-fns** - Already installed
- ⚠️ **chartjs-plugin-annotation** - May need to install for milestone markers

### Technical Highlights (To Be Achieved)
- TypeScript type safety throughout
- Dual-axis Chart.js integration
- Robust CSV parsing with PapaParse
- localStorage persistence with quota handling
- Nuxt UI components for consistency
- Historical milestone annotations
- Multi-metric comparison views
- Date range filtering
- Responsive design
- Export functionality

---

## ✅ Completion Checklist

- [ ] All 83 tasks completed
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Data persists correctly in localStorage
- [ ] Navigation works smoothly
- [ ] All charts render correctly with dual axes
- [ ] All 4 metrics display properly
- [ ] Historical milestones appear on charts
- [ ] Validation catches all invalid data
- [ ] Export functionality works
- [ ] Date range filtering works
- [ ] Code is well-documented
- [ ] ESLint passes with no errors
- [ ] Build succeeds without errors
- [ ] Feature fully tested and functional

---

## 🎯 Ready to Start!

**Status:** 📋 Ready for Implementation
**Next Step:** Begin Phase 1 - Data Layer & Foundation

---

**Created:** 2025-10-24
**Last Updated:** 2025-10-24
**Implemented By:** TBD
