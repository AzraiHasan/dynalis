/**
 * localStorage utilities for GDP/GNI data persistence
 */

import type { GDPGNIDataset } from '~/types/gdp'

const STORAGE_KEY = 'dynalis-gdp-gni-data'

/**
 * Save GDP/GNI dataset to localStorage
 * @param data - The GDP/GNI dataset to save
 * @throws Error if localStorage is not available or quota is exceeded
 */
export function saveGDPGNIData(data: GDPGNIDataset): void {
  try {
    const jsonString = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, jsonString)
  }
  catch (error) {
    if (error instanceof Error) {
      // Check for quota exceeded errors
      if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
        throw new Error('Storage quota exceeded. Please clear some data or use a smaller dataset.')
      }
      // Check for localStorage not available
      if (error.name === 'SecurityError') {
        throw new Error('localStorage is not available. Please check your browser settings.')
      }
      throw new Error(`Failed to save GDP/GNI data: ${error.message}`)
    }
    throw new Error('Failed to save GDP/GNI data: Unknown error')
  }
}

/**
 * Load GDP/GNI dataset from localStorage
 * @returns The GDP/GNI dataset or null if not found or invalid
 */
export function loadGDPGNIData(): GDPGNIDataset | null {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEY)

    if (!jsonString) {
      return null
    }

    const data = JSON.parse(jsonString) as GDPGNIDataset

    // Validate schema before returning
    if (!isValidGDPGNIDataset(data)) {
      console.warn('Invalid GDP/GNI data structure in localStorage')
      return null
    }

    return data
  }
  catch (error) {
    if (error instanceof Error) {
      console.error('Failed to load GDP/GNI data:', error.message)
    }
    return null
  }
}

/**
 * Clear GDP/GNI data from localStorage
 */
export function clearGDPGNIData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    // Clear any related cache keys if they exist
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('dynalis-gdp-')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
  catch (error) {
    console.error('Failed to clear GDP/GNI data:', error)
  }
}

/**
 * Get the age of cached data in milliseconds
 * @returns Milliseconds since last update, or null if no data exists
 */
export function getCacheAge(): number | null {
  try {
    const data = loadGDPGNIData()

    if (!data || !data.lastUpdated) {
      return null
    }

    const lastUpdated = new Date(data.lastUpdated)
    const now = new Date()

    return now.getTime() - lastUpdated.getTime()
  }
  catch (error) {
    console.error('Failed to calculate cache age:', error)
    return null
  }
}

/**
 * Validate if the data conforms to GDPGNIDataset schema
 * @param data - Data to validate
 * @returns True if valid, false otherwise
 */
function isValidGDPGNIDataset(data: unknown): data is GDPGNIDataset {
  if (!data || typeof data !== 'object') {
    return false
  }

  const dataset = data as Partial<GDPGNIDataset>

  // Check required top-level properties
  if (!Array.isArray(dataset.records) ||
      !Array.isArray(dataset.absRecords) ||
      !Array.isArray(dataset.growthRecords) ||
      !dataset.lastUpdated ||
      !dataset.fileName ||
      !dataset.metadata) {
    return false
  }

  // Check metadata structure
  const { metadata } = dataset
  if (!metadata.dateRange ||
      !metadata.dateRange.start ||
      !metadata.dateRange.end ||
      typeof metadata.totalYears !== 'number' ||
      typeof metadata.recordCount !== 'number' ||
      typeof metadata.latestYear !== 'number') {
    return false
  }

  // Check at least one record exists and has the right structure
  if (dataset.records.length > 0) {
    const record = dataset.records[0]
    if (!record.series ||
        !record.date ||
        typeof record.gdp !== 'number' ||
        typeof record.gni !== 'number' ||
        typeof record.gdp_capita !== 'number' ||
        typeof record.gni_capita !== 'number') {
      return false
    }
  }

  return true
}
