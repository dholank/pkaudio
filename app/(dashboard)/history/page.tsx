import { HistoryClient } from "@/components/history/history-client";
import { listCredentials } from "@/lib/credentials/repository";
import { listJobs } from "@/lib/jobs/repository";
import { listJobsQuerySchema } from "@/lib/jobs/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function flattenSearchParams(params: Record<string, string | string[] | undefined>) {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) output[key] = value[0] ?? "";
    else if (value !== undefined) output[key] = value;
  }
  return output;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const rawParams = searchParams ? await searchParams : {};
  const flatParams = flattenSearchParams(rawParams);
  const parsed = listJobsQuerySchema.safeParse({ ...flatParams, limit: flatParams.limit ?? "300" });
  const filters = parsed.success ? parsed.data : { limit: 300 };
  const [jobs, credentials] = await Promise.all([listJobs(filters), listCredentials()]);

  return <HistoryClient jobs={jobs} credentials={credentials} />;
}
