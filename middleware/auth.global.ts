export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware for login page to avoid redirect loops
  if (to.path === '/') {
    return
  }

  // Access Supabase user state
  const user = useSupabaseUser()
  
  // If user is not logged in, redirect to login page
  if (!user.value) {
    return navigateTo('/')
  }
})