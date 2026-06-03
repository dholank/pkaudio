import type { BatchView, JobLogView, JobView } from "@/lib/jobs/types";
import type { AudioQuality, AudioSafetyMode } from "@/lib/audio/options";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export async function createBatchRequest(input: {
  urls: string[];
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
}) {
  return parseResponse<{ batch: BatchView; jobs: JobView[] }>(
    await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchJobs(params: { status?: string; q?: string; batchId?: string; platform?: string; credentialId?: string; upload?: string; moderation?: string; dateRange?: string; sort?: string; limit?: string } = {}) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return parseResponse<{ jobs: JobView[]; stats: Record<string, number> }>(
    await fetch(`/api/jobs${suffix}`, { cache: "no-store" }),
  );
}

export async function cancelJobRequest(id: string) {
  return parseResponse<{ job: JobView }>(await fetch(`/api/jobs/${id}/cancel`, { method: "POST" }));
}

export async function retryJobRequest(id: string) {
  return parseResponse<{ job: JobView }>(await fetch(`/api/jobs/${id}/retry`, { method: "POST" }));
}

export async function deleteJobRequest(id: string, options: { deleteArtifacts?: boolean } = {}) {
  const searchParams = new URLSearchParams();
  if (options.deleteArtifacts === false) searchParams.set("deleteArtifacts", "false");
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return parseResponse<{ deleted: boolean; result: unknown }>(await fetch(`/api/jobs/${id}${suffix}`, { method: "DELETE" }));
}

export async function fetchJobLogs(id: string) {
  return parseResponse<{ job: JobView; logs: JobLogView[] }>(
    await fetch(`/api/jobs/${id}/logs`, { cache: "no-store" }),
  );
}

export async function auditRobloxJobRequest(id: string) {
  return parseResponse<{ job: JobView; audit: unknown }>(await fetch(`/api/jobs/${id}/roblox-status`, { method: "POST" }));
}

export async function checkRobloxModerationRequest(id: string) {
  return parseResponse<{ job: JobView; audit: unknown }>(await fetch(`/api/jobs/${id}/roblox-moderation`, { method: "POST" }));
}
