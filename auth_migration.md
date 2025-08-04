# Supabase Auth Migration Plan

## Phase 1: Setup & Configuration (1-2 hours)
1. **Install Supabase Dependencies**
   - Remove `nuxt-auth-utils` from devDependencies
   - Add `@nuxtjs/supabase` module to dependencies
   - Update `nuxt.config.ts` to include Supabase module

2. **Supabase Project Setup**
   - Create new Supabase project
   - Configure authentication settings (email, OAuth providers if needed)
   - Set up environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)

## Phase 2: Database Migration (2-3 hours)
3. **Schema Recreation in Supabase**
   - Create `profiles` table in Supabase (extends auth.users)
   - Migrate `sites` table and other business data
   - Set up Row Level Security (RLS) policies
   - Create foreign key relationships to auth.users

4. **Data Migration Script**
   - Export existing user data from SQLite
   - Create migration script to import users to Supabase auth
   - Handle password migration (users will need to reset passwords due to auth system change)
   - Migrate business data (sites, jobs, etc.)

## Phase 3: Code Refactoring (3-4 hours)
5. **Remove Custom Auth System**
   - Delete `server/api/auth/` endpoints (login, register, logout, session)
   - Remove `server/repositories/usersRepository.ts`
   - Delete `server/utils/passwordUtils.ts` and `seedUsers.ts`

6. **Update Type Definitions**
   - Remove custom auth types in `app/types/auth.types.ts`
   - Update `app/types/auth.d.ts` for Supabase user type
   - Update repository types to use Supabase auth user IDs

7. **Replace Authentication Logic**
   - Update `middleware/auth.global.ts` to use `useSupabaseUser()`
   - Refactor `pages/index.vue` to use Supabase auth (magic link or email/password)
   - Update `components/NavBar.vue` to use Supabase user state
   - Replace session management across all composables

8. **Update Repositories & Business Logic**
   - Modify repositories to use Supabase client instead of SQLite
   - Update user ID references from custom IDs to Supabase UUIDs
   - Refactor data access patterns for PostgreSQL

## Phase 4: Enhanced Features (1-2 hours)
9. **Add Modern Auth Features**
   - Implement magic link authentication
   - Add OAuth providers (Google, GitHub) if desired
   - Set up email confirmation flows
   - Add password reset functionality

10. **Security & Performance**
    - Configure RLS policies for all tables
    - Set up proper user roles and permissions
    - Implement real-time subscriptions if needed

## Phase 5: Testing & Deployment (1-2 hours)
11. **Comprehensive Testing**
    - Test authentication flows (login, logout, registration)
    - Verify data access and permissions
    - Test route protection and session management
    - Validate business logic with new auth system

12. **Migration Rollback Plan**
    - Keep backup of SQLite database
    - Document rollback procedures
    - Test rollback scenario

## Key Benefits After Migration
- **Managed Authentication**: No custom auth code to maintain
- **Enhanced Security**: Built-in security best practices, RLS
- **Better UX**: Magic links, OAuth providers, email verification
- **Scalability**: PostgreSQL database, managed infrastructure
- **Real-time**: Built-in real-time capabilities for future features
- **Modern Standards**: Industry-standard auth patterns

## Migration Strategy
- **Zero-downtime approach**: Set up Supabase in parallel, migrate during maintenance window
- **User notification**: Inform users about password reset requirement
- **Gradual rollout**: Test with subset of users first

**Estimated Total Time**: 8-12 hours

This migration will modernize the authentication system significantly while maintaining all existing functionality.