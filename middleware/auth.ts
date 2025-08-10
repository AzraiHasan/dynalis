// middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()
  
  // If no user is authenticated, redirect to login
  if (!user.value) {
    return navigateTo('/login')
  }
})