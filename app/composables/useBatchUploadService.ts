// composables/useBatchUploadService.ts
import { ref, computed } from "vue";
import { useSupabaseClient } from "#imports";
import { parseDate } from "~/utils/dateUtils";
import type { Database } from "~/types/supabase";
import { useUploadState } from "~/composables/useUploadState";
import type { FileRow } from "~/utils/supabaseService";

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

// Define the shape of site data to match our database schema
type SiteInsert = Database["public"]["Tables"]["sites"]["Insert"];

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
  const supabase = useSupabaseClient<Database>();
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

    // 2. Update the upload_jobs table
    const { error: updateError } = await supabase
      .from("upload_jobs")
      .update({
        status: "cancelled",
        error_message: "Upload cancelled by user",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchUploadService.state.value.uploadJobId);

    if (updateError) {
      throw new Error(`Failed to update job status: ${updateError.message}`);
    }

    // 3. Clean up partially uploaded data by adding a "cancelled" tag
    // This allows identifying which records were part of a cancelled upload
    const { error: cleanupError } = await supabase.rpc(
      "mark_cancelled_upload_records",
      {
        job_id: batchUploadService.state.value.uploadJobId,
      }
    );

    if (cleanupError) {
      console.error("Warning: Failed to mark cancelled records:", cleanupError);
    }

    // 4. Reset upload state
    uploadState.status.value = "idle";
    uploadState.progress.value = 0;
    uploadState.isUploading.value = false;
    uploadState.statusMessage.value = "Upload cancelled";

    // 5. Notify user
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
  const supabase = useSupabaseClient<Database>();
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

  // Create a new upload job in the database
  const createUploadJob = async (
    filename: string,
    totalChunks: number
  ): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("upload_jobs")
        .insert({
          filename,
          total_chunks: totalChunks,
          status: "created",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error("Failed to create upload job:", error);
      throw error;
    }
  };

  // Update the upload job progress
  const updateUploadJobProgress = async (
    jobId: string,
    chunksReceived: number,
    processedRecords: number,
    status: string
  ) => {
    try {
      const { error } = await supabase
        .from("upload_jobs")
        .update({
          chunks_received: chunksReceived,
          processed_records: processedRecords,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to update upload job:", error);
      // Don't throw, just log to avoid interrupting the main process
    }
  };

  // Complete the upload job
  const completeUploadJob = async (jobId: string, processedRecords: number) => {
    try {
      const { error } = await supabase
        .from("upload_jobs")
        .update({
          status: "complete",
          chunks_received: state.value.totalBatches,
          processed_records: processedRecords,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to complete upload job:", error);
    }
  };

  // Record error in upload job
  const recordUploadError = async (jobId: string, errorMessage: string) => {
    try {
      const { error } = await supabase
        .from("upload_jobs")
        .update({
          status: "error",
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to record upload error:", error);
    }
  };

  // Process data through batched inserts
  const processBulkUpload = async (
    data: any[],
    fileName: string = "upload.csv"
  ): Promise<any> => {
    try {
      // Reset state - keep existing reset code
      state.value = {
        status: "preparing",
        progress: 0,
        error: null,
        totalBatches: 0,
        processedBatches: 0,
        processedRecords: 0,
      };

      // Transform data - keep existing transformation code
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

      // Process in batches for better performance
      const batchSize = 250; // Increased batch size for PostgreSQL function
      const batches = Math.ceil(transformedData.length / batchSize);
      state.value.totalBatches = batches;

      // Create an upload job in the database
      const jobId = await createUploadJob(fileName, batches);
      state.value.uploadJobId = jobId;
      state.value.status = "uploading";

      let processedRecords = 0;

      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, transformedData.length);
        const batchData = transformedData.slice(startIdx, endIdx);

        try {
          // Use the PostgreSQL function instead of direct upsert
          const { data: result, error } = await supabase.rpc(
            "bulk_upload_sites",
            {
              data: JSON.stringify(batchData),
            }
          );

          if (error) throw error;

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

      // Keep the existing completion code
      await completeUploadJob(jobId, processedRecords);

      state.value.status = "complete";
      state.value.progress = 100;

      return { success: true, processedRecords, jobId };
    } catch (error) {
      // Keep the existing error handling code
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

  const checkIncompleteUploads = async (fileName?: string): Promise<any[]> => {
    try {
      let query = supabase
        .from("upload_jobs")
        .select("*")
        .in("status", ["created", "uploading"])
        .order("created_at", { ascending: false });

      if (fileName) {
        query = query.eq("filename", fileName);
      }

      const { data, error } = await query.limit(5);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error checking incomplete uploads:", error);
      return [];
    }
  };

  // Get upload job details
  const getUploadJobDetails = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from("upload_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting upload job details:", error);
      throw error;
    }
  };

  // Resume an interrupted upload
  const resumeUpload = async (jobId: string, data: any[]): Promise<any> => {
    try {
      // Get the job details
      const job = await getUploadJobDetails(jobId);

      // Set state based on existing job
      state.value = {
        status: "uploading",
        progress: Math.round((job.chunks_received / job.total_chunks) * 100),
        error: null,
        totalBatches: job.total_chunks,
        processedBatches: job.chunks_received,
        processedRecords: job.processed_records,
        uploadJobId: jobId,
      };

      // Transform data to match database schema - same as before
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

      const batchSize = 250;
      const batches = Math.ceil(transformedData.length / batchSize);

      // Start from the last processed batch
      let processedRecords = job.processed_records;

      for (let i = job.chunks_received; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, transformedData.length);
        const batchData = transformedData.slice(startIdx, endIdx);

        try {
          const { data: result, error } = await supabase.rpc(
            "bulk_upload_sites",
            {
              data: JSON.stringify(batchData),
            }
          );

          if (error) throw error;

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
      // Transform data
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

      const batchSize = 250;
      const batches = Math.ceil(transformedData.length / batchSize);

      // Create job
      const { data: job, error } = await supabase
        .from("upload_jobs")
        .insert({
          filename: fileName,
          total_chunks: batches,
          status: "queued",
          chunks_received: 0,
          processed_records: 0,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!job?.id) throw new Error("Failed to create job");

      // Store data in localStorage BEFORE starting the job
      localStorage.setItem(
        `bg_upload_${job.id}`,
        JSON.stringify({
          transformedData,
          batchSize,
          batches,
          jobId: job.id,
          fileName,
        })
      );

      // Start processing after data is stored
      processBackgroundJob(job.id)
        .then((result) => console.log("Background job completed successfully"))
        .catch((e) => console.error("Background processing error:", e));

      return { jobId: job.id };
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

      // Update job status
      await supabase
        .from("upload_jobs")
        .update({ status: "processing" })
        .eq("id", jobId);

      let processedRecords = 0;

      const siteIdMap = new Map();
      transformedData.forEach((item: SiteInsert) => {
        siteIdMap.set(item.site_id, item);
      });
      const deduplicatedData = Array.from(siteIdMap.values());

      // Process each batch
      for (let i = 0; i < batches; i++) {
        const startIdx = i * batchSize;
        const endIdx = Math.min(startIdx + batchSize, transformedData.length);
        const batchData = transformedData.slice(startIdx, endIdx);

        try {
          const { data, error } = await supabase.rpc("process_sites_batch", {
            data: deduplicatedData,
          });

          if (error) {
            console.error("RPC error:", error);
            throw error;
          }

          processedRecords += batchData.length;

          // Update job progress
          await supabase
            .from("upload_jobs")
            .update({
              chunks_received: i + 1,
              processed_records: processedRecords,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
        } catch (error) {
          await recordUploadError(
            jobId,
            error instanceof Error ? error.message : String(error)
          );
          throw error;
        }
      }

      jobStatus.value[jobId] = "complete";

      // Complete the job
      await supabase
        .from("upload_jobs")
        .update({
          status: "complete",
          chunks_received: batches,
          processed_records: processedRecords,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      // Clean up local storage
      localStorage.removeItem(`bg_upload_${jobId}`);
      return { success: true, processedRecords };
    } catch (error) {
      console.error("Error in background processing:", error);

      jobStatus.value[jobId] = 'error';

      // Update job status to error
      await supabase
        .from("upload_jobs")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw error;
    }
  };

  // Get job status
  const getJobStatus = async (jobId: string) => {
    try {
      const { data, error } = await supabase
        .from("upload_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting job status:", error);
      throw error;
    }
  };

  return {
    processBulkUpload,
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
