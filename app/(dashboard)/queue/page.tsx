import { QueueClient } from "@/components/queue/queue-client";
import { listCredentials } from "@/lib/credentials/repository";
import { listJobs } from "@/lib/jobs/repository";
import { getWorkerHealthStatus } from "@/lib/worker/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QueuePage() {
  const [jobs, credentials, workerStatus] = await Promise.all([listJobs({ limit: 200 }), listCredentials(), getWorkerHealthStatus()]);
  return <QueueClient initialJobs={jobs} credentials={credentials} initialWorkerStatus={workerStatus} />;
}
