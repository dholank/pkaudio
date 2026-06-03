import { Database } from "lucide-react";
import { AudioPresetsCard } from "@/components/settings/audio-presets-card";
import { BackupRestoreCard } from "@/components/settings/backup-restore-card";
import { FinalQaCard } from "@/components/settings/final-qa-card";
import { SettingsDefaultsCard } from "@/components/settings/settings-defaults-card";
import { StorageCleanupCard } from "@/components/settings/storage-cleanup-card";
import { SystemStatusCard } from "@/components/settings/system-status-card";
import { WorkerHealthCard } from "@/components/settings/worker-health-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listBackups } from "@/lib/backup/local";
import { listCredentials } from "@/lib/credentials/repository";
import { listAudioPresets } from "@/lib/presets/repository";
import { getSettings } from "@/lib/settings/repository";
import { getLocalDoctorReport } from "@/lib/system/doctor";
import { getStorageStats } from "@/lib/storage/local";
import { getWorkerHealthStatus } from "@/lib/worker/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SettingsPage() {
  const [storage, settings, credentials, workerStatus, presets, backups, doctorReport] = await Promise.all([getStorageStats(), getSettings(), listCredentials(), getWorkerHealthStatus(), listAudioPresets(), listBackups(), getLocalDoctorReport()]);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SettingsDefaultsCard initialSettings={settings} credentials={credentials} />

      <AudioPresetsCard initialPresets={presets} credentials={credentials} />

      <SystemStatusCard />

      <WorkerHealthCard initialStatus={workerStatus} />

      <StorageCleanupCard initialStorage={storage} initialTarget={settings.cleanupTarget} initialRetention={settings.cleanupRetention} />

      <BackupRestoreCard initialBackups={backups} />

      <FinalQaCard initialReport={doctorReport} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="size-4 text-violet-300" /> Advanced Notes</CardTitle>
          <CardDescription>Current persistence and worker behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-zinc-400">
          <p>
            Settings are stored in SQLite table <span className="font-mono text-zinc-200">settings</span> and loaded by Convert on each page request.
          </p>
          <p>
            Max concurrent jobs and retry count are now consumed directly by the worker daemon on every tick, and visible in Worker Health.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
