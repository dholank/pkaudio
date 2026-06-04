"use client";

import { useState } from "react";
import { RotateCcw, Save, Settings2, ShieldCheck } from "lucide-react";
import { patchJson, postJson } from "@/lib/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AUDIO_QUALITIES,
  AUDIO_SAFETY_MODE_LABELS,
  AUDIO_SAFETY_MODE_PRESETS,
  AUDIO_SAFETY_MODES,
  MAX_HEADROOM_DB,
  MAX_TARGET_LUFS,
  MIN_HEADROOM_DB,
  MIN_TARGET_LUFS,
  QUALITY_LABELS,
  formatHeadroomDb,
  formatTargetLufs,
  type AudioQuality,
  type AudioSafetyMode,
} from "@/lib/audio/options";
import type { CredentialView } from "@/lib/credentials/types";
import type { AppSettingsView, CleanupRetention, CleanupTarget } from "@/lib/settings/types";

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function SettingsDefaultsCard({
  initialSettings,
  credentials,
}: {
  initialSettings: AppSettingsView;
  credentials: CredentialView[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  function patchLocal(patch: Partial<AppSettingsView>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function applyAudioSafetyMode(mode: AudioSafetyMode) {
    if (mode === "custom") {
      patchLocal({ defaultAudioSafetyMode: mode });
      return;
    }
    const preset = AUDIO_SAFETY_MODE_PRESETS[mode];
    patchLocal({
      defaultAudioSafetyMode: mode,
      defaultQuality: preset.quality,
      defaultLimiterEnabled: preset.limiterEnabled,
      defaultHeadroomDb: preset.headroomDb,
      defaultTargetLufs: preset.targetLufs,
      ...(preset.amplifyDb !== undefined ? { defaultAmplifyDb: preset.amplifyDb } : {}),
    });
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const result = await patchJson<{ settings: AppSettingsView }>("/api/settings", {
        defaultSpeed: settings.defaultSpeed,
        defaultAmplifyDb: settings.defaultAmplifyDb,
        defaultTargetLufs: settings.defaultTargetLufs,
        defaultQuality: settings.defaultQuality,
        defaultAudioSafetyMode: settings.defaultAudioSafetyMode,
        defaultHeadroomDb: settings.defaultHeadroomDb,
        defaultLimiterEnabled: settings.defaultLimiterEnabled,
        defaultUploadEnabled: settings.defaultUploadEnabled,
        defaultCredentialId: settings.defaultCredentialId,
        defaultAssetNamePattern: settings.defaultAssetNamePattern,
        cleanupTarget: settings.cleanupTarget,
        cleanupRetention: settings.cleanupRetention,
        maxConcurrentJobs: settings.maxConcurrentJobs,
        retryCount: settings.retryCount,
      });
      setSettings(result.settings);
      toast.success("Settings saved. Convert will use these defaults for new batches.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function resetSettings() {
    if (!window.confirm("Reset all PKAudio defaults to factory values?")) return;
    setResetting(true);
    try {
      const result = await postJson<{ settings: AppSettingsView }>("/api/settings");
      setSettings(result.settings);
      toast.success("Settings reset to defaults.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset settings.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings2 className="size-4 text-violet-300" /> Persistent Defaults</CardTitle>
        <CardDescription>Saved in SQLite and applied automatically when you open Convert.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white">Audio defaults</h3>
            <p className="mt-1 text-xs text-zinc-500">Playback-rate speed, LUFS normalization, gain trim, OGG quality, and peak limiter defaults.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Default speed</Label>
              <Input
                type="number"
                min={0.5}
                max={3}
                step={0.01}
                value={settings.defaultSpeed}
                onChange={(event) => patchLocal({ defaultSpeed: toNumber(event.target.value, settings.defaultSpeed) })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Default gain trim</Label>
              <Input
                type="number"
                min={-12}
                max={12}
                step={0.5}
                value={settings.defaultAmplifyDb}
                onChange={(event) => patchLocal({ defaultAmplifyDb: toNumber(event.target.value, settings.defaultAmplifyDb) })}
                className="font-mono"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Safety mode</Label>
              <Select value={settings.defaultAudioSafetyMode} onValueChange={(value) => applyAudioSafetyMode(value as AudioSafetyMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIO_SAFETY_MODES.map((mode) => <SelectItem key={mode} value={mode}>{AUDIO_SAFETY_MODE_LABELS[mode]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quality</Label>
              <Select value={settings.defaultQuality} onValueChange={(value) => patchLocal({ defaultQuality: value as AudioQuality, defaultAudioSafetyMode: "custom" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUDIO_QUALITIES.map((item) => <SelectItem key={item} value={item}>{QUALITY_LABELS[item]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="min-w-0"><Label className="leading-5">Limiter + normalize default</Label><p className="mt-1 text-xs text-zinc-500">Two-pass LUFS normalization plus final peak ceiling.</p></div>
              <Switch className="mt-0.5 shrink-0" checked={settings.defaultLimiterEnabled} onCheckedChange={(value) => patchLocal({ defaultLimiterEnabled: value, defaultAudioSafetyMode: "custom" })} />
            </div>
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-3"><Label>Peak limit</Label><span className="font-mono text-xs text-zinc-300">{formatHeadroomDb(settings.defaultHeadroomDb)}</span></div>
              <Input
                type="number"
                min={MIN_HEADROOM_DB}
                max={MAX_HEADROOM_DB}
                step={0.5}
                value={settings.defaultHeadroomDb}
                onChange={(event) => patchLocal({ defaultHeadroomDb: toNumber(event.target.value, settings.defaultHeadroomDb), defaultAudioSafetyMode: "custom" })}
                className="font-mono"
                disabled={!settings.defaultLimiterEnabled}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex items-center justify-between gap-3"><Label>Target loudness</Label><span className="font-mono text-xs text-zinc-300">{formatTargetLufs(settings.defaultTargetLufs)}</span></div>
              <Input
                type="number"
                min={MIN_TARGET_LUFS}
                max={MAX_TARGET_LUFS}
                step={0.5}
                value={settings.defaultTargetLufs}
                onChange={(event) => patchLocal({ defaultTargetLufs: toNumber(event.target.value, settings.defaultTargetLufs), defaultAudioSafetyMode: "custom" })}
                className="font-mono"
                disabled={!settings.defaultLimiterEnabled}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-white/10 pt-5">
          <div>
            <h3 className="text-sm font-medium text-white">Roblox upload defaults</h3>
            <p className="mt-1 text-xs text-zinc-500">Used by Convert when creating new batches. Roblox upload metadata uses a cleaned audio title and fixed description.</p>
          </div>
          <div className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="min-w-0"><Label className="leading-5">Auto upload default</Label><p className="mt-1 text-xs text-zinc-500">Enable Roblox upload by default on Convert.</p></div>
            <Switch className="mt-0.5 shrink-0" checked={settings.defaultUploadEnabled} onCheckedChange={(value) => patchLocal({ defaultUploadEnabled: value })} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Default credential</Label>
              <Select
                value={settings.defaultCredentialId ?? "none"}
                onValueChange={(value) => patchLocal({ defaultCredentialId: value === "none" ? null : value })}
                disabled={credentials.length === 0}
              >
                <SelectTrigger><SelectValue placeholder={credentials.length ? "Select credential" : "No credentials saved"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default credential</SelectItem>
                  {credentials.map((credential) => (
                    <SelectItem key={credential.id} value={credential.id}>{credential.name} — {credential.creatorType} {credential.creatorId}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Roblox title pattern</Label>
              <Input
                value={settings.defaultAssetNamePattern}
                onChange={(event) => patchLocal({ defaultAssetNamePattern: event.target.value })}
                placeholder="{title}"
                maxLength={120}
              />
              <p className="text-xs leading-5 text-zinc-500">
                Tokens: <span className="font-mono text-zinc-300">{"{title}"}</span>, <span className="font-mono text-zinc-300">{"{id}"}</span>, <span className="font-mono text-zinc-300">{"{platform}"}</span>. Roblox receives a cleaned max-50-char title.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-white/10 pt-5">
          <div>
            <h3 className="text-sm font-medium text-white">Maintenance defaults</h3>
            <p className="mt-1 text-xs text-zinc-500">Cleanup defaults and worker-related preferences for later concurrency polish.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cleanup target default</Label>
              <Select value={settings.cleanupTarget} onValueChange={(value) => patchLocal({ cleanupTarget: value as CleanupTarget })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="temp">Temp files only</SelectItem>
                  <SelectItem value="outputs">Output OGG files only</SelectItem>
                  <SelectItem value="all">Temp + outputs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cleanup scope default</Label>
              <Select value={settings.cleanupRetention} onValueChange={(value) => patchLocal({ cleanupRetention: value as CleanupRetention })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All files</SelectItem>
                  <SelectItem value="24h">Older than 24 hours</SelectItem>
                  <SelectItem value="7d">Older than 7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Max concurrent jobs</Label>
              <Input
                type="number"
                min={1}
                max={4}
                step={1}
                value={settings.maxConcurrentJobs}
                onChange={(event) => patchLocal({ maxConcurrentJobs: Math.round(toNumber(event.target.value, settings.maxConcurrentJobs)) })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Retry count</Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={1}
                value={settings.retryCount}
                onChange={(event) => patchLocal({ retryCount: Math.round(toNumber(event.target.value, settings.retryCount)) })}
                className="font-mono"
              />
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-violet-500/15 bg-violet-500/8 p-4 text-sm leading-6 text-violet-100/80">
          <div className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" /> API keys stay AES-256-GCM encrypted in SQLite; settings only store the selected credential ID.</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveSettings()} disabled={saving || resetting}>
            <Save /> {saving ? "Saving..." : "Save defaults"}
          </Button>
          <Button variant="outline" onClick={() => void resetSettings()} disabled={saving || resetting}>
            <RotateCcw /> {resetting ? "Resetting..." : "Reset defaults"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
