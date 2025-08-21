# Reset Demo Button Implementation Plan

## Overview
Create a "Reset Demo" button that comprehensively clears all application data from both local storage and Supabase database for demo purposes.

## Data to Clear

### 1. Supabase Database Tables
- [ ] `sites` - All site rental data 
- [ ] `upload_jobs` - All upload job records
- [ ] `upload_conflicts` - All conflict resolution data  
- [ ] `upload_job_records` - All job-record links

### 2. Local Storage Keys
- [ ] `uploadedFileData` - Staged file data
- [ ] `background_job_id` - Job tracking IDs
- [ ] `dashboard_building` - UI state flags
- [ ] `bg_upload_${jobId}` - Background upload data (pattern-based clearing)
- [ ] `sidebar-collapsed` - UI preferences

### 3. Application State
- [ ] Clear Nuxt `useState` cache (site-data, loading, error states)
- [ ] Reset reactive composable states (upload, file states)

## Implementation Steps

### 1. Create Reset Composable
- [ ] **File:** `app/composables/useResetDemo.ts`
- [ ] Implement `clearSupabaseData()` function to truncate all tables
- [ ] Implement `clearLocalStorage()` to remove all relevant keys
- [ ] Implement `clearApplicationState()` to reset Nuxt state
- [ ] Add proper error handling and user feedback
- [ ] Include confirmation dialog with warning message

### 2. Add Reset Button to Sidebar
- [ ] **File:** `app/components/AppSidebar.vue`  
- [ ] Place in "Resources" section alongside Sample Template
- [ ] Use warning styling (red/orange) to indicate destructive action
- [ ] Include appropriate icon (trash/reset)

### 3. Update Supabase Service
- [ ] **File:** `app/utils/supabaseService.ts`
- [ ] Add database clearing methods
- [ ] Ensure proper transaction handling
- [ ] Add connection management for bulk operations

### 4. User Experience Features
- [ ] Show confirmation dialog with clear warning
- [ ] Display progress indicator during reset
- [ ] Provide success/error feedback  
- [ ] Auto-redirect to clean state after completion

### 5. Safety Features
- [ ] Demo-only functionality (add environment check if needed)
- [ ] Comprehensive error handling
- [ ] Transaction-based database clearing
- [ ] Graceful fallback if operations fail

## Files to Create/Modify

### New Files
- [ ] `app/composables/useResetDemo.ts` - Main reset functionality

### Modified Files  
- [ ] `app/components/AppSidebar.vue` - Add reset button to sidebar
- [ ] `app/utils/supabaseService.ts` - Add clear database methods

## Technical Details

### Reset Composable Interface
```typescript
interface ResetDemoService {
  resetDemo: () => Promise<void>
  isResetting: Ref<boolean>
  resetProgress: Ref<number>
  resetStatus: Ref<string>
}
```

### Database Clearing Strategy
1. Use Supabase transactions where possible
2. Clear in dependency order (jobs → conflicts → job_records → sites)
3. Provide rollback capability for failed operations
4. Log all operations for debugging

### UI/UX Considerations
- Clear visual distinction from other buttons
- Progressive disclosure (confirmation → progress → result)
- Prevent multiple simultaneous resets
- Maintain responsive design principles

## Success Criteria
- [ ] All database tables successfully cleared
- [ ] All local storage items removed  
- [ ] Application state properly reset
- [ ] User receives clear feedback throughout process
- [ ] System remains stable after reset
- [ ] No data remnants left behind

## Testing Checklist
- [ ] Test with existing data in all tables
- [ ] Test with various local storage states
- [ ] Test error scenarios (network issues, permission errors)
- [ ] Test user cancellation during process
- [ ] Verify complete system reset functionality