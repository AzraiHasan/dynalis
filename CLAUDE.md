# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Package Management & Dependencies:**
- `bun install` - Install dependencies (preferred package manager)
- `bun run dev` - Start development server on http://localhost:3000
- `bun run build` - Build for production
- `bun run preview` - Preview production build locally
- Always ask to manually install packages and provide the installation command

**Code Quality:**
- `bun run lint` - Run ESLint checks
- `bun run lint:fix` - Fix ESLint issues automatically

## Architecture Overview

### Tech Stack
- **Frontend:** Nuxt.js 3 with Vue 3 Composition API and Nuxt UI
- **Backend:** Nitro with SQLite database (using better-sqlite3)
- **Authentication:** nuxt-auth-utils
- **Language:** TypeScript throughout
- **Package Manager:** Bun

### Application Structure

**Core Pages:**
- `dataupload.vue` - File upload interface for batch processing
- `datastaging.vue` - Data validation and staging area  
- `dashboard.vue` - Job monitoring and status tracking
- `index.vue` - Landing/authentication page

**Key Composables (Business Logic Layer):**
- `useBatchUploadService.ts` - Core batch processing orchestration
- `useUploadState.ts` - Upload state management and validation
- `useFileUpload.ts` - File handling and batch processing
- `useSiteData.ts` - Data caching and fetching
- `useSQLiteBatchUpload.ts` - SQLite-specific batch operations
- `useSQLiteSiteData.ts` - SQLite data operations

**Server Architecture:**
- `server/api/` - API endpoints organized by feature
- `server/repositories/` - Data access layer with repository pattern
- `server/utils/db.ts` - Database connection and initialization
- `server/plugins/database.ts` - Database initialization on startup

### Database Schema

**Primary Tables:**
- `sites` - Main site data with rental/payment information
- `users` - User authentication and profiles
- Additional job tracking tables for batch processing

**Database Configuration:**
- SQLite database stored at `.data/dynalis.sqlite3`
- Automatic initialization via Nitro plugin
- Repository pattern for data access

### Key Patterns

**State Management:**
- Composition API with reactive state
- Composables act as service layer
- Upload state centralized in `useUploadState`

**Batch Processing Flow:**
1. File upload → validation → staging → processing → completion
2. Job creation and tracking throughout lifecycle
3. Real-time progress updates and cancellation support
4. Deduplication and error handling

**Repository Pattern:**
- All database operations go through repository classes
- Type-safe database interactions
- Separation of concerns between API routes and data access

## File Upload System

The application centers around a sophisticated batch upload system:
- Multi-file upload with progress tracking
- CSV/Excel parsing with validation
- Background job processing
- Upload cancellation and recovery
- Data staging area for review before final processing

## Development Notes

- Database is automatically initialized on first run
- Initial user seeded via `server/utils/seedUsers.ts`
- Uses Nitro's experimental database feature
- Authentication handled through nuxt-auth-utils
- Type definitions shared between client and server in `types/` directories

## Code Quality Guidelines

**Code Documentation:**
- Add descriptive comments for every function
- Explain the purpose, inputs, outputs, and any complex logic
- Use JSDoc or TypeScript comment style for better IDE integration
- Ensure comments provide additional context beyond the code itself