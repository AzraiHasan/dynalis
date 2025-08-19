# Sample Template Implementation Documentation

## Overview

The Sample Template feature in Dynalis provides users with a standardized Excel/CSV template to prepare their property rental data before uploading it to the PostgreSQL database via Supabase. This feature enables consistent data formatting and reduces upload errors by providing a clear structure that aligns perfectly with the database schema.

## Implementation Architecture

### 1. Template Files Location

The sample templates are stored as static files in the public directory:

```
/public/templates/
├── dynalis-sample-data.csv   # CSV version
└── dynalis-sample-data.xlsx  # Excel version (preferred)
```

### 2. Template Structure

The template follows a standardized column structure that maps directly to the database schema:

| Column Name | Description | Data Type | Example |
|-------------|-------------|-----------|---------|
| `SITE ID` | Unique identifier for each property site | Text | KL001, PJ002, SB003 |
| `TOTAL RENTAL (RM)` | Monthly rental amount in Malaysian Ringgit | Currency | RM 15,000.00 |
| `TOTAL PAYMENT TO PAY (RM)` | Outstanding payment amount | Currency | RM 8,500.00 |
| `DEPOSIT (RM)` | Security deposit amount | Currency | RM 30,000.00 |
| `EXP DATE` | Contract expiration date | Date | 15/12/2024 |

### 3. Sample Data Content

The template includes 15 sample rows with realistic Malaysian property data:

```csv
SITE ID,TOTAL RENTAL (RM),TOTAL PAYMENT TO PAY (RM),DEPOSIT (RM),EXP DATE
KL001,"RM 15,000.00","RM 8,500.00","RM 30,000.00",15/12/2024
PJ002,"RM 12,500.00","RM 6,250.00","RM 25,000.00",28/02/2025
SB003,"RM 18,000.00","RM 9,000.00","RM 36,000.00",10/11/2024
```

**Key Features of Sample Data:**
- Covers major Malaysian cities (KL=Kuala Lumpur, PJ=Petaling Jaya, SB=Subang, etc.)
- Includes realistic rental amounts (RM 9,800 to RM 22,000)
- Demonstrates various contract expiration dates
- Shows optional fields (some payment amounts are empty)

## User Interface Integration

### 1. Sidebar Download Link

The template download is integrated into the default layout sidebar and is **always available** regardless of user authentication status:

**Location:** `app/layouts/default.vue:66-78`

```vue
<!-- Template Download (Always Available) -->
<div class="pt-4 border-t border-gray-200">
  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resources</p>
  <a
    href="/templates/dynalis-sample-data.xlsx"
    download
    class="flex items-center gap-3 px-4 py-3 text-gray-600 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
  >
    <UIcon name="i-lucide-download" class="w-5 h-5" />
    <span class="font-medium">Sample Template</span>
  </a>
  <p class="text-xs text-gray-400 px-4 mt-1">Prepare your data before upload</p>
</div>
```

**Design Features:**
- Prominent download icon (Lucide download icon)
- Hover effects with blue accent colors
- Descriptive helper text
- Always accessible for better UX

### 2. Getting Started Instructions

The template download is referenced in the onboarding flow on the index page:

**Location:** `app/pages/index.vue:143`

```vue
<li>• Download the sample template from the sidebar</li>
<li>• Fill in your property data</li>  
<li>• Upload and analyze your data</li>
```

## Data Processing Pipeline

### 1. Template-to-Database Mapping

When users upload data using the template format, the system processes it through a transformation layer:

**Location:** `app/composables/useBatchUploadService.ts:698-717`

```typescript
const transformedData: SiteInsert[] = data.map((row) => ({
  site_id: row["SITE ID"]?.toString() || "NO ID",
  exp_date: row["EXP DATE"]
    ? parseDate(row["EXP DATE"]?.toString() || "")?.toISOString() || null
    : null,
  total_rental: parseFloat(
    (row["TOTAL RENTAL (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
  ),
  total_payment_to_pay: parseFloat(
    (row["TOTAL PAYMENT TO PAY (RM)"]?.toString() || "0").replace(
      /[RM,\s]/g,
      ""
    )
  ),
  deposit: parseFloat(
    (row["DEPOSIT (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
  ),
  updated_at: new Date().toISOString(),
}));
```

**Key Processing Features:**
- **Field Mapping:** Direct mapping from template columns to database fields
- **Data Cleaning:** Removes currency symbols (RM), commas, and whitespace from monetary values
- **Date Parsing:** Uses `parseDate()` utility to handle various date formats and convert to ISO strings
- **Validation:** Handles missing values gracefully with defaults ("NO ID" for missing site_id)
- **UUID Generation:** Database auto-generates UUIDs using `uuid_generate_v4()`
- **Timestamp Management:** Adds `updated_at` timestamp, database handles `created_at` automatically

### 2. Database Schema Alignment

The template structure aligns perfectly with the PostgreSQL database schema via Supabase:

**Location:** `supabase/migrations/20250324051048_create_sites_table.sql:2-14`

```sql
CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id TEXT NOT NULL,
  exp_date DATE,
  total_rental DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_payment_to_pay DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT sites_site_id_key UNIQUE (site_id)
);
```

**Schema Mapping:**
- `SITE ID` → `site_id` (TEXT with UNIQUE constraint)
- `TOTAL RENTAL (RM)` → `total_rental` (DECIMAL(12,2) for precise currency handling)
- `TOTAL PAYMENT TO PAY (RM)` → `total_payment_to_pay` (DECIMAL(12,2) for precise currency handling)
- `DEPOSIT (RM)` → `deposit` (DECIMAL(12,2) for precise currency handling)
- `EXP DATE` → `exp_date` (DATE type for proper date operations)

## Technical Implementation Details

### 1. Database Architecture

**PostgreSQL via Supabase:**
- **DECIMAL Precision:** Uses `DECIMAL(12,2)` for all monetary fields to prevent floating-point precision errors
- **UUID Primary Keys:** Auto-generated UUID primary keys using `uuid_generate_v4()`
- **Date Types:** Proper `DATE` type for expiration dates with timezone support
- **Row Level Security:** Enabled with policies for authenticated users
- **Real-time Updates:** Supabase real-time subscriptions for upload progress tracking
- **Batch Processing:** PostgreSQL functions for efficient bulk operations with concurrency control

### 2. File Serving Strategy

- **Static File Serving:** Templates are served directly from `/public/templates/` via Nuxt's static file serving
- **Multiple Formats:** Both CSV and Excel formats available (Excel preferred for better formatting)
- **Direct Download:** Uses HTML5 `download` attribute for immediate download

### 3. Data Validation & Error Handling

- **Currency Parsing:** Robust regex parsing (`/[RM,\s]/g`) removes "RM", commas, and whitespace
- **Date Validation:** `parseDate()` utility handles multiple date formats and validates dates
- **Missing Data Handling:** Graceful handling with meaningful defaults ("NO ID" for missing site_id)
- **Type Safety:** TypeScript interfaces with Supabase-generated types ensure data consistency
- **Database Constraints:** PostgreSQL DECIMAL type prevents precision loss in monetary calculations
- **Batch Processing:** Built-in error recovery and retry mechanisms for large uploads

### 4. User Experience Considerations

- **Always Available:** Template download works for both authenticated and unauthenticated users
- **Clear Instructions:** Step-by-step guidance in the UI
- **Realistic Examples:** Sample data reflects actual Malaysian property scenarios
- **Error Prevention:** Template structure reduces upload validation errors
- **Real-time Feedback:** Progress tracking via Supabase real-time subscriptions
- **Batch Upload Support:** Handles large datasets with background processing and cancellation capabilities

## Benefits & Design Rationale

### 1. Consistency
- Standardized column names and format
- Predictable data structure for processing
- Reduces support requests about data formatting

### 2. User Onboarding
- Clear example of expected data format
- Realistic sample data helps users understand requirements
- Reduces barrier to entry for new users

### 3. System Reliability
- Pre-validated structure reduces parsing errors
- Consistent field mapping improves data quality
- Clear expectations prevent malformed uploads
- PostgreSQL ACID compliance ensures data integrity during batch operations
- Row-level locking prevents concurrent update conflicts
- Built-in error recovery and rollback capabilities

### 4. Accessibility
- Available before authentication to support evaluation
- Multiple file formats (CSV/Excel) for different user preferences
- Clear visual indicators and helper text

## Future Enhancement Opportunities

1. **Dynamic Templates:** Generate templates based on custom field configurations
2. **Localization:** Support for different languages and currency formats
3. **Validation Preview:** Client-side template validation before upload
4. **Template Versioning:** Support for different template versions as schema evolves
5. **Custom Templates:** Allow users to create custom templates for specific use cases

## File References

- **Template Files:** `/public/templates/dynalis-sample-data.{csv,xlsx}`
- **UI Integration:** `/app/layouts/default.vue:66-78`
- **Data Processing:** `/app/composables/useBatchUploadService.ts:698-717`
- **Database Schema:** `/supabase/migrations/20250324051048_create_sites_table.sql:2-14`
- **Type Definitions:** `/app/types/supabase.ts:1-15`
- **Date Utilities:** `/utils/dateUtils.ts`
- **Onboarding Flow:** `/app/pages/index.vue:143`