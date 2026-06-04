import { AutoCutClient } from "@/components/auto-cut/auto-cut-client";
import { listCredentials } from "@/lib/credentials/repository";
import { listJobs } from "@/lib/jobs/repository";
import { listAudioPresets } from "@/lib/presets/repository";
import { getSettings } from "@/lib/settings/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AutoCutPage() {
  const [credentials, jobs, settings, presets] = await Promise.all([listCredentials(), listJobs({ limit: 5 }), getSettings(), listAudioPresets()]);
  return <AutoCutClient initialCredentials={credentials} initialJobs={jobs} initialSettings={settings} initialPresets={presets} />;
}
