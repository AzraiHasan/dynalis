export default defineNuxtRouteMiddleware(() => {
  // Check if in demo mode (client-side only)
  if (typeof window !== 'undefined') {
    const isDemoMode = localStorage.getItem('dynalis-demo-mode') === 'true'
    
    if (isDemoMode) {
      // Skip all auth requirements in demo mode
      return
    }
  }
  
  // For non-demo mode, apply original auth logic if needed
  // This middleware runs globally but only affects demo mode
  // The existing auth logic in other middleware will handle production auth
})