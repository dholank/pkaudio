"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListMusic } from "lucide-react";
import { toast } from "sonner";
import { AudioSettingsCard } from "@/components/convert/audio-settings-card";
import { BatchSummaryCard } from "@/components/convert/batch-summary-card";
import { getUrlStats, SourceUrlsCard } from "@/components/convert/source-urls-card";
import { RobloxUploadCard } from "@/components/convert/roblox-upload-card";
import { JobCard } from "@/components/queue/job-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CredentialView } from "@/lib/credentials/types";
import { AUDIO_SAFETY_MODE_PRESETS, type AudioQuality, type AudioSafetyMode } from "@/lib/audio/options";
import { createBatchRequest } from "@/lib/jobs/client";
import type { JobView } from "@/lib/jobs/types";
import { createAudioPresetRequest } from "@/lib/presets/client";
import type { AudioPresetView } from "@/lib/presets/types";
import type { AppSettingsView } from "@/lib/settings/types";

const initialUrls = "";

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
  const defaultPreset = initialPresets.find((preset) => preset.isDefault) ?? null;
  const defaultCredentialExists = initialSettings.defaultCredentialId
    ? initialCredentials.some((credential) => credential.id === initialSettings.defaultCredentialId)
    : false;
  const presetCredentialExists = defaultPreset?.credentialId
    ? initialCredentials.some((credential) => credential.id === defaultPreset.credentialId)
    : false;

  const [urls, setUrls] = useState(initialUrls);
  const [presets, setPresets] = useState(initialPresets);
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset?.id ?? "none");
  const [presetName, setPresetName] = useState("Custom preset");
  const [savingPreset, setSavingPreset] = useState(false);
  const [speed, setSpeed] = useState(defaultPreset?.speed ?? initialSettings.defaultSpeed);
  const [amplifyDb, setAmplifyDb] = useState(defaultPreset?.amplifyDb ?? initialSettings.defaultAmplifyDb);
  const [targetLufs, setTargetLufs] = useState(defaultPreset?.targetLufs ?? initialSettings.defaultTargetLufs);
  const [quality, setQuality] = useState<AudioQuality>(defaultPreset?.quality ?? initialSettings.defaultQuality);
  const [audioSafetyMode, setAudioSafetyMode] = useState<AudioSafetyMode>(defaultPreset?.audioSafetyMode ?? initialSettings.defaultAudioSafetyMode);
  const [headroomDb, setHeadroomDb] = useState(defaultPreset?.headroomDb ?? initialSettings.defaultHeadroomDb);
  const [limiterEnabled, setLimiterEnabled] = useState(defaultPreset?.limiterEnabled ?? initialSettings.defaultLimiterEnabled);
  const [uploadEnabled, setUploadEnabled] = useState(defaultPreset?.uploadEnabled ?? initialSettings.defaultUploadEnabled);
  const [selectedCredential, setSelectedCredential] = useState(
    presetCredentialExists ? (defaultPreset?.credentialId ?? "") : defaultCredentialExists ? (initialSettings.defaultCredentialId ?? "") : (initialCredentials[0]?.id ?? ""),
  );
  const [assetNamePattern, setAssetNamePattern] = useState(defaultPreset?.assetNamePattern ?? initialSettings.defaultAssetNamePattern);
  const [recentJobs, setRecentJobs] = useState<JobView[]>(initialJobs);
  const [isStarting, setIsStarting] = useState(false);

  const stats = useMemo(() => getUrlStats(urls), [urls]);
  const canStart = stats.valid > 0 && (!uploadEnabled || Boolean(selectedCredential));

  function applyPreset(presetId: string) {
    setSelectedPresetId(presetId);
    if (presetId === "none") return;
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    setSpeed(preset.speed);
    setAmplifyDb(preset.amplifyDb);
    setTargetLufs(preset.targetLufs);
    setQuality(preset.quality);
    setAudioSafetyMode(preset.audioSafetyMode);
    setHeadroomDb(preset.headroomDb);
    setLimiterEnabled(preset.limiterEnabled);
    setUploadEnabled(preset.uploadEnabled);
    setSelectedCredential(preset.credentialId && initialCredentials.some((credential) => credential.id === preset.credentialId) ? preset.credentialId : (initialCredentials[0]?.id ?? ""));
    setAssetNamePattern(preset.assetNamePattern);
    toast.success(`Applied preset: ${preset.name}.`);
  }

  async function saveCurrentAsPreset() {
    if (!presetName.trim()) {
      toast.error("Preset name is required.");
      return;
    }
    setSavingPreset(true);
    try {
      const result = await createAudioPresetRequest({
        name: presetName,
        description: "Saved from Convert page.",
        speed,
        amplifyDb,
        targetLufs,
        quality,
        audioSafetyMode,
        headroomDb,
        limiterEnabled,
        uploadEnabled,
        credentialId: uploadEnabled && selectedCredential ? selectedCredential : null,
        assetNamePattern,
        isDefault: false,
      });
      setPresets((current) => [result.preset, ...current]);
      setSelectedPresetId(result.preset.id);
      toast.success(`Preset saved: ${result.preset.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preset.");
    } finally {
      setSavingPreset(false);
    }
  }

  function handleSafetyModeChange(mode: AudioSafetyMode) {
    setAudioSafetyMode(mode);
    if (mode === "custom") return;
    const preset = AUDIO_SAFETY_MODE_PRESETS[mode];
    setQuality(preset.quality);
    setLimiterEnabled(preset.limiterEnabled);
    setHeadroomDb(preset.headroomDb);
    setTargetLufs(preset.targetLufs);
    if (preset.amplifyDb !== undefined) setAmplifyDb(preset.amplifyDb);
  }

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
        speed,
        amplifyDb,
        targetLufs,
        quality,
        audioSafetyMode,
        headroomDb,
        limiterEnabled,
        uploadEnabled,
        credentialId: uploadEnabled ? selectedCredential : null,
        assetNamePattern,
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
      <Card>
        <CardHeader>
          <CardTitle>Audio Preset</CardTitle>
          <CardDescription>Apply saved presets or save the current Convert controls as a reusable preset.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(220px,0.7fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Preset</Label>
            <Select value={selectedPresetId} onValueChange={applyPreset}>
              <SelectTrigger><SelectValue placeholder="Select preset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Custom current settings</SelectItem>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>{preset.name}{preset.isDefault ? " — default" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Save as</Label>
            <Input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Fast SFX" />
          </div>
          <Button variant="outline" onClick={() => void saveCurrentAsPreset()} disabled={savingPreset}>
            {savingPreset ? "Saving..." : "Save current preset"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.8fr)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(480px,0.8fr)]">
        <SourceUrlsCard urls={urls} onChange={setUrls} />
        <AudioSettingsCard
          speed={speed}
          amplifyDb={amplifyDb}
          targetLufs={targetLufs}
          quality={quality}
          audioSafetyMode={audioSafetyMode}
          headroomDb={headroomDb}
          limiterEnabled={limiterEnabled}
          onSpeedChange={setSpeed}
          onAmplifyChange={(value) => { setAmplifyDb(value); setAudioSafetyMode("custom"); }}
          onTargetLufsChange={(value) => { setTargetLufs(value); setAudioSafetyMode("custom"); }}
          onQualityChange={(value) => { setQuality(value); setAudioSafetyMode("custom"); }}
          onAudioSafetyModeChange={handleSafetyModeChange}
          onHeadroomChange={(value) => { setHeadroomDb(value); setAudioSafetyMode("custom"); }}
          onLimiterChange={(value) => { setLimiterEnabled(value); setAudioSafetyMode("custom"); }}
        />
      </div>

      <RobloxUploadCard
        credentials={initialCredentials}
        selectedCredential={selectedCredential}
        uploadEnabled={uploadEnabled}
        assetNamePattern={assetNamePattern}
        onCredentialChange={setSelectedCredential}
        onUploadEnabledChange={setUploadEnabled}
        onAssetNamePatternChange={setAssetNamePattern}
      />

      <BatchSummaryCard
        validUrls={stats.valid}
        speed={speed}
        amplifyDb={amplifyDb}
        targetLufs={targetLufs}
        quality={quality}
        audioSafetyMode={audioSafetyMode}
        headroomDb={headroomDb}
        limiterEnabled={limiterEnabled}
        uploadEnabled={uploadEnabled}
        canStart={canStart}
        isStarting={isStarting}
        onStart={handleStartBatch}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Recent Queue</CardTitle>
            <CardDescription>Real queued jobs are stored in SQLite. Run <span className="font-mono text-zinc-300">npm run worker</span> to convert OGG files and auto-upload enabled jobs to Roblox.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/queue">View all</Link></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentJobs.length ? recentJobs.slice(0, 5).map((job) => <JobCard key={job.id} job={job} compact />) : (
            <EmptyState icon={ListMusic} title="No active jobs" description="Paste a YouTube or SoundCloud URL to start converting audio for Roblox." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
