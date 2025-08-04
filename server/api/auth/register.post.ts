// server/api/auth/register.post.ts
import { defineEventHandler, readBody } from 'h3'
import { useUsersRepository } from '../../repositories/usersRepository'
import { z } from 'zod'

// Validation schema for registration
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional()
})

export default defineEventHandler(async (event) => {
  try {
    // Read and validate request body
    const body = await readBody(event)
    
    try {
      registerSchema.parse(body)
    } catch (validationError: any) {
      return {
        success: false,
        error: 'Validation error',
        details: validationError.format ? validationError.format() : validationError.message
      }
    }
    
    const { email, password, name } = body
    
    // Get users repository
    const usersRepository = useUsersRepository()
    
    // Check if user with this email already exists
    const existingUser = await usersRepository.findByEmail(email)
    
    if (existingUser) {
      return {
        success: false,
        error: 'User with this email already exists'
      }
    }
    
    // Create new user
    const user = await usersRepository.create({
      email,
      password,
      name
    })
    
    return {
      success: true,
      user
    }
  } catch (error: any) {
    console.error('Registration error:', error)
    return {
      success: false,
      error: error.message || 'Registration failed'
    }
  }
})
