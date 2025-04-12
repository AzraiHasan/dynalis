// server/api/auth/login.post.ts

import { H3Event } from 'h3'
import * as z from 'zod'

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
})

type LoginRequest = z.infer<typeof loginSchema>

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Parse and validate request
    const body = await readBody(event)
    const validatedData = loginSchema.parse(body)
    
    // For development/POC, just verify if credentials match expected values
    // In production, you would query your database here
    if (validatedData.email === 'admin@example.com' && validatedData.password === 'password123') {
      // Set the user session
      await setUserSession(event, {
        user: {
          id: '1',
          email: validatedData.email,
          name: 'Admin User'
        },
        loggedInAt: new Date()
      })
      
      return { success: true }
    }
    
    // Authentication failed
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createError({
        statusCode: 400,
        message: error.errors[0].message
      })
    }
    
    return createError({
      statusCode: 500,
      message: 'Authentication failed'
    })
  }
})