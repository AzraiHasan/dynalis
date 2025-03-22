# Supabase Database Integration Plan

## Main Goal
Implement robust Supabase database integration for the Excel interpreter application to provide persistent data storage, enabling data sharing, historical analysis, and multi-user access while maintaining the current application flow.

## Success Criteria
- Zero disruption to existing application flow
- Graceful fallback to localStorage when offline
- Proper handling of large datasets (>10,000 rows)
- Support for all Excel data types in uploaded files
- Secured database connection credentials

## Phase 1: Basic Upload Implementation
**Goal**: Establish a minimal working Supabase integration with predefined schema

### Tasks:
1. Configure Supabase client connection in the application
   ```javascript
   const { supabase } = useSupabaseClient()
   ```

2. Create a fixed schema table in Supabase
   - Table name: `site_data`
   - Core columns: site_id, exp_date, total_rental, total_payment, deposit
   - Metadata columns: upload_batch_id, uploaded_at, last_updated, file_name

3. Secure API Keys
   - Store Supabase URL and anon key in environment variables
   - Ensure keys are not exposed in client-side code

4. Enhance `handleDashboard` function to:
   - Maintain localStorage verification
   - Add basic error handling
   - Implement simple progress indicator
   - Allow fallback to localStorage if upload fails

5. Add basic status indicators in the UI
   ```html
   <UAlert v-if="uploadStatus === 'uploading'" color="info">
     <p>Uploading data to database...</p>
     <UProgress v-model="uploadProgress" />
   </UAlert>
   ```

6. Test with sample data files

## Phase 2: Dynamic Schema Management
**Goal**: Create flexible schema handling to accommodate various Excel file structures

### Tasks:
1. Implement table existence checking
   ```javascript
   const tableExists = async (tableName) => {
     const { error } = await supabase
       .from(tableName)
       .select('count(*)')
       .limit(1)
     return !error
   }
   ```

2. Create a schema management function to:
   - Create tables dynamically based on Excel headers
   - Use RPC or edge functions for DDL operations
   - Add JSON column for additional/custom fields

3. Implement intelligent data type mapping:
   - Detect date formats → timestamp
   - Detect currency values → numeric
   - Handle nulls and missing values

4. Add data validation before upload
   - Sanitize column names
   - Handle data type conflicts

5. Implement versioning for schema changes

6. Add basic table access controls (optional for POC)
   ```sql
   -- Run this in SQL Editor for appropriate access levels
   GRANT SELECT, INSERT ON TABLE site_data TO anon;
   ```

## Phase 3: Advanced Features
**Goal**: Optimize performance and enhance user experience for large datasets

### Tasks:
1. Implement background processing
   - Move upload to a worker thread
   - Allow users to continue to dashboard while upload continues

2. Add robust retry logic
   ```javascript
   const uploadWithRetry = async (data, tableName, attempts = 3) => {
     try {
       return await supabase.from(tableName).upsert(data)
     } catch (error) {
       if (attempts <= 1) throw error
       await new Promise(r => setTimeout(r, 1000))
       return uploadWithRetry(data, tableName, attempts - 1)
     }
   }
   ```

3. Implement conflict resolution strategies
   - Allow users to choose merge/replace/skip options
   - Visualize conflicts in the UI

4. Add transaction support for data integrity
   - All-or-nothing uploads
   - Rollback capability

5. Implement data synchronization
   - Periodic sync between localStorage and Supabase
   - Offline support with sync on reconnect

6. Add performance monitoring
   - Track upload times
   - Implement size-based optimizations

## Future Considerations (Post-POC)
- Implement user authentication
- Add row-level security policies based on authenticated users
- Develop organization/team-based access controls
- Implement audit logging for database operations

