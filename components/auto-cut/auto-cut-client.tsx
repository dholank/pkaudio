"use client";

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { AutoCutCard } from "@/components/convert/auto-cut-card";
import { AudioSettingsCard } from "@/components/convert/audio-settings-card";
import { PresetToolbar } from "@/components/convert/preset-toolbar";
import { RecentQueueCard } from "@/components/convert/recent-queue-card";
import { RobloxUploadCard } from "@/components/convert/roblox-upload-card";
import { useBatchAudioSettings } from "@/hooks/use-batch-audio-settings";
import { analyzeAutoCutRequest, createTrimBatchRequest } from "@/lib/jobs/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CredentialView } from "@/lib/credentials/types";
import type { JobView } from "@/lib/jobs/types";
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
  const [url, setUrl] = useState("");
  const [recentJobs, setRecentJobs] = useState<JobView[]>(initialJobs);
  const [autoCutPreview, setAutoCutPreview] = useState<AutoCutPreview | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);

  const b = useBatchAudioSettings({
    initialSettings,
    initialPresets,
    initialCredentials,
    defaultPresetName: "Auto Cut preset",
    saveDescription: "Saved from Auto Cut page.",
  });

  const validUrl = useMemo(() => isValidSingleUrl(url), [url]);
  const hasValidUrl = validUrl !== null;
  const canQueueAutoCut = Boolean(autoCutPreview) && (!b.uploadEnabled || Boolean(b.selectedCredential));

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
    if (b.uploadEnabled && !b.selectedCredential) {
      toast.error("Select a Roblox credential before queueing auto-upload parts.");
      return;
    }
    setIsQueueing(true);
    try {
      const result = await createTrimBatchRequest({
        previewId: autoCutPreview.previewId,
        ...b.batchPayload,
      });
      setRecentJobs((current) => [...result.jobs, ...current].slice(0, 5));
      toast.success(`Trim batch queued with ${result.jobs.length} part${result.jobs.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue auto-cut parts.");
    } finally {
      setIsQueueing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PresetToolbar settings={b} />

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
        <RobloxUploadCard
          credentials={initialCredentials}
          selectedCredential={b.selectedCredential}
          uploadEnabled={b.uploadEnabled}
          assetNamePattern={b.assetNamePattern}
          onCredentialChange={b.setSelectedCredential}
          onUploadEnabledChange={b.setUploadEnabled}
          onAssetNamePatternChange={b.setAssetNamePattern}
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

      <RecentQueueCard
        jobs={recentJobs}
        workerHint='Parts queue as normal jobs. Run <span class="font-mono text-zinc-300">npm run worker</span> to convert & upload.'
        emptyTitle="No trim jobs yet"
        emptyDescription="Paste a YouTube URL, analyze & cut, then convert parts to start."
      />
    </div>
  );
}
