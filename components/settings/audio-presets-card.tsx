"use client";

import { useState } from "react";
import { Plus, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { createAudioPresetRequest, deleteAudioPresetRequest, updateAudioPresetRequest } from "@/lib/presets/client";
import type { AudioPresetView } from "@/lib/presets/types";

type FormState = {
  id: string | null;
  name: string;
  description: string;
  speed: number;
  amplifyDb: number;
  targetLufs: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  credentialId: string;
  assetNamePattern: string;
  isDefault: boolean;
};

function emptyForm(credentials: CredentialView[]): FormState {
  return {
    id: null,
    name: "Fast SFX",
    description: "Reusable PKAudio conversion preset.",
    speed: 2.3,
    amplifyDb: 0,
    targetLufs: -14,
    quality: "q7",
    audioSafetyMode: "roblox_safe",
    headroomDb: -3,
    limiterEnabled: true,
    uploadEnabled: true,
    credentialId: credentials[0]?.id ?? "none",
    assetNamePattern: "{title}",
    isDefault: false,
  };
}

function formFromPreset(preset: AudioPresetView): FormState {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description ?? "",
    speed: preset.speed,
    amplifyDb: preset.amplifyDb,
    targetLufs: preset.targetLufs,
    quality: preset.quality,
    audioSafetyMode: preset.audioSafetyMode,
    headroomDb: preset.headroomDb,
    limiterEnabled: preset.limiterEnabled,
    uploadEnabled: preset.uploadEnabled,
    credentialId: preset.credentialId ?? "none",
    assetNamePattern: preset.assetNamePattern,
    isDefault: preset.isDefault,
  };
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AudioPresetsCard({ initialPresets, credentials }: { initialPresets: AudioPresetView[]; credentials: CredentialView[] }) {
  const [presets, setPresets] = useState(initialPresets);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(credentials));

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function applySafetyMode(mode: AudioSafetyMode) {
    if (mode === "custom") {
      patchForm({ audioSafetyMode: mode });
      return;
    }
    const preset = AUDIO_SAFETY_MODE_PRESETS[mode];
    patchForm({
      audioSafetyMode: mode,
      quality: preset.quality,
      limiterEnabled: preset.limiterEnabled,
      headroomDb: preset.headroomDb,
      targetLufs: preset.targetLufs,
      ...(preset.amplifyDb !== undefined ? { amplifyDb: preset.amplifyDb } : {}),
    });
  }

  function openCreate() {
    setForm(emptyForm(credentials));
    setOpen(true);
  }

  function openEdit(preset: AudioPresetView) {
    setForm(formFromPreset(preset));
    setOpen(true);
  }

  async function savePreset() {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        speed: form.speed,
        amplifyDb: form.amplifyDb,
        targetLufs: form.targetLufs,
        quality: form.quality,
        audioSafetyMode: form.audioSafetyMode,
        headroomDb: form.headroomDb,
        limiterEnabled: form.limiterEnabled,
        uploadEnabled: form.uploadEnabled,
        credentialId: form.credentialId === "none" ? null : form.credentialId,
        assetNamePattern: form.assetNamePattern,
        isDefault: form.isDefault,
      };
      const result = form.id ? await updateAudioPresetRequest(form.id, payload) : await createAudioPresetRequest(payload);
      setPresets((current) => {
        const without = current.filter((preset) => preset.id !== result.preset.id);
        const normalized = result.preset.isDefault ? without.map((preset) => ({ ...preset, isDefault: false })) : without;
        return [result.preset, ...normalized].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt.localeCompare(a.updatedAt));
      });
      setOpen(false);
      toast.success(form.id ? "Preset updated." : "Preset created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preset.");
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(preset: AudioPresetView) {
    try {
      const result = await updateAudioPresetRequest(preset.id, { isDefault: true });
      setPresets((current) => current.map((item) => ({ ...item, isDefault: item.id === result.preset.id })));
      toast.success(`${preset.name} is now the default preset.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set default preset.");
    }
  }

  async function deletePreset(preset: AudioPresetView) {
    if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await deleteAudioPresetRequest(preset.id);
      setPresets((current) => current.filter((item) => item.id !== preset.id));
      toast.success("Preset deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete preset.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2"><Star className="size-4 text-cyan-300" /> Audio Presets</CardTitle>
          <CardDescription>Save reusable speed, gain trim, LUFS target, peak limit, quality, and upload combinations for Convert.</CardDescription>
        </div>
        <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={openCreate}><Plus /> New preset</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {presets.length ? presets.map((preset) => (
          <div key={preset.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words font-semibold text-white">{preset.name}</h3>
                  {preset.isDefault ? <Badge variant="cyan">Default</Badge> : null}
                  <Badge variant="secondary">{preset.quality.toUpperCase()}</Badge>
                  <Badge variant="secondary">{AUDIO_SAFETY_MODE_LABELS[preset.audioSafetyMode]}</Badge>
                </div>
                {preset.description ? <p className="mt-1 text-sm text-zinc-500">{preset.description}</p> : null}
                <p className="mt-2 break-words text-xs leading-5 text-zinc-500">
                  {preset.speed.toFixed(2)}x • gain {preset.amplifyDb > 0 ? "+" : ""}{preset.amplifyDb} dB • {preset.limiterEnabled ? `${formatTargetLufs(preset.targetLufs)} → peak ≤ ${formatHeadroomDb(preset.headroomDb)}` : "Limiter OFF"} • upload {preset.uploadEnabled ? "ON" : "OFF"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 [&>button]:w-full sm:[&>button]:w-auto">
                {!preset.isDefault ? <Button variant="ghost" size="sm" onClick={() => void makeDefault(preset)}><Star /> Default</Button> : null}
                <Button variant="outline" size="sm" onClick={() => openEdit(preset)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-rose-200 hover:text-rose-100" onClick={() => void deletePreset(preset)}><Trash2 /> Delete</Button>
              </div>
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
            No presets yet. Create one for your common Roblox SFX/BGM conversion settings.
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-white/10 px-5 pb-3 pt-5 pr-10 sm:px-6 sm:pt-5">
            <DialogTitle>{form.id ? "Edit preset" : "Create preset"}</DialogTitle>
            <DialogDescription>Preset values can be applied from Convert and optionally used as the default.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[calc(100dvh-13rem)] min-h-0 overscroll-contain overflow-y-auto px-5 py-4 sm:grid-cols-2 sm:gap-4 sm:px-6">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(event) => patchForm({ name: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(event) => patchForm({ description: event.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Speed</Label>
              <Input type="number" min={0.5} max={3} step={0.01} value={form.speed} onChange={(event) => patchForm({ speed: toNumber(event.target.value, form.speed) })} />
            </div>
            <div className="space-y-2">
              <Label>Gain trim dB</Label>
              <Input type="number" min={-12} max={12} step={0.5} value={form.amplifyDb} onChange={(event) => patchForm({ amplifyDb: toNumber(event.target.value, form.amplifyDb), audioSafetyMode: "custom" })} />
            </div>
            <div className="space-y-2">
              <Label>Target loudness</Label>
              <Input type="number" min={MIN_TARGET_LUFS} max={MAX_TARGET_LUFS} step={0.5} value={form.targetLufs} disabled={!form.limiterEnabled} onChange={(event) => patchForm({ targetLufs: toNumber(event.target.value, form.targetLufs), audioSafetyMode: "custom" })} />
              <p className="text-xs text-zinc-500">LUFS normalization target.</p>
            </div>
            <div className="space-y-2">
              <Label>Safety mode</Label>
              <Select value={form.audioSafetyMode} onValueChange={(value) => applySafetyMode(value as AudioSafetyMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIO_SAFETY_MODES.map((mode) => <SelectItem key={mode} value={mode}>{AUDIO_SAFETY_MODE_LABELS[mode]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quality</Label>
              <Select value={form.quality} onValueChange={(value) => patchForm({ quality: value as AudioQuality, audioSafetyMode: "custom" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIO_QUALITIES.map((item) => <SelectItem key={item} value={item}>{QUALITY_LABELS[item]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credential</Label>
              <Select value={form.credentialId} onValueChange={(value) => patchForm({ credentialId: value })} disabled={!credentials.length}>
                <SelectTrigger><SelectValue placeholder={credentials.length ? "Select credential" : "No credentials"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No credential</SelectItem>
                  {credentials.map((credential) => <SelectItem key={credential.id} value={credential.id}>{credential.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Peak limit</Label>
              <Input type="number" min={MIN_HEADROOM_DB} max={MAX_HEADROOM_DB} step={0.5} value={form.headroomDb} disabled={!form.limiterEnabled} onChange={(event) => patchForm({ headroomDb: toNumber(event.target.value, form.headroomDb), audioSafetyMode: "custom" })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Roblox title pattern</Label>
              <Input value={form.assetNamePattern} maxLength={120} placeholder="{title}" onChange={(event) => patchForm({ assetNamePattern: event.target.value })} />
              <p className="text-xs leading-5 text-zinc-500">
                Tokens: <span className="font-mono text-zinc-300">{"{title}"}</span>, <span className="font-mono text-zinc-300">{"{id}"}</span>, <span className="font-mono text-zinc-300">{"{platform}"}</span>. Roblox receives a cleaned max-50-char title.
              </p>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="min-w-0"><Label className="leading-5">Limiter + normalize</Label><p className="mt-1 text-xs text-zinc-500">Two-pass LUFS normalization plus peak ceiling.</p></div>
              <Switch className="mt-0.5 shrink-0" checked={form.limiterEnabled} onCheckedChange={(value) => patchForm({ limiterEnabled: value, audioSafetyMode: "custom" })} />
            </div>
            <div className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="min-w-0"><Label className="leading-5">Auto upload</Label><p className="mt-1 text-xs text-zinc-500">Use selected Roblox credential.</p></div>
              <Switch className="mt-0.5 shrink-0" checked={form.uploadEnabled} onCheckedChange={(value) => patchForm({ uploadEnabled: value })} />
            </div>
            <div className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 sm:col-span-2">
              <div className="min-w-0"><Label className="leading-5">Default preset</Label><p className="mt-1 text-xs text-zinc-400">Automatically selected when opening Convert.</p></div>
              <Switch className="mt-0.5 shrink-0" checked={form.isDefault} onCheckedChange={(value) => patchForm({ isDefault: value })} />
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-white/10 bg-[#111114] px-5 py-3 shadow-[0_-12px_28px_rgba(0,0,0,0.22)] sm:px-6">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto" onClick={() => void savePreset()} disabled={saving}><Save /> {saving ? "Saving..." : "Save preset"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
