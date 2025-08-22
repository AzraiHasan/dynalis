// plugins/demo-auth.client.ts
export default defineNuxtPlugin(() => {
  // Check if we're in demo mode and override auth behavior
  const checkDemoMode = () => {
    if (typeof window !== 'undefined') {
      const isDemoMode = sessionStorage.getItem('demo_mode') === 'true'
      const currentPath = window.location.pathname
      
      if (isDemoMode || currentPath.startsWith('/demo-sandbox')) {
        // Prevent automatic redirects during demo
        if (currentPath === '/' && isDemoMode) {
          // Stay on landing page
          return
        }
        
        if (currentPath.startsWith('/demo-sandbox') && !isDemoMode) {
          // Initialize demo session if accessing demo-sandbox directly
          sessionStorage.setItem('demo_mode', 'true')
          sessionStorage.setItem('demo_start_time', Date.now().toString())
        }
      }
    }
  }
  
  // Run on client-side only
  if (import.meta.client) {
    // Check demo mode on initial load
    checkDemoMode()
    
    // Watch for route changes
    const router = useRouter()
    router.afterEach((to) => {
      if (to.path.startsWith('/demo-sandbox')) {
        // Ensure demo mode is set when accessing demo routes
        if (!sessionStorage.getItem('demo_mode')) {
          sessionStorage.setItem('demo_mode', 'true')
          sessionStorage.setItem('demo_start_time', Date.now().toString())
        }
      }
    })
  }
})