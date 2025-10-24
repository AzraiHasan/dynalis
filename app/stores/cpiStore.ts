/**
 * CPI Data Store
 * Uses Nuxt's useState for reactive state management
 */

import type { CPIRecord, CPIDataset, CPIBasicStats } from '~/types/cpi'
import { saveCPIData, loadCPIData, clearCPIData } from '~/utils/cpiStorage'

interface CPIState {
  cpiData: CPIDataset | null
  isLoading: boolean
  error: string | null
  lastUploadedAt: string | null
}

/**
 * CPI Store composable
 * Manages CPI dataset state and localStorage persistence
 */
export const useCPIStore = () => {
  // State is created only once and reused across imports
  const state = useState<CPIState>('cpiData', () => ({
    cpiData: null,
    isLoading: false,
    error: null,
    lastUploadedAt: null
  }))

  /**
   * Load CPI data from localStorage cache
   */
  const loadFromCache = () => {
    try {
      state.value.isLoading = true
      state.value.error = null

      const cachedData = loadCPIData()

      if (cachedData) {
        state.value.cpiData = cachedData
        state.value.lastUploadedAt = cachedData.lastUpdated
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load cached data'
      state.value.error = errorMessage
      console.error('Error loading CPI data from cache:', error)
    } finally {
      state.value.isLoading = false
    }
  }

  /**
   * Set uploaded CPI data and persist to localStorage
   * @param records - Array of CPI records
   * @param fileName - Original file name
   */
  const setUploadedData = (records: CPIRecord[], fileName: string) => {
    try {
      state.value.isLoading = true
      state.value.error = null

      // Calculate metadata
      const divisions = [...new Set(records.map(r => r.division))].sort()
      const dates = records.map(r => r.date).sort()
      const earliest = dates[0]
      const latest = dates[dates.length - 1]

      const dataset: CPIDataset = {
        records,
        lastUpdated: new Date().toISOString(),
        fileName,
        metadata: {
          dateRange: {
            earliest,
            latest
          },
          divisions,
          recordCount: records.length
        }
      }

      // Save to localStorage
      saveCPIData(dataset)

      // Update state
      state.value.cpiData = dataset
      state.value.lastUploadedAt = dataset.lastUpdated
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save data'
      state.value.error = errorMessage
      console.error('Error setting CPI data:', error)
      throw error
    } finally {
      state.value.isLoading = false
    }
  }

  /**
   * Clear CPI data from state and localStorage
   */
  const clearData = () => {
    try {
      clearCPIData()
      state.value.cpiData = null
      state.value.lastUploadedAt = null
      state.value.error = null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear data'
      state.value.error = errorMessage
      console.error('Error clearing CPI data:', error)
    }
  }

  /**
   * Get basic statistics from current CPI data
   * @returns Basic stats or null if no data
   */
  const getBasicStats = (): CPIBasicStats | null => {
    if (!state.value.cpiData || state.value.cpiData.records.length === 0) {
      return null
    }

    const { records, metadata } = state.value.cpiData

    // Extract year from date strings (YYYY-MM-DD format)
    const years = records.map(r => parseInt(r.date.substring(0, 4)))
    const latestYear = Math.max(...years)

    return {
      totalRecords: metadata.recordCount,
      dateRange: {
        start: metadata.dateRange.earliest,
        end: metadata.dateRange.latest
      },
      numberOfDivisions: metadata.divisions.length,
      latestYear
    }
  }

  /**
   * Get records filtered by division
   * @param division - Division code to filter by
   * @returns Filtered records
   */
  const getRecordsByDivision = (division: string): CPIRecord[] => {
    if (!state.value.cpiData) {
      return []
    }

    if (division === 'all') {
      return state.value.cpiData.records
    }

    return state.value.cpiData.records.filter(r => r.division === division)
  }

  /**
   * Get records filtered by date range
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   * @returns Filtered records
   */
  const getRecordsByDateRange = (startDate: string, endDate: string): CPIRecord[] => {
    if (!state.value.cpiData) {
      return []
    }

    return state.value.cpiData.records.filter(
      r => r.date >= startDate && r.date <= endDate
    )
  }

  return {
    // State (readonly)
    cpiState: readonly(state),

    // Actions
    loadFromCache,
    setUploadedData,
    clearData,

    // Getters
    getBasicStats,
    getRecordsByDivision,
    getRecordsByDateRange
  }
}
