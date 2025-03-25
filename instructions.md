# Understanding the Upload Cancellation Process

When analyzing the cancellation mechanism in this codebase, I found that the cancellation functionality is primarily visual rather than a true process termination. Here's what actually happens when a user cancels an upload:

## The Cancellation Flow

1. In the `UploadProgressModal` component, a user clicks the "Cancel" button which emits a `cancel` event:
```vue
<UButton
  v-if="status !== 'complete' && status !== 'error'"
  color="neutral"
  @click="$emit('cancel')"
  :disabled="status === 'uploading'"
>
  Cancel
</UButton>
```

2. This event is caught in `datastaging.vue` by the `cancelUpload` function:
```javascript
const cancelUpload = () => {
  // Only allow cancellation in certain states
  if (
    uploadState.status.value === "preparing" ||
    uploadState.status.value === "processing"
  ) {
    uploadState.isUploading.value = false;
  }
};
```

3. Notably, this function only sets `uploadState.isUploading.value = false`, which **hides the progress modal** but doesn't actually terminate any background processes.

## Key Observations

- The "Cancel" button is intentionally **disabled during the "uploading" state** (`status === "uploading"`), suggesting that cancellation during active data transfer is not supported.

- The `cancelUpload` function only changes UI state and doesn't include any logic to:
  - Abort network requests
  - Stop batch processing
  - Clean up partially uploaded data
  - Send cancellation signals to Supabase

- There is no implementation of JavaScript's `AbortController` or similar mechanism to terminate in-flight HTTP requests or database operations.

- The batch upload process in `useBatchUploadService.ts` doesn't check for any cancellation flags during its execution.

## What Actually Continues in the Background

When a user "cancels" the upload:
1. The progress modal disappears
2. The batch processing continues undisturbed
3. Data keeps being sent to the Supabase `sites` table through the `bulk_upload_sites` function
4. The `upload_jobs` table entries continue to be updated with progress information

In essence, the cancellation feature in this application is a UI convention that removes the progress feedback without actually stopping the underlying data processing operations. This approach makes sense from a database integrity perspective (partial uploads could create inconsistent data), but may create confusion for users who expect the process to truly stop.

## Instructions for Cline

Complete the `cancelUpload` function to include the logic to:
  - Abort network requests
  - Stop batch processing
  - Clean up partially uploaded data
  - Send cancellation signals to Supabase
  - Update the `upload_jobs` table to reflect the cancellation status
  - Update the user on the cancellation status.