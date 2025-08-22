// composables/useDemoSession.ts
import { ref, computed, watch } from 'vue'
import { useServiceBase } from './useServiceBase'

// Demo session configuration
const DEMO_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds
const DEMO_WARNING_THRESHOLD = 5 * 60 * 1000 // 5 minutes warning

interface DemoUser {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  created_at: string
}

interface DemoSessionState {
  isActive: boolean
  sessionId: string | null
  startTime: number
  demoUser: DemoUser | null
  remainingTime: number
  showWarning: boolean
}

export const useDemoSession = () => {
  const serviceBase = useServiceBase<DemoSessionState>('demoSession', {
    enableCache: false,
    retries: 0,
    timeout: 5000
  })
  
  const isActive = ref(false)
  const sessionId = ref<string | null>(null)
  const startTime = ref(0)
  const demoUser = ref<DemoUser | null>(null)
  const remainingTime = ref(0)
  const showWarning = ref(false)
  
  // Computed properties
  const isDemo = computed(() => isActive.value)
  const timeRemaining = computed(() => Math.max(0, remainingTime.value))
  const progress = computed(() => {
    if (!isActive.value || startTime.value === 0) return 0
    const elapsed = Date.now() - startTime.value
    return Math.min(100, (elapsed / DEMO_DURATION) * 100)
  })
  
  const timeRemainingFormatted = computed(() => {
    const minutes = Math.floor(timeRemaining.value / 60000)
    const seconds = Math.floor((timeRemaining.value % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })
  
  // Initialize demo session
  const initializeSession = () => {
    if (!import.meta.client) return
    
    const existingDemo = sessionStorage.getItem('demo_mode')
    const existingStartTime = sessionStorage.getItem('demo_start_time')
    const existingSessionId = sessionStorage.getItem('demo_session_id')
    
    if (existingDemo === 'true' && existingStartTime && existingSessionId) {
      const start = parseInt(existingStartTime)
      const elapsed = Date.now() - start
      
      if (elapsed < DEMO_DURATION) {
        // Resume existing session
        isActive.value = true
        sessionId.value = existingSessionId
        startTime.value = start
        remainingTime.value = DEMO_DURATION - elapsed
        
        // Create demo user
        demoUser.value = createDemoUser()
        
        // Start timer
        startTimer()
      } else {
        // Session expired, clean up
        endSession()
      }
    }
  }
  
  // Start new demo session
  const startSession = () => {
    if (!import.meta.client) return
    
    const newSessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    
    isActive.value = true
    sessionId.value = newSessionId
    startTime.value = now
    remainingTime.value = DEMO_DURATION
    showWarning.value = false
    
    // Create demo user
    demoUser.value = createDemoUser()
    
    // Store in session storage
    sessionStorage.setItem('demo_mode', 'true')
    sessionStorage.setItem('demo_start_time', now.toString())
    sessionStorage.setItem('demo_session_id', newSessionId)
    
    // Start timer
    startTimer()
    
    console.log('[Demo] Session started:', {
      sessionId: newSessionId,
      duration: DEMO_DURATION,
      user: demoUser.value
    })
  }
  
  // End demo session
  const endSession = () => {
    if (!import.meta.client) return
    
    isActive.value = false
    sessionId.value = null
    startTime.value = 0
    demoUser.value = null
    remainingTime.value = 0
    showWarning.value = false
    
    // Clear session storage
    sessionStorage.removeItem('demo_mode')
    sessionStorage.removeItem('demo_start_time')
    sessionStorage.removeItem('demo_session_id')
    
    // Clear any demo data
    clearDemoData()
    
    console.log('[Demo] Session ended')
  }
  
  // Extend demo session (if needed)
  const extendSession = (additionalMinutes: number = 15) => {
    if (!isActive.value) return
    
    const extension = additionalMinutes * 60 * 1000
    remainingTime.value += extension
    
    console.log(`[Demo] Session extended by ${additionalMinutes} minutes`)
  }
  
  // Timer management
  let timerInterval: NodeJS.Timeout | null = null
  
  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval)
    
    timerInterval = setInterval(() => {
      if (!isActive.value) return
      
      const elapsed = Date.now() - startTime.value
      const remaining = DEMO_DURATION - elapsed
      
      if (remaining <= 0) {
        // Session expired
        endSession()
        
        // Redirect to upgrade page or landing
        if (import.meta.client) {
          window.location.href = '/?demo_expired=true'
        }
      } else {
        remainingTime.value = remaining
        
        // Show warning when 5 minutes remaining
        if (!showWarning.value && remaining <= DEMO_WARNING_THRESHOLD) {
          showWarning.value = true
        }
      }
    }, 1000)
  }
  
  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }
  
  // Create demo user object
  const createDemoUser = (): DemoUser => {
    return {
      id: 'demo-user-' + (sessionId.value || 'unknown'),
      email: 'demo@dynalis.com',
      first_name: 'Demo',
      last_name: 'User',
      full_name: 'Demo User',
      created_at: new Date().toISOString()
    }
  }
  
  // Clear demo-specific data
  const clearDemoData = () => {
    if (!import.meta.client) return
    
    // Clear any demo-specific localStorage items
    const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith('demo_'))
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
  
  // Check if user is in demo mode (for use in other composables)
  const isDemoMode = () => {
    if (!import.meta.client) return false
    return sessionStorage.getItem('demo_mode') === 'true'
  }
  
  // Get demo user (for use in other composables)
  const getDemoUser = (): DemoUser | null => {
    return isDemoMode() ? (demoUser.value || createDemoUser()) : null
  }
  
  // Initialize on mount
  if (import.meta.client) {
    // Initialize session if already in demo mode
    initializeSession()
    
    // Clean up timer on page unload
    window.addEventListener('beforeunload', () => {
      stopTimer()
    })
  }
  
  // Watch for session end
  watch(isActive, (active) => {
    if (!active) {
      stopTimer()
    }
  })
  
  return {
    // State
    isActive: readonly(isActive),
    isDemo,
    sessionId: readonly(sessionId),
    demoUser: readonly(demoUser),
    remainingTime: readonly(remainingTime),
    timeRemaining,
    timeRemainingFormatted,
    showWarning: readonly(showWarning),
    progress,
    
    // Actions
    startSession,
    endSession,
    extendSession,
    
    // Utilities
    isDemoMode,
    getDemoUser,
    
    // Service base functionality
    ...serviceBase
  }
}