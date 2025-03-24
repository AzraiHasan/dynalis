# Supabase Migration Guide for Property Management System

## 1. Prerequisites

**Goal**: Set up development environment with necessary tools

- Install Supabase CLI:
  ```bash
  npm install -g supabase
  ```
- Initialize Supabase project (if not done):
  ```bash
  supabase init
  ```
- Link to your remote project:
  ```bash
  supabase link --project-ref your-project-ref
  ```

## 2. Create Migration Files

**Goal**: Create structured migration files for version control

```bash
supabase migration new create_sites_table
```

This creates a timestamped SQL file in `./supabase/migrations/` directory.

## 3. Define Table Schema

**Goal**: Create properly typed database schema

Edit the generated migration file with:

```sql
-- Create sites table with proper PostgreSQL types
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,
  exp_date DATE,
  total_rental DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_payment_to_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add a unique constraint on site_id
  CONSTRAINT sites_site_id_key UNIQUE (site_id)
);

-- Create index for faster queries
CREATE INDEX idx_sites_site_id ON public.sites(site_id);
CREATE INDEX idx_sites_exp_date ON public.sites(exp_date);

-- Enable Row Level Security
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Authenticated users can read sites" 
  ON public.sites
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sites" 
  ON public.sites
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their sites" 
  ON public.sites
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

## 4. Update TypeScript Types

**Goal**: Ensure type safety in your application

Create or update a types file (e.g., `app/types/supabase.ts`):

```typescript
export interface Site {
  id: string;
  site_id: string;
  exp_date: string | null;
  total_rental: number;
  total_payment_to_pay: number;
  deposit: number;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      sites: {
        Row: Site;
        Insert: Omit<Site, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Site, 'id'>> & { updated_at?: string };
      };
    };
  };
}
```

## 5. Apply Migration

**Goal**: Deploy schema changes to local and remote environments

Test locally first:
```bash
supabase start
supabase db reset
```

Apply to production:
```bash
supabase db push
```

## 6. Update `supabaseService.ts`

**Goal**: Improve initialization to use existing table

```typescript
// utils/supabaseService.ts
import { useSupabaseClient } from '#imports'
import { parseDate } from '~/utils/dateUtils'
import type { Database } from '~/types/supabase'

// ...existing code...

const initializeDatabase = async () => {
  try {
    // Just check if the table exists
    const { count, error } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    console.log(`Sites table exists with ${count} records`)
    return true
  } catch (error) {
    console.error('Database initialization failed:', error)
    return false
  }
}
```

## 7. Create Migration Script (Optional)

**Goal**: Add automation for development workflow

Create a script in `package.json`:

```json
{
  "scripts": {
    "db:migration:new": "supabase migration new",
    "db:push": "supabase db push",
    "db:reset": "supabase db reset"
  }
}
```

## 8. Versioning Strategy

**Goal**: Plan for future schema changes

- Create separate migration files for each schema change
- Use semantic versioning patterns
- Never modify existing migration files
- Always add new migrations for changes