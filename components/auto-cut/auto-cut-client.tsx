"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { History, Link2, ListMusic } from "lucide-react";
import { toast } from "sonner";
import { AutoCutCard } from "@/components/convert/auto-cut-card";
import { AudioSettingsCard } from "@/components/convert/audio-settings-card";
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
import { analyzeAutoCutRequest, createTrimBatchRequest } from "@/lib/jobs/client";
import type { JobView } from "@/lib/jobs/types";
import { createAudioPresetRequest } from "@/lib/presets/client";
import type { AudioPresetView } from "@/lib/presets/types";
import type { AppSettingsView } from "@/lib/settings/types";
import type { AutoCutPreview } from "@/lib/trim/preview";

function isValidSingleUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (!(lower.startsWith("file://") || lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("soundcloud.com"))) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}

export function AutoCutClient({
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
  const defaultPreset = initialPresets.find((p) => p.isDefault) ?? null;
  const defaultCredentialExists = initialSettings.defaultCredentialId
    ? initialCredentials.some((c) => c.id === initialSettings.defaultCredentialId)
    : false;
  const presetCredentialExists = defaultPreset?.credentialId
    ? initialCredentials.some((c) => c.id === defaultPreset.credentialId)
    : false;

  const [url, setUrl] = useState("");
  const [presets, setPresets] = useState(initialPresets);
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset?.id ?? "none");
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

  const [autoCutPreview, setAutoCutPreview] = useState<AutoCutPreview | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);

  const validUrl = useMemo(() => isValidSingleUrl(url), [url]);
  const hasValidUrl = validUrl !== null;
  const canQueueAutoCut = Boolean(autoCutPreview) && (!uploadEnabled || Boolean(selectedCredential));

  function currentBatchSettings() {
    return {
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
    };
  }

  function applyPreset(presetId: string) {
    setSelectedPresetId(presetId);
    if (presetId === "none") return;
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setSpeed(preset.speed);
    setAmplifyDb(preset.amplifyDb);
    setTargetLufs(preset.targetLufs);
    setQuality(preset.quality);
    setAudioSafetyMode(preset.audioSafetyMode);
    setHeadroomDb(preset.headroomDb);
    setLimiterEnabled(preset.limiterEnabled);
    setUploadEnabled(preset.uploadEnabled);
    setSelectedCredential(preset.credentialId && initialCredentials.some((c) => c.id === preset.credentialId) ? preset.credentialId : (initialCredentials[0]?.id ?? ""));
    setAssetNamePattern(preset.assetNamePattern);
    toast.success(`Applied preset: ${preset.name}.`);
  }

  async function saveCurrentAsPreset() {
    const name = window.prompt("Preset name:", "Auto Cut preset");
    if (!name?.trim()) return;
    try {
      const result = await createAudioPresetRequest({
        name: name.trim(),
        description: "Saved from Auto Cut page.",
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
      setPresets((c) => [result.preset, ...c]);
      setSelectedPresetId(result.preset.id);
      toast.success(`Preset saved: ${result.preset.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preset.");
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

  async function handleAnalyze() {
    if (!validUrl) return;
    setIsAnalyzing(true);
    setAutoCutPreview(null);
    try {
      const result = await analyzeAutoCutRequest({ url: validUrl });
      setAutoCutPreview(result.preview);
      toast.success(`Auto Cut preview ready: ${result.preview.parts.length} part${result.preview.parts.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze and cut source.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConvert() {
    if (!autoCutPreview) return;
    if (uploadEnabled && !selectedCredential) {
      toast.error("Select a Roblox credential before queueing auto-upload parts.");
      return;
    }
    setIsQueueing(true);
    try {
      const result = await createTrimBatchRequest({
        previewId: autoCutPreview.previewId,
        ...currentBatchSettings(),
      });
      setRecentJobs((c) => [...result.jobs, ...c].slice(0, 5));
      toast.success(`Trim batch queued with ${result.jobs.length} part${result.jobs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue auto-cut parts.");
    } finally {
      setIsQueueing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Preset */}
      <Card>
        <CardHeader>
          <CardTitle>Audio Preset</CardTitle>
          <CardDescription>Apply a saved preset or save current settings as a reusable preset.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] space-y-2">
            <Label>Preset</Label>
            <Select value={selectedPresetId} onValueChange={applyPreset}>
              <SelectTrigger><SelectValue placeholder="Select preset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Custom current settings</SelectItem>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.isDefault ? " — default" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => void saveCurrentAsPreset()}>Save preset</Button>
        </CardContent>
      </Card>

      {/* Source URL */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-4 text-violet-300" /> Source URL
            </CardTitle>
            <CardDescription>One YouTube/SoundCloud URL. Audio over 5 min is split into 5-minute parts automatically.</CardDescription>
          </div>
          {url.trim() ? (
            <div className="rounded-full border px-3 py-1 text-xs">
              {hasValidUrl ? (
                <span className="text-emerald-200">1 valid URL</span>
              ) : (
                <span className="text-rose-200">Unsupported URL</span>
              )}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://soundcloud.com/..."
            className="font-mono"
          />
        </CardContent>
      </Card>

      {/* Audio Settings + Roblox Upload */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,0.8fr)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(480px,0.8fr)]">
        <AudioSettingsCard
          speed={speed}
          amplifyDb={amplifyDb}
          targetLufs={targetLufs}
          quality={quality}
          audioSafetyMode={audioSafetyMode}
          headroomDb={headroomDb}
          limiterEnabled={limiterEnabled}
          onSpeedChange={setSpeed}
          onAmplifyChange={(v) => { setAmplifyDb(v); setAudioSafetyMode("custom"); }}
          onTargetLufsChange={(v) => { setTargetLufs(v); setAudioSafetyMode("custom"); }}
          onQualityChange={(v) => { setQuality(v); setAudioSafetyMode("custom"); }}
          onAudioSafetyModeChange={handleSafetyModeChange}
          onHeadroomChange={(v) => { setHeadroomDb(v); setAudioSafetyMode("custom"); }}
          onLimiterChange={(v) => { setLimiterEnabled(v); setAudioSafetyMode("custom"); }}
        />
        <RobloxUploadCard
          credentials={initialCredentials}
          selectedCredential={selectedCredential}
          uploadEnabled={uploadEnabled}
          assetNamePattern={assetNamePattern}
          onCredentialChange={setSelectedCredential}
          onUploadEnabledChange={setUploadEnabled}
          onAssetNamePatternChange={setAssetNamePattern}
        />
      </div>

      {/* Auto Cut Card */}
      <AutoCutCard
        validUrlCount={hasValidUrl ? 1 : 0}
        preview={autoCutPreview}
        analyzing={isAnalyzing}
        converting={isQueueing}
        canConvert={canQueueAutoCut}
        onAnalyze={() => void handleAnalyze()}
        onConvert={() => void handleConvert()}
      />

      {/* Recent Queue */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Recent Queue</CardTitle>
            <CardDescription>Parts queue as normal jobs. Run <span className="font-mono text-zinc-300">npm run worker</span> to convert & upload.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/queue">View all</Link></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentJobs.length ? recentJobs.slice(0, 5).map((job) => <JobCard key={job.id} job={job} compact />) : (
            <EmptyState icon={ListMusic} title="No trim jobs yet" description="Paste a YouTube URL, analyze & cut, then convert parts to start." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
