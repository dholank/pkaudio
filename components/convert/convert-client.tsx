"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AudioSettingsCard } from "@/components/convert/audio-settings-card";
import { BatchSummaryCard } from "@/components/convert/batch-summary-card";
import { getUrlStats, SourceUrlsCard } from "@/components/convert/source-urls-card";
import { PresetToolbar } from "@/components/convert/preset-toolbar";
import { RecentQueueCard } from "@/components/convert/recent-queue-card";
import { RobloxUploadCard } from "@/components/convert/roblox-upload-card";
import { useBatchAudioSettings } from "@/hooks/use-batch-audio-settings";
import { createBatchRequest } from "@/lib/jobs/client";
import type { JobView } from "@/lib/jobs/types";
import type { AudioPresetView } from "@/lib/presets/types";
import type { AppSettingsView } from "@/lib/settings/types";
import type { CredentialView } from "@/lib/credentials/types";

function parseSupportedUrls(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      return lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("soundcloud.com");
    })
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function ConvertClient({
  initialCredentials,
  initialJobs,
  initialSettings,
  initialPresets,
}: {
  initialCredentials: CredentialView[];
  initialJobs: JobView[];
  initialSettings: AppSettingsView;
  initialPresets: AudioPresetView[];
}) {
  const [urls, setUrls] = useState("");
  const [recentJobs, setRecentJobs] = useState<JobView[]>(initialJobs);
  const [isStarting, setIsStarting] = useState(false);

  const b = useBatchAudioSettings({
    initialSettings,
    initialPresets,
    initialCredentials,
    defaultPresetName: "Custom preset",
    saveDescription: "Saved from Convert page.",
  });

  const stats = useMemo(() => getUrlStats(urls), [urls]);
  const canStart = stats.valid > 0 && (!b.uploadEnabled || Boolean(b.selectedCredential));

  async function handleStartBatch() {
    const supportedUrls = parseSupportedUrls(urls);
    if (!supportedUrls.length) {
      toast.error("Add at least one supported YouTube or SoundCloud URL.");
      return;
    }

    setIsStarting(true);
    try {
      const result = await createBatchRequest({
        urls: supportedUrls,
        ...b.batchPayload,
      });
      setRecentJobs((current) => [...result.jobs, ...current].slice(0, 5));
      toast.success(`Batch queued with ${result.jobs.length} job${result.jobs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start batch.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PresetToolbar settings={b} showNameInput />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.8fr)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(480px,0.8fr)]">
        <SourceUrlsCard urls={urls} onChange={setUrls} />
        <AudioSettingsCard
          speed={b.speed}
          amplifyDb={b.amplifyDb}
          targetLufs={b.targetLufs}
          quality={b.quality}
          audioSafetyMode={b.audioSafetyMode}
          headroomDb={b.headroomDb}
          limiterEnabled={b.limiterEnabled}
          onSpeedChange={b.setSpeed}
          onAmplifyChange={(v) => { b.setAmplifyDb(v); b.setAudioSafetyMode("custom"); }}
          onTargetLufsChange={(v) => { b.setTargetLufs(v); b.setAudioSafetyMode("custom"); }}
          onQualityChange={(v) => { b.setQuality(v); b.setAudioSafetyMode("custom"); }}
          onAudioSafetyModeChange={b.handleSafetyModeChange}
          onHeadroomChange={(v) => { b.setHeadroomDb(v); b.setAudioSafetyMode("custom"); }}
          onLimiterChange={(v) => { b.setLimiterEnabled(v); b.setAudioSafetyMode("custom"); }}
        />
      </div>

      <RobloxUploadCard
        credentials={initialCredentials}
        selectedCredential={b.selectedCredential}
        uploadEnabled={b.uploadEnabled}
        assetNamePattern={b.assetNamePattern}
        onCredentialChange={b.setSelectedCredential}
        onUploadEnabledChange={b.setUploadEnabled}
        onAssetNamePatternChange={b.setAssetNamePattern}
      />

      <BatchSummaryCard
        validUrls={stats.valid}
        speed={b.speed}
        amplifyDb={b.amplifyDb}
        targetLufs={b.targetLufs}
        quality={b.quality}
        audioSafetyMode={b.audioSafetyMode}
        headroomDb={b.headroomDb}
        limiterEnabled={b.limiterEnabled}
        uploadEnabled={b.uploadEnabled}
        canStart={canStart}
        isStarting={isStarting}
        onStart={handleStartBatch}
      />

      <RecentQueueCard
        jobs={recentJobs}
        workerHint={<>Run <span className="font-mono text-zinc-300">npm run worker</span> to convert & auto-upload.</>}
        emptyTitle="No active jobs"
        emptyDescription="Paste a YouTube or SoundCloud URL to start converting audio for Roblox."
      />
    </div>
  );
}
