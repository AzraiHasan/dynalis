// composables/useAuth.ts
import { useSupabaseClient, useSupabaseUser } from '#imports'
import { useServiceBase } from './useServiceBase'
import { useErrorHandling, ErrorType, ErrorSeverity } from './useErrorHandling'
import type { ServiceResponse } from './useErrorHandling'
import type { AuthResponse } from '@supabase/supabase-js'

export const useAuth = () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const serviceBase = useServiceBase('auth', {
    enableCache: false, // Auth operations shouldn't be cached
    retries: 1, // Limited retries for auth operations
    timeout: 15000 // 15 seconds for auth operations
  })
  const errorHandler = useErrorHandling()
  
  // Check if we're in demo mode
  const isDemoMode = () => {
    if (!import.meta.client) return false
    return sessionStorage.getItem('demo_mode') === 'true'
  }
  
  // Debug logging (but not in demo mode)
  watch(user, (newUser) => {
    if (!isDemoMode()) {
      console.log("Supabase user state changed:", newUser?.email || 'null');
    }
  }, { immediate: true });

  const signUp = async (
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string
  ): Promise<ServiceResponse<AuthResponse['data']>> => {
    return serviceBase.execute(
      async () => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`
            }
          }
        })

        if (error) {
          throw errorHandler.createError(
            error.message,
            ErrorType.AUTHENTICATION,
            ErrorSeverity.HIGH,
            {
              details: error,
              context: 'signUp',
              recoverable: true,
              userMessage: 'Failed to create account. Please check your information and try again.'
            }
          )
        }
        
        return data
      },
      {
        context: 'auth-signUp',
        updateState: false // Don't cache auth responses
      }
    )
  }

  const signIn = async (email: string, password: string): Promise<ServiceResponse<AuthResponse['data']>> => {
    return serviceBase.execute(
      async () => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) {
          throw errorHandler.createError(
            error.message,
            ErrorType.AUTHENTICATION,
            ErrorSeverity.HIGH,
            {
              details: error,
              context: 'signIn',
              recoverable: true,
              userMessage: 'Invalid email or password. Please try again.'
            }
          )
        }
        
        return data
      },
      {
        context: 'auth-signIn',
        updateState: false
      }
    )
  }

  const signOut = async (): Promise<ServiceResponse<void>> => {
    return serviceBase.execute(
      async () => {
        const { error } = await supabase.auth.signOut()
        
        if (error) {
          throw errorHandler.createError(
            error.message,
            ErrorType.AUTHENTICATION,
            ErrorSeverity.MEDIUM,
            {
              details: error,
              context: 'signOut',
              recoverable: true,
              userMessage: 'Failed to sign out. Please try again.'
            }
          )
        }
      },
      {
        context: 'auth-signOut',
        updateState: false
      }
    )
  }

  const resetPassword = async (email: string): Promise<ServiceResponse<void>> => {
    return serviceBase.execute(
      async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })
        
        if (error) {
          throw errorHandler.createError(
            error.message,
            ErrorType.AUTHENTICATION,
            ErrorSeverity.MEDIUM,
            {
              details: error,
              context: 'resetPassword',
              recoverable: true,
              userMessage: 'Failed to send reset email. Please check the email address and try again.'
            }
          )
        }
      },
      {
        context: 'auth-resetPassword',
        updateState: false
      }
    )
  }

  return {
    // User state
    user: readonly(user),
    
    // Auth operations (now with standardized responses)
    signUp,
    signIn,
    signOut,
    resetPassword,
    
    // Service state and operations
    ...serviceBase
  }
}