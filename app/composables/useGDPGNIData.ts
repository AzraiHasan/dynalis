/**
 * GDP/GNI Data Processing and Validation Composable
 * Handles CSV parsing, validation, statistics, and filtering
 */

import Papa from 'papaparse'
import { parse, isValid } from 'date-fns'
import type {
  GDPGNIRecord,
  GDPGNIValidationError,
  GDPGNIColumnValidation,
  GDPGNIBasicStats,
  HistoricalMilestone,
} from '~/types/gdp'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MIN_YEAR = 1970
const MAX_YEAR = 2024

/**
 * Required columns in the GDP/GNI CSV file
 */
const REQUIRED_COLUMNS = ['series', 'date', 'gdp', 'gni', 'gdp_capita', 'gni_capita']

/**
 * Historical economic milestones for Malaysia
 */
const MILESTONES: HistoricalMilestone[] = [
  {
    year: 1997,
    event: '1997-1998 Asian Financial Crisis',
    description: 'Regional currency crisis that led to severe economic contraction across Southeast Asia',
    impact: 'crisis',
  },
  {
    year: 1998,
    event: 'Asian Crisis Recovery Begins',
    description: 'Implementation of capital controls and economic reforms',
    impact: 'recovery',
  },
  {
    year: 2008,
    event: '2008-2009 Global Financial Crisis',
    description: 'Worldwide economic downturn triggered by US subprime mortgage crisis',
    impact: 'crisis',
  },
  {
    year: 2009,
    event: 'Post-GFC Recovery',
    description: 'Economic stimulus and recovery measures implemented',
    impact: 'recovery',
  },
  {
    year: 2020,
    event: 'COVID-19 Pandemic',
    description: 'Global pandemic causing unprecedented economic disruption and lockdowns',
    impact: 'crisis',
  },
  {
    year: 2021,
    event: 'COVID-19 Recovery Phase',
    description: 'Gradual economic reopening and recovery measures',
    impact: 'recovery',
  },
]

export function useGDPGNIData() {
  /**
   * Process GDP/GNI CSV file and parse into records
   * @param file - The CSV file to process
   * @returns Promise resolving to array of GDP/GNI records
   */
  async function processGDPGNIFile(file: File): Promise<GDPGNIRecord[]> {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds 5MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`)
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      throw new Error('Invalid file type. Please upload a CSV file.')
    }

    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // We'll handle type conversion manually
        complete: (results) => {
          try {
            if (results.errors.length > 0) {
              const errorMessages = results.errors.map(e => e.message).join(', ')
              throw new Error(`CSV parsing errors: ${errorMessages}`)
            }

            if (!results.data || results.data.length === 0) {
              throw new Error('CSV file is empty or contains no valid data')
            }

            // Transform to GDPGNIRecord[]
            const records: GDPGNIRecord[] = results.data.map((row, index) => {
              const series = row.series?.trim() as 'abs' | 'growth_yoy'
              const date = row.date?.trim()
              const gdp = parseFloat(row.gdp)
              const gni = parseFloat(row.gni)
              const gdp_capita = parseFloat(row.gdp_capita)
              const gni_capita = parseFloat(row.gni_capita)

              // Validate required fields
              if (!series || !date) {
                throw new Error(`Row ${index + 2}: Missing required fields (series or date)`)
              }

              if (isNaN(gdp) || isNaN(gni) || isNaN(gdp_capita) || isNaN(gni_capita)) {
                throw new Error(`Row ${index + 2}: Invalid numeric values`)
              }

              return {
                series,
                date,
                gdp,
                gni,
                gdp_capita,
                gni_capita,
              }
            })

            resolve(records)
          }
          catch (error) {
            reject(error instanceof Error ? error : new Error('Failed to process CSV data'))
          }
        },
        error: (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`))
        },
      })
    })
  }

  /**
   * Validate series type value
   * @param value - The series value to validate
   * @returns True if valid, false otherwise
   */
  function validateSeriesType(value: string): boolean {
    return value === 'abs' || value === 'growth_yoy'
  }

  /**
   * Validate date format and range
   * @param value - The date string to validate
   * @returns True if valid, false otherwise
   */
  function validateDate(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false
    }

    // Check ISO format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(value)) {
      return false
    }

    // Parse and validate using date-fns
    const parsedDate = parse(value, 'yyyy-MM-dd', new Date())
    if (!isValid(parsedDate)) {
      return false
    }

    // Validate year range
    const year = parsedDate.getFullYear()
    return year >= MIN_YEAR && year <= MAX_YEAR
  }

  /**
   * Validate numeric value
   * @param value - The value to validate
   * @returns True if valid, false otherwise
   */
  function validateNumericValue(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return false
    }

    const num = typeof value === 'number' ? value : parseFloat(String(value))

    // Reject NaN and Infinity
    if (isNaN(num) || !isFinite(num)) {
      return false
    }

    // Allow negative values (growth rates can be negative)
    return true
  }

  /**
   * Validate GDP/GNI data structure and integrity
   * @param data - Raw data to validate
   * @returns Array of validation errors
   */
  function validateGDPGNIStructure(data: Record<string, unknown>[]): GDPGNIValidationError[] {
    const errors: GDPGNIValidationError[] = []

    if (!data || data.length === 0) {
      errors.push({
        row: 0,
        column: 'general',
        value: null,
        error: 'No data found in file',
        severity: 'critical',
      })
      return errors
    }

    // Check for required columns
    const firstRow = data[0]
    const missingColumns = REQUIRED_COLUMNS.filter(col => !(col in firstRow))

    if (missingColumns.length > 0) {
      errors.push({
        row: 0,
        column: 'general',
        value: missingColumns,
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        severity: 'critical',
      })
      return errors
    }

    // Track years and series for consistency check
    const yearSeriesMap = new Map<number, Set<string>>()

    // Validate each row
    data.forEach((row, index) => {
      const rowNum = index + 2 // Account for header row

      // Validate series
      if (!validateSeriesType(String(row.series))) {
        errors.push({
          row: rowNum,
          column: 'series',
          value: row.series,
          error: 'Invalid series type. Must be "abs" or "growth_yoy"',
          severity: 'critical',
        })
      }

      // Validate date
      if (!validateDate(String(row.date))) {
        errors.push({
          row: rowNum,
          column: 'date',
          value: row.date,
          error: `Invalid date format or range. Expected YYYY-MM-DD between ${MIN_YEAR} and ${MAX_YEAR}`,
          severity: 'critical',
        })
      }
      else {
        // Track series consistency
        const year = new Date(String(row.date)).getFullYear()
        if (!yearSeriesMap.has(year)) {
          yearSeriesMap.set(year, new Set())
        }
        yearSeriesMap.get(year)!.add(String(row.series))
      }

      // Validate numeric columns
      const numericColumns = ['gdp', 'gni', 'gdp_capita', 'gni_capita']
      numericColumns.forEach((col) => {
        if (!validateNumericValue(row[col])) {
          errors.push({
            row: rowNum,
            column: col,
            value: row[col],
            error: 'Invalid numeric value',
            severity: 'critical',
          })
        }
      })
    })

    // Check series consistency (each year should have both abs and growth_yoy)
    yearSeriesMap.forEach((seriesSet, year) => {
      if (!seriesSet.has('abs') || !seriesSet.has('growth_yoy')) {
        const missing = !seriesSet.has('abs') ? 'abs' : 'growth_yoy'
        errors.push({
          row: 0,
          column: 'series',
          value: year,
          error: `Year ${year} is missing "${missing}" series`,
          severity: 'warning',
        })
      }
    })

    return errors
  }

  /**
   * Get validation details for a specific column
   * @param column - Column name to validate
   * @param data - Raw data array
   * @returns Column validation results
   */
  function getColumnValidation(column: string, data: Record<string, unknown>[]): GDPGNIColumnValidation {
    const result: GDPGNIColumnValidation = {
      emptyCells: 0,
      invalidCells: 0,
      errors: [],
      warnings: [],
    }

    data.forEach((row, index) => {
      const value = row[column]
      const rowNum = index + 2

      // Check for empty cells
      if (value === null || value === undefined || value === '') {
        result.emptyCells++
        result.errors.push({
          row: rowNum,
          column,
          value,
          error: 'Empty cell',
          severity: 'critical',
        })
        return
      }

      // Column-specific validation
      if (column === 'series') {
        if (!validateSeriesType(String(value))) {
          result.invalidCells++
          result.errors.push({
            row: rowNum,
            column,
            value,
            error: 'Invalid series type',
            severity: 'critical',
          })
        }
      }
      else if (column === 'date') {
        if (!validateDate(String(value))) {
          result.invalidCells++
          result.errors.push({
            row: rowNum,
            column,
            value,
            error: 'Invalid date format or range',
            severity: 'critical',
          })
        }
      }
      else {
        // Numeric columns
        if (!validateNumericValue(value)) {
          result.invalidCells++
          result.errors.push({
            row: rowNum,
            column,
            value,
            error: 'Invalid numeric value',
            severity: 'critical',
          })
        }
        else {
          // Check for suspicious values (warnings)
          const num = parseFloat(String(value))
          if (column.includes('capita')) {
            // Per capita values should be reasonable
            if (num > 1000000) {
              result.warnings.push({
                row: rowNum,
                column,
                value,
                error: 'Unusually high per capita value',
                severity: 'warning',
              })
            }
          }
          else {
            // GDP/GNI values should be reasonable
            if (num > 10000000) {
              result.warnings.push({
                row: rowNum,
                column,
                value,
                error: 'Unusually high value',
                severity: 'warning',
              })
            }
          }
        }
      }
    })

    return result
  }

  /**
   * Calculate basic statistics from GDP/GNI records
   * @param records - Array of GDP/GNI records
   * @returns Basic statistics summary
   */
  function calculateBasicStats(records: GDPGNIRecord[]): GDPGNIBasicStats {
    if (!records || records.length === 0) {
      return {
        totalRecords: 0,
        dateRange: { start: '', end: '' },
        latestYear: 0,
        latestAbsValues: { gdp: 0, gni: 0, gdp_capita: 0, gni_capita: 0 },
        latestGrowthRates: { gdp: 0, gni: 0, gdp_capita: 0, gni_capita: 0 },
      }
    }

    // Find date range
    const dates = records.map(r => r.date).sort()
    const dateRange = {
      start: dates[0],
      end: dates[dates.length - 1],
    }

    // Find latest year
    const years = records.map(r => new Date(r.date).getFullYear())
    const latestYear = Math.max(...years)

    // Get latest absolute values
    const latestAbsRecord = records.find(
      r => r.series === 'abs' && new Date(r.date).getFullYear() === latestYear,
    )

    const latestAbsValues = latestAbsRecord
      ? {
          gdp: latestAbsRecord.gdp,
          gni: latestAbsRecord.gni,
          gdp_capita: latestAbsRecord.gdp_capita,
          gni_capita: latestAbsRecord.gni_capita,
        }
      : { gdp: 0, gni: 0, gdp_capita: 0, gni_capita: 0 }

    // Get latest growth rates
    const latestGrowthRecord = records.find(
      r => r.series === 'growth_yoy' && new Date(r.date).getFullYear() === latestYear,
    )

    const latestGrowthRates = latestGrowthRecord
      ? {
          gdp: latestGrowthRecord.gdp,
          gni: latestGrowthRecord.gni,
          gdp_capita: latestGrowthRecord.gdp_capita,
          gni_capita: latestGrowthRecord.gni_capita,
        }
      : { gdp: 0, gni: 0, gdp_capita: 0, gni_capita: 0 }

    return {
      totalRecords: records.length,
      dateRange,
      latestYear,
      latestAbsValues,
      latestGrowthRates,
    }
  }

  /**
   * Filter records by series type
   * @param records - All records
   * @param series - Series type to filter by
   * @returns Filtered records in chronological order
   */
  function filterBySeriesType(records: GDPGNIRecord[], series: 'abs' | 'growth_yoy'): GDPGNIRecord[] {
    return records
      .filter(r => r.series === series)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Filter records by date range
   * @param records - All records
   * @param startYear - Start year (inclusive)
   * @param endYear - End year (inclusive)
   * @returns Filtered records within the date range
   */
  function filterByDateRange(records: GDPGNIRecord[], startYear: number, endYear: number): GDPGNIRecord[] {
    return records.filter((r) => {
      const year = new Date(r.date).getFullYear()
      return year >= startYear && year <= endYear
    })
  }

  /**
   * Get all historical milestones
   * @returns Array of historical milestones
   */
  function getHistoricalMilestones(): HistoricalMilestone[] {
    return MILESTONES
  }

  /**
   * Get milestones within a specific date range
   * @param startYear - Start year
   * @param endYear - End year
   * @returns Filtered milestones
   */
  function getMilestonesInRange(startYear: number, endYear: number): HistoricalMilestone[] {
    return MILESTONES.filter(m => m.year >= startYear && m.year <= endYear)
  }

  return {
    processGDPGNIFile,
    validateSeriesType,
    validateDate,
    validateNumericValue,
    validateGDPGNIStructure,
    getColumnValidation,
    calculateBasicStats,
    filterBySeriesType,
    filterByDateRange,
    getHistoricalMilestones,
    getMilestonesInRange,
  }
}
