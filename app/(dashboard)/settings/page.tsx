import { SettingsPageClient } from "@/components/settings/settings-page-client";
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
  const [storageStats, settings, credentials, workerStatus, presets, backups, doctorReport] = await Promise.all([
    getStorageStats(),
    getSettings(),
    listCredentials(),
    getWorkerHealthStatus(),
    listAudioPresets(),
    listBackups(),
    getLocalDoctorReport(),
  ]);

  return (
    <SettingsPageClient
      settings={settings}
      credentials={credentials}
      workerStatus={workerStatus}
      presets={presets}
      backups={backups}
      storageStats={storageStats}
      doctorReport={doctorReport}
    />
  );
}
