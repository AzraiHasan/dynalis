export default defineNuxtRouteMiddleware((to) => {
  // Check if this is a demo route
  const isDemoRoute = to.path.startsWith('/demo-sandbox') || to.query.demo === 'true'
  
  if (isDemoRoute) {
    // Set demo mode flag for the entire app
    if (import.meta.client) {
      sessionStorage.setItem('demo_mode', 'true')
      sessionStorage.setItem('demo_start_time', Date.now().toString())
    }
    
    // Allow demo routes to proceed without authentication
    return
  }
  
  // For non-demo routes, clear demo mode if set
  if (import.meta.client && sessionStorage.getItem('demo_mode')) {
    sessionStorage.removeItem('demo_mode')
    sessionStorage.removeItem('demo_start_time')
    sessionStorage.removeItem('demo_session_id')
  }
})