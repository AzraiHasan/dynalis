/**
 * GDP/GNI Data Types for DOSM Dataset Integration
 * Dataset: Annual Real GDP & GNI (1970-2024)
 * Source: https://storage.dosm.gov.my/gdp/gdp_gni_annual_real.csv
 */

/**
 * Metric types available in the GDP/GNI dataset
 */
export type MetricType = 'gdp' | 'gni' | 'gdp_capita' | 'gni_capita'

/**
 * Represents a single GDP/GNI record from the DOSM dataset
 */
export interface GDPGNIRecord {
  /** Series type: 'abs' for absolute values or 'growth_yoy' for year-over-year growth rates */
  series: 'abs' | 'growth_yoy'

  /** Date in ISO format (YYYY-MM-DD) */
  date: string

  /** Gross Domestic Product (RM millions for abs, % for growth_yoy) */
  gdp: number

  /** Gross National Income (RM millions for abs, % for growth_yoy) */
  gni: number

  /** GDP per capita (RM for abs, % for growth_yoy) */
  gdp_capita: number

  /** GNI per capita (RM for abs, % for growth_yoy) */
  gni_capita: number
}

/**
 * Complete GDP/GNI dataset with metadata
 */
export interface GDPGNIDataset {
  /** All records from the dataset */
  records: GDPGNIRecord[]

  /** Filtered absolute value records only */
  absRecords: GDPGNIRecord[]

  /** Filtered year-over-year growth records only */
  growthRecords: GDPGNIRecord[]

  /** Timestamp when data was last updated */
  lastUpdated: string

  /** Original filename of uploaded data */
  fileName: string

  /** Dataset metadata */
  metadata: {
    /** Date range covered by the dataset */
    dateRange: {
      start: string
      end: string
    }

    /** Total number of years spanned */
    totalYears: number

    /** Total number of records */
    recordCount: number

    /** Most recent year in the dataset */
    latestYear: number
  }
}

/**
 * Validation error details for GDP/GNI data
 */
export interface GDPGNIValidationError {
  /** Row number where error occurred (1-indexed) */
  row: number

  /** Column name where error occurred */
  column: string

  /** The invalid value */
  value: unknown

  /** Error message describing the issue */
  error: string

  /** Severity level of the error */
  severity: 'critical' | 'warning' | 'info'
}

/**
 * Column-level validation results
 */
export interface GDPGNIColumnValidation {
  /** Number of empty cells in this column */
  emptyCells: number

  /** Number of invalid cells in this column */
  invalidCells: number

  /** Specific validation errors for this column */
  errors: GDPGNIValidationError[]

  /** Warnings for this column */
  warnings: GDPGNIValidationError[]
}

/**
 * Basic statistical summary of GDP/GNI data
 */
export interface GDPGNIBasicStats {
  /** Total number of records */
  totalRecords: number

  /** Date range of the dataset */
  dateRange: {
    start: string
    end: string
  }

  /** Most recent year in the dataset */
  latestYear: number

  /** Latest absolute values for all metrics */
  latestAbsValues: {
    gdp: number
    gni: number
    gdp_capita: number
    gni_capita: number
  }

  /** Latest year-over-year growth rates for all metrics */
  latestGrowthRates: {
    gdp: number
    gni: number
    gdp_capita: number
    gni_capita: number
  }
}

/**
 * Impact type for historical economic events
 */
export type HistoricalImpact = 'crisis' | 'recovery' | 'milestone'

/**
 * Historical milestone or economic event
 */
export interface HistoricalMilestone {
  /** Year of the event */
  year: number

  /** Event name/title */
  event: string

  /** Detailed description of the event */
  description: string

  /** Impact classification */
  impact: HistoricalImpact
}
