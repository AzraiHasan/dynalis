/**
 * CPI Data Processing Composable
 * Handles file parsing, validation, and data manipulation
 */

import Papa from 'papaparse'
import { isValid, parseISO } from 'date-fns'
import type {
  CPIRecord,
  CPIValidationError,
  CPIColumnValidation,
  CPIBasicStats
} from '~/types/cpi'

/**
 * Valid division codes for DOSM CPI data
 */
const VALID_DIVISIONS = [
  'overall',
  '01', '02', '03', '04', '05', '06', '07',
  '08', '09', '10', '11', '12', '13'
]

/**
 * Process and parse a CPI CSV file
 * @param file - The CSV file to process
 * @returns Promise resolving to array of CPIRecord
 * @throws Error if parsing fails
 */
export function processCPIFile(file: File): Promise<CPIRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings initially for validation
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            const errorMessages = results.errors.map(e => e.message).join(', ')
            reject(new Error(`CSV parsing errors: ${errorMessages}`))
            return
          }

          // Convert parsed data to CPIRecord format
          const records: CPIRecord[] = (results.data as Record<string, unknown>[]).map((row) => ({
            date: row.date?.toString() || '',
            division: row.division?.toString() || '',
            inflation: parseFloat((row.inflation as string) || '0') || 0
          }))

          resolve(records)
        } catch (error) {
          reject(new Error(`Failed to process CSV data: ${error}`))
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      }
    })
  })
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param dateStr - Date string to validate
 * @returns true if valid ISO date format
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') {
    return false
  }

  // Check format with regex (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) {
    return false
  }

  // Validate actual date
  const parsed = parseISO(dateStr)
  return isValid(parsed)
}

/**
 * Validate division code
 * @param division - Division code to validate
 * @returns true if valid division code
 */
function isValidDivision(division: string): boolean {
  if (!division || typeof division !== 'string') {
    return false
  }

  return VALID_DIVISIONS.includes(division)
}

/**
 * Validate inflation value
 * @param inflation - Inflation value to validate
 * @returns true if valid numeric value
 */
function isValidInflation(inflation: unknown): boolean {
  if (inflation === null || inflation === undefined || inflation === '') {
    return false
  }

  const num = typeof inflation === 'number' ? inflation : parseFloat(String(inflation))
  return !isNaN(num) && isFinite(num)
}

/**
 * Validate CPI data structure and content
 * @param data - Array of parsed data rows
 * @returns Array of validation errors
 */
export function validateCPIStructure(data: Record<string, unknown>[]): CPIValidationError[] {
  const errors: CPIValidationError[] = []

  // Check if data is empty
  if (!data || data.length === 0) {
    errors.push({
      row: 0,
      column: 'general',
      value: null,
      error: 'No data rows found in file'
    })
    return errors
  }

  // Check for required columns
  const firstRow = data[0]
  const requiredColumns = ['date', 'division', 'inflation']
  const actualColumns = Object.keys(firstRow)

  for (const col of requiredColumns) {
    if (!actualColumns.includes(col)) {
      errors.push({
        row: 0,
        column: col,
        value: null,
        error: `Required column "${col}" is missing`
      })
    }
  }

  // If required columns are missing, return early
  if (errors.length > 0) {
    return errors
  }

  // Validate each row
  data.forEach((row, index) => {
    // Validate date
    if (!row.date || row.date === '') {
      errors.push({
        row: index,
        column: 'date',
        value: row.date,
        error: 'Date is empty'
      })
    } else if (!isValidDate(row.date)) {
      errors.push({
        row: index,
        column: 'date',
        value: row.date,
        error: 'Invalid date format (expected YYYY-MM-DD)'
      })
    }

    // Validate division
    if (!row.division || row.division === '') {
      errors.push({
        row: index,
        column: 'division',
        value: row.division,
        error: 'Division is empty'
      })
    } else if (!isValidDivision(row.division)) {
      errors.push({
        row: index,
        column: 'division',
        value: row.division,
        error: `Invalid division code (must be "overall" or "01"-"13")`
      })
    }

    // Validate inflation
    if (row.inflation === null || row.inflation === undefined || row.inflation === '') {
      errors.push({
        row: index,
        column: 'inflation',
        value: row.inflation,
        error: 'Inflation value is empty'
      })
    } else if (!isValidInflation(row.inflation)) {
      errors.push({
        row: index,
        column: 'inflation',
        value: row.inflation,
        error: 'Invalid inflation value (must be numeric)'
      })
    }
  })

  return errors
}

/**
 * Get column-specific validation results
 * @param column - Column name to validate
 * @param data - Array of data rows
 * @returns Column validation results
 */
export function getColumnValidation(column: string, data: Record<string, unknown>[]): CPIColumnValidation {
  let emptyCells = 0
  let invalidCells = 0
  const errors: CPIValidationError[] = []

  data.forEach((row, index) => {
    const value = row[column]

    // Check for empty cells
    if (value === null || value === undefined || value === '') {
      emptyCells++
      errors.push({
        row: index,
        column,
        value,
        error: 'Empty value'
      })
      return
    }

    // Validate based on column type
    let isInvalid = false
    let errorMsg = ''

    switch (column) {
      case 'date':
        if (!isValidDate(value)) {
          isInvalid = true
          errorMsg = 'Invalid date format'
        }
        break
      case 'division':
        if (!isValidDivision(value)) {
          isInvalid = true
          errorMsg = 'Invalid division code'
        }
        break
      case 'inflation':
        if (!isValidInflation(value)) {
          isInvalid = true
          errorMsg = 'Invalid numeric value'
        }
        break
    }

    if (isInvalid) {
      invalidCells++
      errors.push({
        row: index,
        column,
        value,
        error: errorMsg
      })
    }
  })

  return {
    emptyCells,
    invalidCells,
    errors
  }
}

/**
 * Calculate basic statistics from CPI records
 * @param records - Array of CPI records
 * @returns Basic statistics
 */
export function calculateBasicStats(records: CPIRecord[]): CPIBasicStats {
  if (records.length === 0) {
    return {
      totalRecords: 0,
      dateRange: { start: '', end: '' },
      numberOfDivisions: 0,
      latestYear: 0
    }
  }

  // Get date range
  const dates = records.map(r => r.date).sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]

  // Get unique divisions
  const divisions = new Set(records.map(r => r.division))

  // Get latest year
  const years = records.map(r => parseInt(r.date.substring(0, 4)))
  const latestYear = Math.max(...years)

  return {
    totalRecords: records.length,
    dateRange: {
      start: startDate,
      end: endDate
    },
    numberOfDivisions: divisions.size,
    latestYear
  }
}

/**
 * Filter records by division
 * @param records - Array of CPI records
 * @param division - Division code to filter by
 * @returns Filtered records
 */
export function filterByDivision(records: CPIRecord[], division: string): CPIRecord[] {
  if (division === 'all') {
    return records
  }
  return records.filter(r => r.division === division)
}

/**
 * Filter records by date range
 * @param records - Array of CPI records
 * @param start - Start date (YYYY-MM-DD)
 * @param end - End date (YYYY-MM-DD)
 * @returns Filtered records
 */
export function filterByDateRange(
  records: CPIRecord[],
  start: string,
  end: string
): CPIRecord[] {
  return records.filter(r => r.date >= start && r.date <= end)
}

/**
 * Export records to CSV format
 * @param records - Array of CPI records
 * @param fileName - Name for the downloaded file
 */
export function exportToCSV(records: CPIRecord[], fileName: string = 'cpi-data.csv') {
  const csv = Papa.unparse(records, {
    columns: ['date', 'division', 'inflation'],
    header: true
  })

  // Create download link
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
