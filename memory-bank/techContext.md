# Technical Context: Dynalis Stack

## Core Technologies
- Frontend: Nuxt.js 3 with Vue 3
- Backend: Supabase (PostgreSQL)
- Language: TypeScript
- Package Manager: Bun
- Linting: ESLint

## Development Setup
1. **Dependencies**
   - @nuxtjs/supabase
   - Vue composition API
   - Other Nuxt ecosystem packages

2. **Configuration**
   - nuxt.config.ts: Main app config
   - eslint.config.mjs: Linting rules
   - tsconfig.json: TypeScript settings
   - supabase/config.toml: Database config

3. **Database**
   - Managed through Supabase migrations
   - Tables for sites, upload tracking, and jobs
   - Custom bulk upload function

## Tooling
- Bun for package management
- TypeScript for type safety
- ESLint for code quality
- Git for version control
