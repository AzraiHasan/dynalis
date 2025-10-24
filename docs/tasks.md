# DOSM CPI Integration - Implementation Tasks

**Branch:** `dosm_demo`
**Plan Document:** [dosm-cpi-integration-plan.md](./dosm-cpi-integration-plan.md)
**Estimated Total Time:** 6-8 hours
**Status:** 0/67 tasks completed (0%)

---

## 📊 Progress Overview

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1: Data Layer & Foundation | 13 | 0 | ⏳ Not Started |
| Phase 2: Validation & Business Logic | 9 | 0 | ⏳ Not Started |
| Phase 3: Upload Page - 3-Step Flow | 18 | 0 | ⏳ Not Started |
| Phase 4: Dashboard - Full Analytics | 17 | 0 | ⏳ Not Started |
| Phase 5: Navigation & Integration | 4 | 0 | ⏳ Not Started |
| Phase 6: Polish, Testing & Documentation | 6 | 0 | ⏳ Not Started |
| **TOTAL** | **67** | **0** | **0%** |

---

## 🎯 Phase 1: Data Layer & Foundation (1.5 hours)

**Status:** 0/13 tasks completed
**Priority:** 🔴 Critical - Foundation for all other phases

### 📁 app/types/cpi.ts

- [ ] Create `CPIRecord` interface
  - Fields: date (string), division (string), inflation (number)
  - Add JSDoc comments
- [ ] Create `CPIDataset` interface
  - Fields: records, lastUpdated, fileName, metadata
  - Include dateRange, divisions, recordCount in metadata
- [ ] Create `CPIValidationError` interface
  - Fields: row, column, value, error
- [ ] Create `CPIColumnValidation` interface
  - Fields: emptyCells, invalidCells, errors[]
- [ ] Create `CPIBasicStats` interface
  - Fields: totalRecords, dateRange, numberOfDivisions, latestYear

### 📁 app/utils/cpiStorage.ts

- [ ] Implement `saveCPIData(data: CPIDataset): void`
  - Save to localStorage with key: `dynalis-cpi-data`
  - Handle JSON stringify errors
- [ ] Implement `loadCPIData(): CPIDataset | null`
  - Load from localStorage
  - Handle JSON parse errors
  - Return null if not found or invalid
- [ ] Implement `clearCPIData(): void`
  - Remove from localStorage
- [ ] Implement `getCacheAge(): number | null`
  - Calculate milliseconds since lastUpdated
  - Return null if no data

### 📁 app/stores/cpiStore.ts

- [ ] Create store with Pinia `defineStore('cpi', ...)`
- [ ] Define state: `cpiData`, `isLoading`, `error`, `lastUploadedAt`
- [ ] Implement `loadFromCache()` action
  - Load data using cpiStorage.loadCPIData()
  - Update state
- [ ] Implement `setUploadedData(data: CPIRecord[], fileName: string)` action
  - Process records into CPIDataset format
  - Calculate metadata (dateRange, divisions, recordCount)
  - Save to localStorage
  - Update state
- [ ] Implement `clearData()` action
  - Clear localStorage
  - Reset state
- [ ] Implement `getBasicStats()` getter
  - Calculate CPIBasicStats from cpiData
  - Return null if no data

---

## 🔍 Phase 2: Validation & Business Logic (1.5 hours)

**Status:** 0/9 tasks completed
**Priority:** 🔴 Critical - Needed for upload flow

### 📁 app/composables/useCPIData.ts

- [ ] Implement `processCPIFile(file: File): Promise<CPIRecord[]>`
  - Use PapaParse to parse CSV
  - Return array of records
  - Handle parse errors
- [ ] Implement `validateCPIStructure(data: any[]): CPIValidationError[]`
  - Check required columns exist (date, division, inflation)
  - Validate each row with strict checks
  - Return array of validation errors
- [ ] Implement date validation helper
  - Check ISO format (YYYY-MM-DD)
  - Use regex or date-fns parse
- [ ] Implement division validation helper
  - Check value is "overall" or "01"-"13"
  - Case-sensitive check
- [ ] Implement inflation validation helper
  - Check is numeric (parseFloat)
  - Allow negative values
  - Reject NaN
- [ ] Implement `getColumnValidation(column: string, data: any[]): CPIColumnValidation`
  - Count empty cells per column
  - Count invalid cells per column
  - Collect validation errors
- [ ] Implement `calculateBasicStats(records: CPIRecord[]): CPIBasicStats`
  - Find min/max dates for dateRange
  - Count unique divisions
  - Get latest year
- [ ] Implement `filterByDivision(division: string): CPIRecord[]`
  - Filter records by division code
- [ ] Implement `filterByDateRange(start: string, end: string): CPIRecord[]`
  - Filter records between date range

---

## 📤 Phase 3: Upload Page - 3-Step Flow (2-3 hours)

**Status:** 0/18 tasks completed
**Priority:** 🔴 Critical - Core user workflow

### 📁 app/pages/dosmupload.vue

#### Step Structure & State
- [ ] Create page with UCard layout
- [ ] Add UStepper component with 3 steps
  - Step 1: "Upload File"
  - Step 2: "Validate Data"
  - Step 3: "Review & Commit"
- [ ] Define reactive state variables
  - currentStep, selectedFile, fileData, headers, isProcessing, errorMessage

#### Step 1: File Upload
- [ ] Create drag & drop upload zone
  - Handle dragenter, dragleave, dragover, drop events
  - Visual feedback for drag state
- [ ] Add file input (hidden) with click to browse
- [ ] Implement file validation
  - Accept only .csv files
  - Check file extension
  - Display file name and size
- [ ] Add "Process File" button
  - Disabled until file selected
  - Show loading state during processing
- [ ] Add info card about DOSM data source
  - Link to https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv
  - Instructions to download and upload
- [ ] Implement file processing logic
  - Call useCPIData.processCPIFile()
  - Store fileData and headers
  - Auto-advance to Step 2 on success

#### Step 2: Data Validation
- [ ] Create summary statistics cards
  - Total Rows (fileData.length)
  - Total Columns (should be 3)
  - Missing Values count
  - Invalid Values count
- [ ] Add data preview table (first 5 rows)
  - Show all 3 columns
  - Handle empty/invalid cell display
- [ ] Create column quality check cards (loop through 3 columns)
  - Display column name
  - Show empty cells count with badge
  - Show invalid cells count with badge
  - List validation errors (expandable)
- [ ] Add data quality alert
  - Warning color if issues detected
  - Success color if all clean
- [ ] Add navigation buttons
  - "Back to Upload" → currentStep = 1
  - "Continue to Review" → currentStep = 3

#### Step 3: Review & Commit
- [ ] Create basic statistics cards
  - Total Records
  - Date Range (earliest to latest year)
  - Number of Divisions
  - Latest Year Available
- [ ] Add data type information card
  - Explain this is CPI inflation data
  - Display file name
- [ ] Implement commit logic
  - Call cpiStore.setUploadedData()
  - Show loading state
  - Handle errors
- [ ] Add navigation buttons
  - "Back to Validation" → currentStep = 2
  - "Commit Data & Continue" → commit and redirect
- [ ] Implement redirect to /dosm-dashboard
  - Use router.push('/dosm-dashboard')
  - Show success toast

### 📁 app/components/DOSM/ (Optional - can inline in page)

- [ ] Create `UploadZone.vue` component (if extracting from page)
  - Props: disabled
  - Events: @file-selected, @file-dropped
- [ ] Create `ValidationCard.vue` component (if extracting from page)
  - Props: column, validation
- [ ] Create `StatsCard.vue` component (if extracting from page)
  - Props: title, value, icon, description

---

## 📊 Phase 4: Dashboard - Full Analytics (2-3 hours)

**Status:** 0/17 tasks completed
**Priority:** 🟡 Important - Main data viewing interface

### 📁 app/pages/dosm-dashboard.vue

#### Page Structure & State
- [ ] Create page layout with container
- [ ] Define reactive state
  - selectedDivision, startYear, endYear, filteredData, chartData
- [ ] Load CPI data from store on mount
  - Check if data exists, redirect to /dosmupload if empty
- [ ] Implement no data state
  - Empty state message
  - "Upload CPI Data" button → /dosmupload

#### Header Section
- [ ] Create header with page title
- [ ] Display metadata
  - Last uploaded timestamp (format with date-fns)
  - Record count
  - Date range (start - end)
- [ ] Add "Upload New Data" button
  - Redirects to /dosmupload

#### Filter Controls
- [ ] Add division selector dropdown (USelect)
  - Options: "All", "overall", "01"-"13"
  - v-model: selectedDivision
  - Update filteredData on change
- [ ] Add "Reset Filters" button
  - Reset selectedDivision, startYear, endYear
- [ ] Add "Export Data" button
  - Icon: i-lucide-download
  - Export filteredData to CSV

#### Charts Section
- [ ] Create grid layout for charts (2 columns)
- [ ] Add line chart (full width, 2 columns)
  - Component: DOSMInflationLineChart
  - Pass filtered data
- [ ] Add bar chart (1 column)
  - Component: DOSMDivisionBarChart
  - Pass latest year data
- [ ] Add comparison chart (1 column)
  - Component: DOSMComparisonChart
  - Pass multi-division data

#### Data Table Section
- [ ] Add data table component
  - Component: DOSMCPIDataTable
  - Props: data, loading
  - Events: @sort, @export
- [ ] Implement sort handler
- [ ] Implement export handler (CSV download)

### 📁 app/components/DOSM/DashboardHeader.vue

- [ ] Create component with props: lastUpdated, recordCount, dateRange
- [ ] Display metadata in formatted layout
- [ ] Add "Upload New Data" button
- [ ] Emit @upload-new event

### 📁 app/components/DOSM/InflationLineChart.vue

- [ ] Import Chart.js and vue-chartjs
- [ ] Create Line chart component
- [ ] Configure chart options
  - X-axis: Years (extract from date)
  - Y-axis: Inflation rate (%)
  - Responsive: true
  - Tooltip with formatted values
- [ ] Process data for chart format
  - Filter for "overall" division (or selected)
  - Sort by date
- [ ] Add props: data, division (optional)

### 📁 app/components/DOSM/DivisionBarChart.vue

- [ ] Import Chart.js and vue-chartjs
- [ ] Create Bar chart component
- [ ] Configure chart options
  - X-axis: Division codes
  - Y-axis: Inflation rate (%)
  - Color-coded bars
- [ ] Process data for chart format
  - Filter for latest year (or selected year)
  - Group by division
- [ ] Add props: data, year

### 📁 app/components/DOSM/ComparisonChart.vue

- [ ] Import Chart.js and vue-chartjs
- [ ] Create multi-line chart component
- [ ] Configure chart options
  - Multiple datasets (one per division)
  - Legend with toggle functionality
  - Interactive tooltips
- [ ] Process data for chart format
  - Create dataset for each division
  - Sort by date
- [ ] Add props: data, divisions[]

### 📁 app/components/DOSM/CPIDataTable.vue

- [ ] Create table with UTable (or custom table)
- [ ] Define columns: date, division, inflation
- [ ] Implement sorting
  - Click column header to sort
  - Toggle asc/desc
  - Emit @sort event
- [ ] Implement pagination
  - 50 rows per page
  - Use UPagination component
- [ ] Add loading skeleton
  - Show when loading prop is true
- [ ] Add empty state
  - Show when no data
- [ ] Add export button
  - Emit @export event
- [ ] Add props: data, loading
- [ ] Add events: @sort, @export

---

## 🧭 Phase 5: Navigation & Integration (0.5 hour)

**Status:** 0/4 tasks completed
**Priority:** 🟡 Important - User discovery

### 📁 Find Navigation Component

- [ ] Locate sidebar navigation file
  - Check app/layouts/default.vue
  - Or app/components/Navigation.vue
  - Or app/components/Sidebar.vue

### 📁 Update Navigation

- [ ] Add "DOSM Upload" link below "Data Upload"
  - Route: /dosmupload
  - Icon: i-lucide-upload (or i-lucide-file-up)
  - Label: "DOSM Upload"
- [ ] Add "DOSM Dashboard" link below "DOSM Upload"
  - Route: /dosm-dashboard
  - Icon: i-lucide-chart-line (or i-lucide-bar-chart)
  - Label: "DOSM Dashboard"
- [ ] Test active route highlighting
  - Ensure current route is highlighted
  - Test navigation between pages

---

## 🎨 Phase 6: Polish, Testing & Documentation (1 hour)

**Status:** 0/6 tasks completed
**Priority:** 🟢 Nice to have - Quality improvements

### Error Handling & Edge Cases

- [ ] Test and handle all edge cases
  - Empty CSV file
  - CSV with missing columns
  - CSV with wrong column names
  - Invalid date formats
  - Invalid division codes
  - Non-numeric inflation values
  - localStorage full
  - Browser with localStorage disabled

### Loading & Empty States

- [ ] Add loading states to all async operations
  - File processing spinner
  - Chart loading skeletons
  - Table loading state
- [ ] Add empty states
  - No data uploaded (dashboard)
  - No records match filter
  - Upload page initial state

### Testing

- [ ] Manual test full 3-step upload flow
  - Upload CSV → Validate → Commit → Dashboard
- [ ] Test validation with various CSV formats
  - Valid data (should pass)
  - Invalid dates (should show errors)
  - Invalid divisions (should show errors)
  - Invalid inflation (should show errors)
- [ ] Test dashboard functionality
  - All charts render correctly
  - Filters work (division selector)
  - Sorting works (table)
  - Export works (CSV download)
  - Data persists after refresh

### Documentation

- [ ] Update CLAUDE.md
  - Add section about DOSM CPI module
  - Document pages and components
  - Explain data flow
- [ ] Add JSDoc comments to all public functions
  - useCPIData composable functions
  - Store actions and getters
  - Component props and events

### Final Testing Checklist

- [ ] Test in Chrome/Edge
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Test mobile responsive (Chrome DevTools)
- [ ] Test with real DOSM CSV file
  - Download from https://storage.dosm.gov.my/cpi/cpi_2d_annual_inflation.csv
  - Upload and verify all features

---

## 📝 Notes & Issues

**Blockers:**
- None currently

**Questions:**
- None currently

**Nice to Have (Future):**
- Date range picker for filtering
- Year-over-year change calculations
- Advanced export (PDF, Excel)
- Search within table
- Mobile responsive optimization

---

## ✅ Completion Checklist

Before marking the implementation as complete:

- [ ] All 67 tasks completed
- [ ] All tests pass
- [ ] No console errors
- [ ] Data persists correctly in localStorage
- [ ] Navigation works smoothly
- [ ] All charts render correctly
- [ ] Validation catches all invalid data
- [ ] Export functionality works
- [ ] Code is well-documented
- [ ] CLAUDE.md is updated
- [ ] Git commit and push all changes
- [ ] Create pull request (if needed)
- [ ] Demo the feature to stakeholders

---

**Last Updated:** 2024-10-24
**Next Action:** Start Phase 1 - Create type definitions in `app/types/cpi.ts`
