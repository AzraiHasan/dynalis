# Database Versioning Strategy

## Core Principles

- **Immutability**: Never modify existing migrations that have been applied
- **Atomicity**: Each migration should represent a single logical change
- **Forward-only**: Always move forward with new migrations (no rollbacks)
- **Testability**: Test migrations in sequence before production deployment

## Naming Conventions

Use the following format for migration files:
```
{timestamp}_{descriptive_name}.sql
```

Examples:
```
20240324155823_create_sites_table.sql
20240324160154_add_location_column.sql
20240324165432_create_users_permissions.sql
```

## Change Types and Examples

### Schema Changes

#### Adding a Table
```bash
supabase migration new create_tenants_table
```

```sql
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Authenticated users can read tenants" 
  ON public.tenants FOR SELECT TO authenticated USING (true);
```

#### Adding a Column
```bash
bun db:migration:new add_status_to_sites
```

```sql
ALTER TABLE public.sites ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
```

#### Modifying a Column
```bash
bun db:migration:new update_rental_column_precision
```

```sql
-- Create a new column with the desired type
ALTER TABLE public.sites ADD COLUMN total_rental_new DECIMAL(15,2);

-- Copy data
UPDATE public.sites SET total_rental_new = total_rental;

-- Drop the old column
ALTER TABLE public.sites DROP COLUMN total_rental;

-- Rename new column
ALTER TABLE public.sites RENAME COLUMN total_rental_new TO total_rental;
```

### Relationship Changes

```bash
bun db:migration:new add_site_tenant_relationship
```

```sql
-- Add foreign key column
ALTER TABLE public.sites ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- Create index for the foreign key
CREATE INDEX idx_sites_tenant_id ON public.sites(tenant_id);
```

### Security Changes

```bash
bun db:migration:new update_sites_rls_policies
```

```sql
-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can update their sites" ON public.sites;

-- Create more restrictive policy
CREATE POLICY "Users can update sites they created" 
  ON public.sites
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
```

## Workflow Guidelines

1. **Create migration**:
   ```bash
   bun db:migration:new descriptive_name
   ```

2. **Edit SQL file** in `supabase/migrations/`

3. **Test locally** (if Docker available):
   ```bash
   bun db:reset
   ```

4. **Apply to production**:
   ```bash
   bun db:push
   ```

5. **Commit to version control**:
   ```bash
   git add supabase/migrations/
   git commit -m "Add migration: descriptive_name"
   ```

## Handling Breaking Changes

1. **Carefully consider backward compatibility**
2. **Add migration warnings** in comments
3. **Plan for data migration** if needed
4. **Update application code** to work with both old and new schema during transition
5. **Document changes** in commits and project documentation

## Troubleshooting

- If a migration fails, fix the issue and create a new migration
- Never delete or modify existing migration files
- Use database transactions for complex migrations