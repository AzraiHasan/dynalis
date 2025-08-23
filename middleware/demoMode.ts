export default defineNuxtRouteMiddleware((to) => {
  // Check if this is a demo route
  const isDemoRoute = to.path.startsWith('/demo-sandbox') || to.query.demo === 'true'
  
  if (isDemoRoute) {
    // Set demo mode flag for the entire app
    if (import.meta.client) {
      localStorage.setItem('demo_mode', 'true')
      localStorage.setItem('demo_start_time', Date.now().toString())
    }
    
    // Allow demo routes to proceed without authentication
    return
  }
  
  // For non-demo routes, clear demo mode if set
  if (import.meta.client && localStorage.getItem('demo_mode')) {
    localStorage.removeItem('demo_mode')
    localStorage.removeItem('demo_start_time')
    localStorage.removeItem('demo_session_id')
  }
})