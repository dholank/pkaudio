"use client";
import { useState, useCallback } from "react";
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
  MAX_TARGET_LUFS,
  MIN_HEADROOM_DB,
  MIN_TARGET_LUFS,
  QUALITY_DESCRIPTIONS,
  QUALITY_LABELS,
  formatHeadroomDb,
  formatTargetLufs,
  type AudioQuality,
  type AudioSafetyMode,
} from "@/lib/audio/options";
import { formatDb, formatSpeed } from "@/lib/utils";

type AudioWarning = {
  level: "warn" | "danger";
  message: string;
};

function buildInputWarnings({
  amplifyDb,
  limiterEnabled,
  headroomDb,
  targetLufs,
  speed,
}: {
  amplifyDb: number;
  limiterEnabled: boolean;
  headroomDb: number;
  targetLufs: number;
  speed: number;
}) {
  const warnings: AudioWarning[] = [];
  if (!limiterEnabled && amplifyDb > 3) warnings.push({ level: "danger", message: "Limiter OFF with gain above +3 dB can clip hard." });
  if (limiterEnabled && headroomDb > -2) warnings.push({ level: "warn", message: "Hot peak limit; watch amber/red waveform bins after conversion." });
  if (limiterEnabled && targetLufs > -11) warnings.push({ level: "warn", message: "Very loud LUFS target can sound compressed after limiting." });
  if (amplifyDb >= 8) warnings.push({ level: "warn", message: "Very high gain trim. Use preview before uploading." });
  if (speed >= 2.75) warnings.push({ level: "warn", message: "Extreme speed raises pitch and can sound brittle." });
  if (speed <= 0.65) warnings.push({ level: "warn", message: "Very slow playback can make files larger and muddy." });
  return warnings;
}

export function AudioSettingsCard({
  speed,
  amplifyDb,
  targetLufs,
  quality,
  audioSafetyMode,
  headroomDb,
  limiterEnabled,
  onSpeedChange,
  onAmplifyChange,
  onTargetLufsChange,
  onQualityChange,
  onAudioSafetyModeChange,
  onHeadroomChange,
  onLimiterChange,
}: {
  speed: number;
  amplifyDb: number;
  targetLufs: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  onSpeedChange: (value: number) => void;
  onAmplifyChange: (value: number) => void;
  onTargetLufsChange: (value: number) => void;
  onQualityChange: (value: AudioQuality) => void;
  onAudioSafetyModeChange: (value: AudioSafetyMode) => void;
  onHeadroomChange: (value: number) => void;
  onLimiterChange: (value: boolean) => void;
}) {
  const warnings = buildInputWarnings({ amplifyDb, limiterEnabled, headroomDb, targetLufs, speed });
  const [speedDisplay, setSpeedDisplay] = useState(() => String(speed));
  const [gainDisplay, setGainDisplay] = useState(() => String(amplifyDb));

  const commitSpeed = useCallback((raw: string) => {
    const num = Number(raw);
    if (Number.isFinite(num)) {
      setSpeedDisplay(String(num));
      onSpeedChange(num);
    } else {
      setSpeedDisplay(String(speed));
    }
  }, [speed, onSpeedChange]);

  const commitGain = useCallback((raw: string) => {
    const num = Number(raw);
    if (Number.isFinite(num)) {
      setGainDisplay(String(num));
      onAmplifyChange(num);
    } else {
      setGainDisplay(String(amplifyDb));
    }
  }, [amplifyDb, onAmplifyChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-4 text-violet-300" /> Audio Output
        </CardTitle>
        <CardDescription>Speed, LUFS, gain, limiter, safety, OGG quality.</CardDescription>
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
            <Input type="number" min={0.5} max={3} step={0.01} value={speedDisplay} onChange={(event) => setSpeedDisplay(event.target.value)} onBlur={(event) => commitSpeed(event.target.value)} className="h-9 w-24 font-mono" />
          </div>
          <Slider min={0.5} max={3} step={0.01} value={[speed]} onValueChange={([value]) => { setSpeedDisplay(String(value)); onSpeedChange(value); }} />
          <div className="flex flex-wrap gap-2">
            {[1, 1.25, 1.5, 2, 2.3].map((preset) => (
              <button key={preset} onClick={() => { setSpeedDisplay(String(preset)); onSpeedChange(preset); }} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
                {formatSpeed(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="flex items-center gap-2"><Volume2 className="size-4 text-cyan-300" /> Gain trim</Label>
              <p className="mt-1 text-xs text-zinc-500">Extra gain after LUFS; limiter still catches peaks.</p>
            </div>
            <Input type="number" min={-12} max={12} step={0.5} value={gainDisplay} onChange={(event) => setGainDisplay(event.target.value)} onBlur={(event) => commitGain(event.target.value)} className="h-9 w-24 font-mono" />
          </div>
          <Slider min={-12} max={12} step={0.5} value={[amplifyDb]} onValueChange={([value]) => { setGainDisplay(String(value)); onAmplifyChange(value); }} />
          <div className="flex flex-wrap gap-2">
            {[-3, 0, 3, 6].map((preset) => (
              <button key={preset} onClick={() => { setGainDisplay(String(preset)); onAmplifyChange(preset); }} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
                {formatDb(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label className="flex flex-wrap items-center gap-2 leading-5"><ShieldCheck className="size-4 shrink-0 text-emerald-300" /> Limiter + normalize</Label>
                <p className="mt-1 text-xs text-zinc-500">Two-pass LUFS normalization + peak limiter.</p>
              </div>
              <Switch className="mt-0.5 shrink-0" checked={limiterEnabled} onCheckedChange={onLimiterChange} />
            </div>
          </div>
          <div className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="leading-5">Target loudness</Label>
              <Badge className="shrink-0" variant={targetLufs > -12 ? "warning" : "secondary"}>{formatTargetLufs(targetLufs)}</Badge>
            </div>
            <Slider min={MIN_TARGET_LUFS} max={MAX_TARGET_LUFS} step={0.5} value={[targetLufs]} onValueChange={([value]) => onTargetLufsChange(value)} disabled={!limiterEnabled} />
            <p className="text-xs text-zinc-500">Normalizes perceived volume.</p>
          </div>
          <div className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="leading-5">Peak limit</Label>
              <Badge className="shrink-0" variant={headroomDb > -2 ? "warning" : "secondary"}>{formatHeadroomDb(headroomDb)}</Badge>
            </div>
            <Slider min={MIN_HEADROOM_DB} max={MAX_HEADROOM_DB} step={0.5} value={[headroomDb]} onValueChange={([value]) => onHeadroomChange(value)} disabled={!limiterEnabled} />
            <p className="text-xs text-zinc-500">Max output peak / waveform amber threshold.</p>
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
          Final output: OGG • 44.1kHz • Stereo • {quality.toUpperCase()} • {limiterEnabled ? `${formatTargetLufs(targetLufs)} → peak ≤ ${formatHeadroomDb(headroomDb)}` : "manual gain, limiter OFF"}.
        </div>
      </CardContent>
    </Card>
  );
}
