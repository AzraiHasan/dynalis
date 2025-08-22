// composables/useResetDemo.ts
import { ref } from 'vue'
import { useState } from '#app'
import { useSiteService } from '~/utils/supabaseService'

interface ResetDemoService {
  resetDemo: () => Promise<void>
  isResetting: Ref<boolean>
  resetProgress: Ref<number>
  resetStatus: Ref<string>
}

export const useResetDemo = (): ResetDemoService => {
  const siteService = useSiteService()
  const isResetting = ref(false)
  const resetProgress = ref(0)
  const resetStatus = ref('')

  const clearSupabaseData = async () => {
    resetStatus.value = 'Clearing database tables...'
    console.log('🚀 [RESET] Starting database clearing process')
    
    try {
      console.log('🔄 [RESET] Calling siteService.clearAllDemoData()')
      await siteService.clearAllDemoData()
      resetProgress.value = 40 // 40% for database clearing
      resetStatus.value = 'Database cleared successfully'
      console.log('✅ [RESET] Successfully cleared all available database tables')
      console.log('🎯 [RESET] Sites table clearing should be complete at this point')
    } catch (error) {
      console.error('❌ [RESET] Failed to clear database:', error)
      console.error('🚨 [RESET] Database clearing error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      })
      resetStatus.value = 'Database clearing failed'
      throw error
    }
  }

  const clearLocalStorage = () => {
    console.log('🔄 [RESET] Starting local storage clearing')
    resetStatus.value = 'Clearing local storage...'
    
    const keysToRemove = [
      'uploadedFileData',
      'background_job_id', 
      'dashboard_building',
      'sidebar-collapsed'
    ]

    console.log('📋 [RESET] Keys to remove from localStorage:', keysToRemove)
    // Clear specific keys
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ [RESET] Removed localStorage key: ${key}`)
    })

    // Clear pattern-based keys (bg_upload_*)
    const allKeys = Object.keys(localStorage)
    const bgUploadKeys = allKeys.filter(key => key.startsWith('bg_upload_'))
    console.log('🔍 [RESET] Found bg_upload_* keys:', bgUploadKeys)
    bgUploadKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ [RESET] Removed localStorage key: ${key}`)
    })

    resetProgress.value = 60 // 60% after local storage
    console.log('✅ [RESET] Local storage clearing completed')
  }

  const clearApplicationState = () => {
    console.log('🔄 [RESET] Starting application state clearing')
    resetStatus.value = 'Resetting application state...'
    
    try {
      // Clear all Nuxt useState cache
      const stateKeys = [
        'site-data',
        'site-data-loading', 
        'site-data-error',
        'site-data-timestamp',
        'upload-state',
        'file-upload-state'
      ]

      console.log('📋 [RESET] Application state keys to reset:', stateKeys)
      stateKeys.forEach(key => {
        const state = useState(key, () => null)
        if (key.includes('loading')) {
          state.value = false
        } else if (key.includes('error')) {
          state.value = null
        } else if (key.includes('timestamp')) {
          state.value = 0
        } else {
          state.value = null
        }
        console.log(`✅ [RESET] Reset state: ${key}`)
      })

      resetProgress.value = 80 // 80% after state clearing
      console.log('✅ [RESET] Application state clearing completed')
    } catch (error) {
      console.error('❌ [RESET] Error clearing application state:', error)
      throw error
    }
  }

  // Helper function to output to terminal via echo
  const outputToTerminal = (message: string, isSuccess: boolean = true) => {
    if (import.meta.client) {
      // For browser environment, we'll use console output that appears in browser dev tools
      if (isSuccess) {
        console.log(`%c[TERMINAL] ${message}`, 'color: #00ff00; font-weight: bold; background: #001100; padding: 4px;')
      } else {
        console.warn(`%c[TERMINAL] ${message}`, 'color: #ff6600; font-weight: bold; background: #221100; padding: 4px;')
      }
    }
  }

  const resetDemo = async () => {
    if (isResetting.value) {
      console.warn('⚠️ [RESET] Reset already in progress')
      return
    }

    try {
      console.log('🚀 [RESET] ===================================================')
      console.log('🚀 [RESET] STARTING COMPLETE DEMO RESET OPERATION')
      console.log('🚀 [RESET] ===================================================')
      
      isResetting.value = true
      resetProgress.value = 0
      resetStatus.value = 'Starting reset...'

      // Step 1: Clear Supabase data (40% of progress)
      console.log('🔄 [RESET] STEP 1: Clearing Supabase database data')
      await clearSupabaseData()
      console.log('✅ [RESET] STEP 1 COMPLETED: Database clearing finished')

      // Step 2: Clear local storage (20% of progress) 
      console.log('🔄 [RESET] STEP 2: Clearing local storage')
      clearLocalStorage()
      console.log('✅ [RESET] STEP 2 COMPLETED: Local storage cleared')

      // Step 3: Clear application state (20% of progress)
      console.log('🔄 [RESET] STEP 3: Clearing application state')
      clearApplicationState()
      console.log('✅ [RESET] STEP 3 COMPLETED: Application state cleared')

      // Step 4: Verify tables are cleared (10% of progress)
      console.log('🔄 [RESET] STEP 4: Verifying tables are cleared')
      resetStatus.value = 'Verifying database clearing...'
      resetProgress.value = 90

      let clearingSuccessful = false
      let sitesTableCleared = false

      try {
        const verificationResult = await siteService.verifyTablesCleared()
        sitesTableCleared = verificationResult.tableCounts.sites === 0
        
        if (verificationResult.allCleared) {
          clearingSuccessful = true
          resetStatus.value = 'All tables verified cleared!'
          console.log('✅ [RESET] Database verification: ALL TABLES CLEARED')
          console.log('📊 [RESET] Verification summary:', verificationResult.summary)
          
          // Terminal output for user
          console.log('')
          console.log('🎉 ===================================================================')
          console.log('🎉 RESET DEMO COMPLETED SUCCESSFULLY')
          console.log('🎉 ✅ ALL SUPABASE TABLES HAVE BEEN CLEARED')
          console.log('🎉 ===================================================================')
          console.log('')
          
          // Additional terminal-style output
          outputToTerminal('✅ ALL SUPABASE TABLES SUCCESSFULLY CLEARED!', true)
          outputToTerminal('✅ Reset Demo process completed successfully', true)
          outputToTerminal(`✅ Verified ${Object.keys(verificationResult.tableCounts).length} tables are empty`, true)
        } else {
          // Check specifically if sites table failed
          if (!sitesTableCleared) {
            resetStatus.value = 'CRITICAL: Sites table was not cleared!'
            console.error('🚨 [RESET] CRITICAL FAILURE: Sites table still contains data')
            outputToTerminal('🚨 CRITICAL: SITES TABLE WAS NOT CLEARED!', false)
            outputToTerminal(`🚨 Sites table contains ${verificationResult.tableCounts.sites} records`, false)
          } else {
            resetStatus.value = 'Warning: Some tables may not be fully cleared'
            console.warn('⚠️ [RESET] Database verification: NOT ALL TABLES CLEARED')
          }
          
          console.warn('📊 [RESET] Verification summary:', verificationResult.summary)
          
          // Terminal output for user
          console.warn('')
          console.warn('⚠️ ===================================================================')
          console.warn('⚠️ RESET DEMO COMPLETED WITH WARNINGS')
          console.warn('⚠️ ❌ SOME SUPABASE TABLES MAY STILL CONTAIN DATA')
          console.warn('⚠️ ===================================================================')
          console.warn('⚠️ Table details:')
          Object.entries(verificationResult.tableCounts).forEach(([table, count]) => {
            if (count > 0) {
              console.warn(`⚠️ ${table}: ${count} records remaining`)
              if (table === 'sites') {
                console.error(`🚨 CRITICAL: SITES TABLE NOT CLEARED - ${count} records remaining`)
              }
            } else if (count === 0) {
              console.log(`✅ ${table}: cleared`)
            } else {
              console.error(`❌ ${table}: error checking`)
            }
          })
          console.warn('')
          
          // Additional terminal-style output
          if (!sitesTableCleared) {
            outputToTerminal('🚨 CRITICAL: SITES TABLE CLEARING FAILED!', false)
            outputToTerminal('🚨 Dashboard will still show old data after refresh', false)
          } else {
            outputToTerminal('⚠️ SOME SUPABASE TABLES MAY STILL CONTAIN DATA!', false)
            outputToTerminal('⚠️ Reset Demo completed with warnings', false)
          }
          const remainingRecords = Object.values(verificationResult.tableCounts).reduce((total, count) => total + (count > 0 ? count : 0), 0)
          outputToTerminal(`⚠️ ${remainingRecords} total records remain across all tables`, false)
        }
      } catch (verifyError) {
        console.error('❌ [RESET] Failed to verify table clearing:', verifyError)
        resetStatus.value = 'Reset completed but verification failed'
        clearingSuccessful = false // Assume failure if we can't verify
        
        // Terminal output for error case
        console.error('')
        console.error('❌ ===================================================================')
        console.error('❌ RESET DEMO COMPLETED BUT VERIFICATION FAILED')
        console.error('❌ ⚠️ UNABLE TO VERIFY IF SUPABASE TABLES ARE CLEARED')
        console.error('❌ ===================================================================')
        console.error('')
        
        // Additional terminal-style output
        outputToTerminal('❌ UNABLE TO VERIFY IF SUPABASE TABLES ARE CLEARED!', false)
        outputToTerminal('❌ Reset Demo completed but verification failed', false)
        outputToTerminal('❌ Please check tables manually or retry the reset', false)
      }

      // Step 5: Final completion (10% of progress)
      console.log('🔄 [RESET] STEP 5: Finalizing reset')
      resetProgress.value = 100

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500))

      console.log('✅ [RESET] Demo reset completed successfully')
      console.log('🎯 [RESET] ALL STEPS COMPLETED INCLUDING VERIFICATION')
      console.log('🚀 [RESET] ===================================================')

      // Conditional force refresh based on clearing success
      setTimeout(() => {
        resetStatus.value = ''
        resetProgress.value = 0
        
        if (clearingSuccessful && sitesTableCleared) {
          // Only refresh if clearing was successful and sites table was cleared
          console.log('✅ [RESET] Clearing successful - refreshing page to show empty dashboard')
          outputToTerminal('✅ Refreshing page to show cleared dashboard', true)
          if (import.meta.client) {
            window.location.reload()
          }
        } else {
          // Don't refresh if clearing failed - user needs to see the error and retry
          console.warn('⚠️ [RESET] Clearing failed or incomplete - NOT refreshing page')
          console.warn('⚠️ [RESET] Page refresh prevented to avoid showing old data')
          outputToTerminal('⚠️ Page refresh prevented due to clearing failure', false)
          outputToTerminal('⚠️ Please retry the reset or check the console for errors', false)
          
          if (!sitesTableCleared) {
            outputToTerminal('🚨 Sites table was not cleared - dashboard will still show old data', false)
          }
        }
      }, 3000) // Longer delay to let user read the verification results

    } catch (error) {
      console.error('❌ [RESET] Reset demo failed:', error)
      console.error('🚨 [RESET] RESET FAILURE - Full error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace available'
      })
      console.error('🚨 [RESET] ===================================================')
      resetStatus.value = `Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      
      // Keep error visible longer
      setTimeout(() => {
        resetStatus.value = ''
        resetProgress.value = 0
      }, 5000)
      
      throw error
    } finally {
      isResetting.value = false
      console.log('🏁 [RESET] Reset operation finished (cleanup phase)')
    }
  }

  return {
    resetDemo,
    isResetting,
    resetProgress,
    resetStatus
  }
}