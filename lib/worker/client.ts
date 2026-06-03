import type { WorkerHealthStatus } from "@/lib/worker/health";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export async function fetchWorkerStatus() {
  return parseResponse<WorkerHealthStatus>(await fetch("/api/worker/status", { cache: "no-store" }));
}
