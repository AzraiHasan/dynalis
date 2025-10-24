/**
 * LocalStorage utilities for CPI data persistence
 */

import type { CPIDataset } from '~/types/cpi'

const STORAGE_KEY = 'dynalis-cpi-data'

/**
 * Save CPI dataset to localStorage
 * @param data - The CPI dataset to save
 * @throws Error if localStorage is not available or data cannot be stringified
 */
export function saveCPIData(data: CPIDataset): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available')
    }

    const jsonData = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, jsonData)
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        throw new Error('localStorage quota exceeded. Please clear some data.')
      }
      throw new Error(`Failed to save CPI data: ${error.message}`)
    }
    throw new Error('Failed to save CPI data: Unknown error')
  }
}

/**
 * Load CPI dataset from localStorage
 * @returns The stored CPI dataset, or null if not found or invalid
 */
export function loadCPIData(): CPIDataset | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }

    const jsonData = localStorage.getItem(STORAGE_KEY)
    if (!jsonData) {
      return null
    }

    const data = JSON.parse(jsonData) as CPIDataset

    // Basic validation of loaded data structure
    if (!data.records || !Array.isArray(data.records)) {
      console.warn('Invalid CPI data structure in localStorage')
      return null
    }

    return data
  } catch (error) {
    console.error('Failed to load CPI data from localStorage:', error)
    return null
  }
}

/**
 * Clear CPI data from localStorage
 */
export function clearCPIData(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear CPI data from localStorage:', error)
  }
}

/**
 * Get the age of cached data in milliseconds
 * @returns Age in milliseconds, or null if no data exists
 */
export function getCacheAge(): number | null {
  try {
    const data = loadCPIData()
    if (!data || !data.lastUpdated) {
      return null
    }

    const lastUpdated = new Date(data.lastUpdated)
    const now = new Date()
    return now.getTime() - lastUpdated.getTime()
  } catch (error) {
    console.error('Failed to calculate cache age:', error)
    return null
  }
}

/**
 * Check if localStorage is available
 * @returns true if localStorage is available and writable
 */
export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false
    }

    const testKey = '__storage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}
