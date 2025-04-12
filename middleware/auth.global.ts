export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for login page to avoid redirect loops
  if (to.path === '/') {
    return
  }

  // Access user session state
  const { loggedIn, ready } = useUserSession()
  
  // If session isn't ready yet, we can wait briefly for client-side hydration
  // This is a simpler alternative to the 'until' function
  if (!ready.value) {
    // For SSR, we should still allow navigation and handle auth client-side
    if (process.server) {
      return
    }
    
    // On client, we can use a small timeout to wait for session data
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // If user is not logged in, redirect to login page
  if (!loggedIn.value) {
    return navigateTo('/')
  }
})