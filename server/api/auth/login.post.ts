// server/api/auth/login.post.ts
import { H3Event } from 'h3';
import * as z from 'zod';
import { useUsersRepository } from '../../repositories/usersRepository';

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Must be at least 8 characters"),
});

type LoginRequest = z.infer<typeof loginSchema>;

export default defineEventHandler(async (event: H3Event) => {
  try {
    // Parse and validate request
    const body = await readBody(event);
    const validatedData = loginSchema.parse(body);
    
    // Use the repository to verify credentials
    const usersRepo = useUsersRepository();
    const user = await usersRepo.verifyCredentials(
      validatedData.email, 
      validatedData.password
    );
    
    if (user) {
      // Set the user session
      await setUserSession(event, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || 'User'
        },
        loggedInAt: new Date()
      });
      
      return { success: true, user };
    }
    
    // Authentication failed
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createError({
        statusCode: 400,
        message: error.errors[0].message
      });
    }
    
    return createError({
      statusCode: 500,
      message: 'Authentication failed'
    });
  }
});