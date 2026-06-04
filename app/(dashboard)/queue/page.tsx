import { QueueClient } from "@/components/queue/queue-client";
import { listCredentials } from "@/lib/credentials/repository";
import { listLatestBatchJobs } from "@/lib/jobs/repository";
import { getWorkerHealthStatus } from "@/lib/worker/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function QueuePage() {
  const [latestQueue, credentials, workerStatus] = await Promise.all([listLatestBatchJobs({ limit: 200 }), listCredentials(), getWorkerHealthStatus()]);
  return <QueueClient initialJobs={latestQueue.jobs} latestBatch={latestQueue.batch} credentials={credentials} initialWorkerStatus={workerStatus} />;
}
