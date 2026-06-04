import { getJson, postJson, deleteJson } from "@/lib/api/client";
import type { BatchView, JobLogView, JobView } from "@/lib/jobs/types";
import type { AudioQuality, AudioSafetyMode } from "@/lib/audio/options";
import type { AutoCutPreview } from "@/lib/trim/preview";

export type BatchSettingsRequestInput = {
  speed: number;
  amplifyDb: number;
  targetLufs: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  credentialId?: string | null;
  assetNamePattern: string;
};

export async function createBatchRequest(input: BatchSettingsRequestInput & { urls: string[] }) {
  return postJson<{ batch: BatchView; jobs: JobView[] }>("/api/batches", input);
}

export async function analyzeAutoCutRequest(input: { url: string }) {
  return postJson<{ preview: AutoCutPreview }>("/api/trim/analyze", input);
}

export async function createTrimBatchRequest(input: BatchSettingsRequestInput & { previewId: string }) {
  return postJson<{ batch: BatchView; jobs: JobView[]; preview: AutoCutPreview }>("/api/trim/batches", input);
}

export async function fetchJobs(params: {
  status?: string; q?: string; batchId?: string; scope?: string;
  platform?: string; credentialId?: string; upload?: string;
  moderation?: string; dateRange?: string; sort?: string; limit?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return getJson<{ jobs: JobView[]; batch?: BatchView | null; stats: Record<string, number> }>(
    `/api/jobs${suffix}`,
  );
}

export async function cancelJobRequest(id: string) {
  return postJson<{ job: JobView }>(`/api/jobs/${id}/cancel`);
}

export async function retryJobRequest(id: string) {
  return postJson<{ job: JobView }>(`/api/jobs/${id}/retry`);
}

export async function deleteJobRequest(id: string, options: { deleteArtifacts?: boolean } = {}) {
  const searchParams = new URLSearchParams();
  if (options.deleteArtifacts === false) searchParams.set("deleteArtifacts", "false");
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return deleteJson<{ deleted: boolean; result: unknown }>(`/api/jobs/${id}${suffix}`);
}

export async function fetchJobLogs(id: string) {
  return getJson<{ job: JobView; logs: JobLogView[] }>(`/api/jobs/${id}/logs`);
}

export async function auditRobloxJobRequest(id: string) {
  return postJson<{ job: JobView; audit: unknown }>(`/api/jobs/${id}/roblox-status`);
}

export async function checkRobloxModerationRequest(id: string) {
  return postJson<{ job: JobView; audit: unknown }>(`/api/jobs/${id}/roblox-moderation`);
}
