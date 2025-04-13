// composables/useBatchUploadService.ts
import { parseDate } from "~/utils/dateUtils";
import { useUploadState } from "~/composables/useUploadState";
import type { Site } from "~/types/supabase";

interface BatchUploadState {
  status:
    | "idle"
    | "preparing"
    | "uploading"
    | "processing"
    | "complete"
    | "error";
  progress: number;
  error: Error | null;
  totalBatches: number;
  processedBatches: number;
  processedRecords: number;
  uploadJobId?: string;
  abortController?: AbortController;
}

interface SiteInsert {
  site_id: string;
  exp_date: string | null;
  total_rental: number;
  total_payment_to_pay: number;
  deposit: number;
}

interface JobStatusMap {
  [jobId: string]:
    | "idle"
    | "queued"
    | "processing"
    | "complete"
    | "error"
    | "cancelled";
}

const cancelUpload = async (): Promise<void> => {
  const toast = useToast();
  const batchUploadService = useBatchUploadService();
  const uploadState = useUploadState();

  // Only allow cancellation in appropriate states
  if (
    !["preparing", "uploading", "processing"].includes(
      uploadState.status.value
    ) ||
    !batchUploadService.state.value.uploadJobId
  ) {
    console.warn("Cannot cancel: Invalid state or missing job ID");
    return;
  }

  try {
    // Update UI to show cancellation in progress
    uploadState.status.value = "processing";
    uploadState.statusMessage.value = "Cancelling upload...";

    // Create an AbortController instance to cancel ongoing operations
    const abortController = new AbortController();
    abortController.abort();

    // Set state to cancelled
    batchUploadService.state.value.status = "processing";
    batchUploadService.state.value.error = new Error(
      "Upload cancelled by user"
    );

    // Use fetch API instead of Supabase
    await fetch(
      `/api/jobs/${batchUploadService.state.value.uploadJobId}/cancel`,
      {
        method: "POST",
      }
    );

    // Reset upload state
    uploadState.status.value = "idle";
    uploadState.progress.value = 0;
    uploadState.isUploading.value = false;
    uploadState.statusMessage.value = "Upload cancelled";

    // Notify user
    toast.add({
      title: "Upload Cancelled",
      description: "The upload process has been cancelled successfully.",
      color: "info",
      duration: 5000,
    });

    console.log(
      `Upload job ${batchUploadService.state.value.uploadJobId} cancelled successfully`
    );
  } catch (error) {
    // Handle cancellation errors
    console.error("Error cancelling upload:", error);

    uploadState.status.value = "error";
    uploadState.error.value =
      error instanceof Error ? error : new Error(String(error));
    uploadState.statusMessage.value = `Cancellation failed: ${uploadState.error.value.message}`;

    toast.add({
      title: "Cancellation Error",
      description: uploadState.error.value.message,
      color: "error",
      duration: 5000,
    });
  }
};

export const useBatchUploadService = () => {
  const state = ref<BatchUploadState>({
    status: "idle",
    progress: 0,
    error: null,
    totalBatches: 0,
    processedBatches: 0,
    processedRecords: 0,
  });

  const isUploading = computed(() =>
    ["preparing", "uploading", "processing"].includes(state.value.status)
  );

  const jobStatus = ref<JobStatusMap>({});

  const createUploadJob = async (
    filename: string,
    totalChunks: number
  ): Promise<string> => {
    try {
      const { data, error } = await useFetch("/api/jobs/create", {
        method: "POST",
        body: {
          filename,
          total_chunks: totalChunks,
          status: "created",
        },
      });

      if (error) throw new Error(String(error));

      // Add check for undefined jobId
      if (!data.value?.jobId) {
        throw new Error("Job creation failed: No job ID returned");
      }

      return data.value.jobId;
    } catch (error) {
      console.error("Failed to create upload job:", error);
      throw error;
    }
  };

  const updateUploadJobProgress = async (
    jobId: string,
    chunksReceived: number,
    processedRecords: number,
    status: string
  ) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chunks_received: chunksReceived,
          processed_records: processedRecords,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to update upload job:", error);
      // Don't throw, just log to avoid interrupting the main process
    }
  };

  const completeUploadJob = async (jobId: string, processedRecords: number) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "complete",
          chunks_received: state.value.totalBatches,
          processed_records: processedRecords,
          completed_at: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to complete upload job:", error);
    }
  };

  // Record error in upload job
  const recordUploadError = async (jobId: string, errorMessage: string) => {
    try {
      await fetch(`/api/jobs/${jobId}/progress`, {
        method: "POST",
        body: JSON.stringify({
          status: "error",
          error_message: errorMessage,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Failed to record upload error:", error);
    }
  };

  // Process data through batched inserts
  const processBulkUpload = async (
    data: any[],
    fileName: string = "upload.csv"
  ): Promise<{ success: boolean; processedRecords: number }> => {
    try {
      // Reset state - keep existing code
      state.value = {
        status: "preparing",
        progress: 0,
        error: null,
        totalBatches: 0,
        processedBatches: 0,
        processedRecords: 0,
      };

      // Transform data - same transformation code
      const transformedData = data.map((row) => ({
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
      }));

      // Process via API endpoint instead of direct database calls
      const { data: result, error } = await useFetch("/api/sites/batch-upload", {
      method: "POST",
      body: {
        sites: transformedData,
        fileName,
      },
    });

    if (error) throw new Error(String(error));

    state.value.status = "complete";
    state.value.progress = 100;
    state.value.processedRecords = result.value?.count || 0;

    // Return only the properties that exist in the response
    return {
      success: true,
      processedRecords: result.value?.count || 0,
      // Remove the jobId property since it doesn't exist in the response
    };
  } catch (error) {
    state.value.status = "error";
    state.value.error = error instanceof Error ? error : new Error(String(error));
    throw error;
  }
};

  const checkIncompleteUploads = async (fileName?: string): Promise<any[]> => {
  try {
    // Build URL with optional filename parameter
    const url = new URL('/api/jobs/incomplete', window.location.origin);
    if (fileName) {
      url.searchParams.append('filename', fileName);
    }

    // Fetch incomplete uploads from API
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error checking incomplete uploads:", error);
    return [];
  }
};

  // Get upload job details
  const getUploadJobDetails = async (jobId: string) => {
  try {
    const response = await fetch(`/api/jobs/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error getting upload job details:", error);
    throw error;
  }
};

  // Resume an interrupted upload
  const resumeUpload = async (jobId: string, data: any[]): Promise<any> => {
  try {
    // Get the job details - this is already updated
    const job = await getUploadJobDetails(jobId);

    // State setup remains the same
    state.value = {
      status: "uploading",
      progress: Math.round((job.chunks_received / job.total_chunks) * 100),
      error: null,
      totalBatches: job.total_chunks,
      processedBatches: job.chunks_received,
      processedRecords: job.processed_records,
      uploadJobId: jobId,
    };

    // Data transformation remains the same
    const transformedData = data.map((row) => ({
      site_id: row["SITE ID"]?.toString() || "NO ID",
      exp_date: row["EXP DATE"]
        ? parseDate(row["EXP DATE"]?.toString() || "")?.toISOString() || null
        : null,
      total_rental: parseFloat(
        (row["TOTAL RENTAL (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
      ),
      total_payment_to_pay: parseFloat(
        (row["TOTAL PAYMENT TO PAY (RM)"]?.toString() || "0").replace(
          /[RM,\s]/g, ""
        )
      ),
      deposit: parseFloat(
        (row["DEPOSIT (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
      ),
    }));

    const batchSize = 250;
    const batches = Math.ceil(transformedData.length / batchSize);

    // Start from the last processed batch
    let processedRecords = job.processed_records;

    for (let i = job.chunks_received; i < batches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, transformedData.length);
      const batchData = transformedData.slice(startIdx, endIdx);

      try {
        // Replace Supabase RPC call with fetch to API endpoint
        const response = await fetch("/api/sites/batch-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sites: batchData,
            jobId: jobId, // Include the job ID for tracking
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        processedRecords += batchData.length;
        state.value.processedBatches = i + 1;
        state.value.processedRecords = processedRecords;
        state.value.progress = Math.round(((i + 1) / batches) * 100);

        // Update progress in the upload job
        await updateUploadJobProgress(
          jobId,
          i + 1,
          processedRecords,
          "uploading"
        );
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
        await recordUploadError(
          jobId,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }

    await completeUploadJob(jobId, processedRecords);

    state.value.status = "complete";
    state.value.progress = 100;

    return { success: true, processedRecords, resumed: true, jobId };
  } catch (error) {
    // Error handling remains the same
    state.value.status = "error";
    state.value.error =
      error instanceof Error ? error : new Error(String(error));

    if (state.value.uploadJobId) {
      await recordUploadError(
        state.value.uploadJobId,
        error instanceof Error ? error.message : String(error)
      );
    }

    throw error;
  }
};

  const startAsyncProcessing = async (
  data: FileRow[],
  fileName: string = "upload.csv"
): Promise<{ jobId: string }> => {
  try {
    // Data transformation remains the same
    const transformedData = data.map((row) => ({
      site_id: row["SITE ID"]?.toString() || "NO ID",
      exp_date: row["EXP DATE"]
        ? parseDate(row["EXP DATE"]?.toString() || "")?.toISOString() || null
        : null,
      total_rental: parseFloat(
        (row["TOTAL RENTAL (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
      ),
      total_payment_to_pay: parseFloat(
        (row["TOTAL PAYMENT TO PAY (RM)"]?.toString() || "0").replace(
          /[RM,\s]/g, ""
        )
      ),
      deposit: parseFloat(
        (row["DEPOSIT (RM)"]?.toString() || "0").replace(/[RM,\s]/g, "")
      ),
    }));

    const batchSize = 250;
    const batches = Math.ceil(transformedData.length / batchSize);

    // Use our jobs/create API endpoint
    const response = await fetch("/api/jobs/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: fileName,
        total_chunks: batches,
        status: "queued",
        sites: transformedData, // Pass the data directly to the API
      }),
    });

    if (!response.ok) {
      throw new Error(`Job creation failed: ${response.statusText}`);
    }

    const result = await response.json();
    const jobId = result.jobId;

    if (!jobId) {
      throw new Error("Failed to create job: No job ID returned");
    }

    // We likely don't need localStorage anymore since data is passed to API
    // But keeping it for backward compatibility
    localStorage.setItem(
      `bg_upload_${jobId}`,
      JSON.stringify({
        transformedData: [], // Empty since already sent to server
        batchSize,
        batches,
        jobId,
        fileName,
      })
    );

    // The API now handles processing, no need to call processBackgroundJob

    return { jobId };
  } catch (error) {
    console.error("Error starting async processing:", error);
    throw error;
  }
};

  // Process a job in the background
  const processBackgroundJob = async (jobId: string) => {
  try {
    jobStatus.value[jobId] = "processing";
    // Get the stored job data
    const storedData = localStorage.getItem(`bg_upload_${jobId}`);
    if (!storedData) {
      jobStatus.value[jobId] = "error";
      throw new Error("No data found for background job");
    }

    const { transformedData, batchSize, batches, fileName } =
      JSON.parse(storedData);

    // Use repository instead of direct Supabase call
    const jobsRepo = useJobsRepository();
    await jobsRepo.updateProgress(jobId, { status: "processing" });

    let processedRecords = 0;

    // Process each batch
    for (let i = 0; i < batches; i++) {
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, transformedData.length);
      const batchData = transformedData.slice(startIdx, endIdx);

      try {
        // Replace Supabase RPC with sitesRepository call
        const sitesRepo = useSitesRepository();
        const batchResult = await sitesRepo.batchUpsert(batchData);
        processedRecords += batchResult;

        // Update job progress using repository
        await jobsRepo.updateProgress(jobId, {
          chunks_received: i + 1,
          processed_records: processedRecords
        });
      } catch (error) {
        await recordUploadError(
          jobId,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    }

    jobStatus.value[jobId] = "complete";

    // Complete the job using repository
    await jobsRepo.completeJob(jobId, processedRecords);

    // Clean up local storage
    localStorage.removeItem(`bg_upload_${jobId}`);
    return { success: true, processedRecords };
  } catch (error) {
    console.error("Error in background processing:", error);

    jobStatus.value[jobId] = 'error';

    // Update job status using repository
    const jobsRepo = useJobsRepository();
    await jobsRepo.updateProgress(jobId, {
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
};

  // Get job status
  const getJobStatus = async (jobId: string) => {
    try {
      const { data, error } = await useFetch(`/api/jobs/${jobId}`);

      if (error) throw new Error(String(error));
      return data.value;
    } catch (error) {
      console.error("Error getting job status:", error);
      throw error;
    }
  };

  return {
    processBulkUpload,
    createUploadJob,
    updateUploadJobProgress,
    resumeUpload,
    checkIncompleteUploads,
    state,
    isUploading,
    progress: computed(() => state.value.progress),
    startAsyncProcessing,
    getJobStatus,
    cancelUpload,
    jobStatus,
  };
};
