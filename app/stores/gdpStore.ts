/**
 * GDP/GNI State Management Store
 * Uses Nuxt useState composable pattern for reactive state
 */

import type { GDPGNIDataset, GDPGNIRecord } from '~/types/gdp'
import { loadGDPGNIData, saveGDPGNIData } from '~/utils/gdpStorage'

interface GDPStoreState {
  gdpGniData: GDPGNIDataset | null
  isLoading: boolean
  error: string | null
  lastUploadedAt: string | null
}

/**
 * Get or initialize the GDP/GNI store state
 */
function useGDPStoreState() {
  return useState<GDPStoreState>('gdp-store', () => ({
    gdpGniData: null,
    isLoading: false,
    error: null,
    lastUploadedAt: null,
  }))
}

/**
 * GDP/GNI Store Composable
 * Provides centralized state management for GDP/GNI data
 */
export function useGDPStore() {
  const state = useGDPStoreState()

  /**
   * Load GDP/GNI data from localStorage cache
   */
  function loadFromCache() {
    try {
      state.value.isLoading = true
      state.value.error = null

      const data = loadGDPGNIData()

      if (data) {
        state.value.gdpGniData = data
        state.value.lastUploadedAt = data.lastUpdated
      }
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data from cache'
      state.value.error = errorMessage
      console.error('Error loading GDP/GNI data from cache:', errorMessage)
    }
    finally {
      state.value.isLoading = false
    }
  }

  /**
   * Set uploaded GDP/GNI data and save to localStorage
   * @param records - Array of GDP/GNI records from uploaded file
   * @param fileName - Name of the uploaded file
   */
  function setUploadedData(records: GDPGNIRecord[], fileName: string) {
    try {
      state.value.isLoading = true
      state.value.error = null

      // Separate records by series type
      const absRecords = records.filter(r => r.series === 'abs')
      const growthRecords = records.filter(r => r.series === 'growth_yoy')

      // Extract years from dates
      const years = records.map(r => new Date(r.date).getFullYear())
      const uniqueYears = [...new Set(years)].sort()

      // Calculate metadata
      const dateRange = {
        start: records.reduce((min, r) => r.date < min ? r.date : min, records[0].date),
        end: records.reduce((max, r) => r.date > max ? r.date : max, records[0].date),
      }

      const totalYears = uniqueYears.length
      const recordCount = records.length
      const latestYear = Math.max(...years)
      const lastUpdated = new Date().toISOString()

      // Create dataset
      const dataset: GDPGNIDataset = {
        records,
        absRecords,
        growthRecords,
        lastUpdated,
        fileName,
        metadata: {
          dateRange,
          totalYears,
          recordCount,
          latestYear,
        },
      }

      // Save to localStorage
      saveGDPGNIData(dataset)

      // Update state
      state.value.gdpGniData = dataset
      state.value.lastUploadedAt = lastUpdated
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save uploaded data'
      state.value.error = errorMessage
      console.error('Error saving GDP/GNI data:', errorMessage)
      throw err
    }
    finally {
      state.value.isLoading = false
    }
  }

  /**
   * Clear all GDP/GNI data from state and localStorage
   */
  function clearData() {
    state.value.gdpGniData = null
    state.value.lastUploadedAt = null
    state.value.error = null
  }

  return {
    // State
    gdpGniData: computed(() => state.value.gdpGniData),
    isLoading: computed(() => state.value.isLoading),
    error: computed(() => state.value.error),
    lastUploadedAt: computed(() => state.value.lastUploadedAt),

    // Actions
    loadFromCache,
    setUploadedData,
    clearData,
  }
}
