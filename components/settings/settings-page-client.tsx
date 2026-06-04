"use client";

import { useState } from "react";
import { SettingsDefaultsCard } from "@/components/settings/settings-defaults-card";
import { AudioPresetsCard } from "@/components/settings/audio-presets-card";
import { WorkerHealthCard } from "@/components/settings/worker-health-card";
import { StorageCleanupCard } from "@/components/settings/storage-cleanup-card";
import { BackupRestoreCard } from "@/components/settings/backup-restore-card";
import { FinalQaCard } from "@/components/settings/final-qa-card";
import { TabNav, tabs } from "@/components/settings/settings-tabs";
import type { AppSettingsView, CleanupRetention, CleanupTarget } from "@/lib/settings/types";
import type { CredentialView } from "@/lib/credentials/types";
import type { AudioPresetView } from "@/lib/presets/types";
import type { WorkerHealthStatus } from "@/lib/worker/health";
import type { BackupSummary } from "@/lib/backup/local";
import type { DirectoryStats } from "@/lib/storage/local";
import type { DoctorReport } from "@/lib/system/doctor";

export function SettingsPageClient({
  settings,
  credentials,
  workerStatus,
  presets,
  backups,
  storageStats,
  doctorReport,
}: {
  settings: AppSettingsView;
  credentials: CredentialView[];
  workerStatus: WorkerHealthStatus;
  presets: AudioPresetView[];
  backups: BackupSummary[];
  storageStats: { outputs: DirectoryStats; temp: DirectoryStats };
  doctorReport: DoctorReport;
}) {
  const [activeTab, setActiveTab] = useState("audio");

  return (
    <div className="space-y-6">
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "audio" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <SettingsDefaultsCard initialSettings={settings} credentials={credentials} />
          <StorageCleanupCard
            initialStorage={storageStats}
            initialTarget={settings.cleanupTarget}
            initialRetention={settings.cleanupRetention}
          />
        </div>
      )}

      {activeTab === "presets" && (
        <AudioPresetsCard initialPresets={presets} credentials={credentials} />
      )}

      {activeTab === "worker" && (
        <WorkerHealthCard initialStatus={workerStatus} />
      )}

      {activeTab === "backup" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <BackupRestoreCard initialBackups={backups} />
        </div>
      )}

      {activeTab === "qa" && (
        <FinalQaCard initialReport={doctorReport} />
      )}
    </div>
  );
}
