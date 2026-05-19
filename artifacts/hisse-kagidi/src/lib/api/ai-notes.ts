import { apiFetch } from "./core";

export interface AiDonationInput {
  id: string;
  name: string;
  donationType: string;
  vekalet: string;
  notes: string;
}

export interface AiClassificationResult {
  donationId: string;
  categories: string[];
  confidence?: number | null;
  requests: string;
  warnings: string;
  summary: string;
}

export interface AiSettings {
  prompt: string;
  categories: string[];
}

export interface AiJobStatus {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  totalDonations: number;
  processedDonations: number;
  results?: AiClassificationResult[];
  failedBatchCount?: number;
  totalBatches?: number;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchAiSettings(): Promise<AiSettings> {
  return apiFetch<AiSettings>("/ai-notes/settings");
}

export async function saveAiSettings(settings: Partial<AiSettings>): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ai-notes/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

const AI_CHUNK_SIZE = 5000;

export async function classifyNotesAsync(
  donations: AiDonationInput[],
  kesimAlaniId?: string,
  batchSize?: number,
): Promise<{ jobId: string; status: string; totalDonations: number }> {
  return apiFetch<{ jobId: string; status: string; totalDonations: number }>("/ai-notes/classify-async", {
    method: "POST",
    body: JSON.stringify({ donations, kesimAlaniId, ...(batchSize ? { batchSize } : {}) }),
  });
}

export class PartialChunkError extends Error {
  jobIds: string[];
  totalDonations: number;
  totalChunks: number;
  failedChunk: number;
  constructor(jobIds: string[], totalDonations: number, totalChunks: number, failedChunk: number, cause: unknown) {
    super(`${failedChunk + 1}/${totalChunks} parçada hata oluştu, ${jobIds.length} parça başarılı`);
    this.name = "PartialChunkError";
    this.jobIds = jobIds;
    this.totalDonations = totalDonations;
    this.totalChunks = totalChunks;
    this.failedChunk = failedChunk;
    this.cause = cause;
  }
}

export async function classifyNotesAsyncChunked(
  donations: AiDonationInput[],
  kesimAlaniId?: string,
  batchSize?: number,
): Promise<{ jobIds: string[]; totalDonations: number }> {
  if (donations.length <= AI_CHUNK_SIZE) {
    const result = await classifyNotesAsync(donations, kesimAlaniId, batchSize);
    return { jobIds: [result.jobId], totalDonations: result.totalDonations };
  }

  const jobIds: string[] = [];
  let totalDonations = 0;
  const totalChunks = Math.ceil(donations.length / AI_CHUNK_SIZE);
  for (let i = 0; i < donations.length; i += AI_CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / AI_CHUNK_SIZE);
    const chunk = donations.slice(i, i + AI_CHUNK_SIZE);
    try {
      const result = await classifyNotesAsync(chunk, kesimAlaniId, batchSize);
      jobIds.push(result.jobId);
      totalDonations += result.totalDonations;
    } catch (err) {
      if (jobIds.length > 0) {
        throw new PartialChunkError(jobIds, totalDonations, totalChunks, chunkIndex, err);
      }
      throw err;
    }
  }
  return { jobIds, totalDonations };
}

export async function fetchJobStatus(jobId: string): Promise<AiJobStatus> {
  return apiFetch<AiJobStatus>(`/ai-notes/jobs/${jobId}`);
}

export async function cancelJob(jobId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/ai-notes/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

export async function fetchActiveJob(kesimAlaniId: string): Promise<{ job: AiJobStatus | null }> {
  return apiFetch<{ job: AiJobStatus | null }>(`/ai-notes/active-job?kesimAlaniId=${encodeURIComponent(kesimAlaniId)}`);
}

export async function saveAiClassifications(
  classifications: { donationId: string; categories: string[]; warnings: string; requests?: string; summary?: string }[],
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/ai-notes/save-classifications", {
    method: "PUT",
    body: JSON.stringify({ classifications }),
  });
}

export async function bulkUpdateNotes(kesimAlaniId: string, updates: { donationId: string; notes?: string; description?: string }[]): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/ai-notes/bulk-update", {
    method: "PUT",
    body: JSON.stringify({ kesimAlaniId, updates }),
  });
}

export interface AiJobLog {
  id: string;
  jobId: string | null;
  kesimAlaniId: string | null;
  projectId: string | null;
  donationCount: number;
  processedCount: number;
  warningCount: number;
  errorBatchCount: number;
  totalBatches: number;
  durationMs: number | null;
  avgConfidenceScore: number | null;
  categoryDistribution: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string;
}

export async function fetchAiJobLogs(projectId: string, limit = 50): Promise<{ logs: AiJobLog[] }> {
  return apiFetch<{ logs: AiJobLog[] }>(`/ai-notes/job-logs?projectId=${encodeURIComponent(projectId)}&limit=${limit}`);
}
