"use client";

import { AlertTriangle, Gauge, ShieldCheck, SlidersHorizontal, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  AUDIO_QUALITIES,
  AUDIO_SAFETY_MODE_DESCRIPTIONS,
  AUDIO_SAFETY_MODE_LABELS,
  AUDIO_SAFETY_MODES,
  MAX_HEADROOM_DB,
  MIN_HEADROOM_DB,
  QUALITY_DESCRIPTIONS,
  QUALITY_LABELS,
  formatHeadroomDb,
  type AudioQuality,
  type AudioSafetyMode,
} from "@/lib/audio/options";
import { formatDb, formatSpeed } from "@/lib/utils";

type AudioWarning = {
  level: "warn" | "danger";
  message: string;
};

function buildInputWarnings({ amplifyDb, limiterEnabled, headroomDb, speed }: { amplifyDb: number; limiterEnabled: boolean; headroomDb: number; speed: number }) {
  const warnings: AudioWarning[] = [];
  if (!limiterEnabled && amplifyDb > 3) warnings.push({ level: "danger", message: "Limiter OFF with boost above +3 dB can clip hard." });
  if (limiterEnabled && headroomDb > -2) warnings.push({ level: "warn", message: "Hot headroom target; watch amber/red waveform bins after conversion." });
  if (amplifyDb >= 8) warnings.push({ level: "warn", message: "Very high amplification. Use preview before uploading." });
  if (speed >= 2.75) warnings.push({ level: "warn", message: "Extreme speed raises pitch and can sound brittle." });
  if (speed <= 0.65) warnings.push({ level: "warn", message: "Very slow playback can make files larger and muddy." });
  return warnings;
}

export function AudioSettingsCard({
  speed,
  amplifyDb,
  quality,
  audioSafetyMode,
  headroomDb,
  limiterEnabled,
  onSpeedChange,
  onAmplifyChange,
  onQualityChange,
  onAudioSafetyModeChange,
  onHeadroomChange,
  onLimiterChange,
}: {
  speed: number;
  amplifyDb: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  onSpeedChange: (value: number) => void;
  onAmplifyChange: (value: number) => void;
  onQualityChange: (value: AudioQuality) => void;
  onAudioSafetyModeChange: (value: AudioSafetyMode) => void;
  onHeadroomChange: (value: number) => void;
  onLimiterChange: (value: boolean) => void;
}) {
  const warnings = buildInputWarnings({ amplifyDb, limiterEnabled, headroomDb, speed });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-violet-300" /> Audio Output
        </CardTitle>
        <CardDescription>Playback-rate speed, gain, limiter headroom, safety mode, and granular OGG quality.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-violet-300" /> Safety mode</Label>
            <Select value={audioSafetyMode} onValueChange={(value) => onAudioSafetyModeChange(value as AudioSafetyMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIO_SAFETY_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>{AUDIO_SAFETY_MODE_LABELS[mode]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-zinc-500">{AUDIO_SAFETY_MODE_DESCRIPTIONS[audioSafetyMode]}</p>
          </div>
          <div className="space-y-2">
            <Label>OGG Vorbis Quality</Label>
            <Select value={quality} onValueChange={(value) => onQualityChange(value as AudioQuality)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIO_QUALITIES.map((item) => (
                  <SelectItem key={item} value={item}>{QUALITY_LABELS[item]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-zinc-500">{QUALITY_DESCRIPTIONS[quality]}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label>Speed</Label>
            <Input type="number" min={0.5} max={3} step={0.01} value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))} className="h-9 w-24 font-mono" />
          </div>
          <Slider min={0.5} max={3} step={0.01} value={[speed]} onValueChange={([value]) => onSpeedChange(value)} />
          <div className="flex flex-wrap gap-2">
            {[1, 1.25, 1.5, 2, 2.3].map((preset) => (
              <button key={preset} onClick={() => onSpeedChange(preset)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
                {formatSpeed(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label className="flex items-center gap-2"><Volume2 className="size-4 text-cyan-300" /> Amplify</Label>
            <Input type="number" min={-12} max={12} step={0.5} value={amplifyDb} onChange={(event) => onAmplifyChange(Number(event.target.value))} className="h-9 w-24 font-mono" />
          </div>
          <Slider min={-12} max={12} step={0.5} value={[amplifyDb]} onValueChange={([value]) => onAmplifyChange(value)} />
          <div className="flex flex-wrap gap-2">
            {[-3, 0, 3, 6].map((preset) => (
              <button key={preset} onClick={() => onAmplifyChange(preset)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
                {formatDb(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-300" /> Limiter</Label>
                <p className="mt-1 text-xs text-zinc-500">Caps final output near configured headroom.</p>
              </div>
              <Switch checked={limiterEnabled} onCheckedChange={onLimiterChange} />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-4">
              <Label>Headroom target</Label>
              <Badge variant={headroomDb > -2 ? "warning" : "secondary"}>{formatHeadroomDb(headroomDb)}</Badge>
            </div>
            <Slider min={MIN_HEADROOM_DB} max={MAX_HEADROOM_DB} step={0.5} value={[headroomDb]} onValueChange={([value]) => onHeadroomChange(value)} disabled={!limiterEnabled} />
            <p className="text-xs text-zinc-500">Also drives waveform amber threshold.</p>
          </div>
        </div>

        {warnings.length ? (
          <div className="space-y-2">
            {warnings.map((warning) => (
              <div key={warning.message} className={warning.level === "danger" ? "flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100" : "flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {warning.message}
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 px-3 py-3 text-xs leading-5 text-cyan-100/85">
          Playback-rate mode changes speed and pitch together. Final output: OGG Vorbis • 44.1kHz • Stereo • {quality.toUpperCase()} • {limiterEnabled ? `Limiter ${formatHeadroomDb(headroomDb)}` : "Limiter OFF"}.
        </div>
      </CardContent>
    </Card>
  );
}
