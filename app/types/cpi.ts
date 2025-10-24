/**
 * CPI (Consumer Price Index) Type Definitions
 * For DOSM Malaysia CPI Inflation Data
 */

/**
 * Represents a single CPI data record from DOSM
 * @property date - Date in ISO format (YYYY-MM-DD)
 * @property division - Division code: "overall" or "01"-"13"
 * @property inflation - Inflation rate as a number (can be negative)
 */
export interface CPIRecord {
  date: string
  division: string
  inflation: number
}

/**
 * Metadata about the CPI dataset
 * @property dateRange - Object containing earliest and latest dates
 * @property divisions - Array of unique division codes in the dataset
 * @property recordCount - Total number of records in the dataset
 */
export interface CPIMetadata {
  dateRange: {
    earliest: string
    latest: string
  }
  divisions: string[]
  recordCount: number
}

/**
 * Complete CPI dataset with metadata
 * @property records - Array of CPI records
 * @property lastUpdated - ISO timestamp of when data was last uploaded
 * @property fileName - Original name of the uploaded file
 * @property metadata - Statistical metadata about the dataset
 */
export interface CPIDataset {
  records: CPIRecord[]
  lastUpdated: string
  fileName: string
  metadata: CPIMetadata
}

/**
 * Validation error for a specific cell in the CPI data
 * @property row - Row number (0-indexed)
 * @property column - Column name
 * @property value - The invalid value
 * @property error - Description of the validation error
 */
export interface CPIValidationError {
  row: number
  column: string
  value: unknown
  error: string
}

/**
 * Validation results for a single column
 * @property emptyCells - Count of empty cells in the column
 * @property invalidCells - Count of invalid cells in the column
 * @property errors - Array of validation errors for the column
 */
export interface CPIColumnValidation {
  emptyCells: number
  invalidCells: number
  errors: CPIValidationError[]
}

/**
 * Basic statistics about the CPI dataset
 * @property totalRecords - Total number of records
 * @property dateRange - Object containing start and end years
 * @property numberOfDivisions - Count of unique divisions
 * @property latestYear - Most recent year in the dataset
 */
export interface CPIBasicStats {
  totalRecords: number
  dateRange: {
    start: string
    end: string
  }
  numberOfDivisions: number
  latestYear: number
}

/**
 * Division information for filtering and display
 * @property code - Division code
 * @property label - Human-readable label
 */
export interface CPIDivision {
  code: string
  label: string
}

/**
 * Filter options for dashboard
 * @property division - Selected division code or "all"
 * @property startYear - Start year filter (optional)
 * @property endYear - End year filter (optional)
 */
export interface CPIFilterOptions {
  division: string
  startYear?: number
  endYear?: number
}
