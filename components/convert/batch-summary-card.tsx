"use client";

import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIO_SAFETY_MODE_LABELS, formatHeadroomDb, type AudioQuality, type AudioSafetyMode } from "@/lib/audio/options";
import { formatDb, formatSpeed } from "@/lib/utils";

export function BatchSummaryCard({
  validUrls,
  speed,
  amplifyDb,
  quality,
  audioSafetyMode,
  headroomDb,
  limiterEnabled,
  uploadEnabled,
  canStart,
  isStarting = false,
  onStart,
}: {
  validUrls: number;
  speed: number;
  amplifyDb: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  canStart: boolean;
  isStarting?: boolean;
  onStart?: () => void;
}) {
  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-[#111114] to-cyan-500/10">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Batch summary</p>
          <p className="mt-1 text-sm text-zinc-400">
            {validUrls} URLs • {formatSpeed(speed)} • {formatDb(amplifyDb)} • OGG {quality.toUpperCase()} • {AUDIO_SAFETY_MODE_LABELS[audioSafetyMode]} • {limiterEnabled ? `Limiter ${formatHeadroomDb(headroomDb)}` : "Limiter OFF"} • {uploadEnabled ? "Auto upload" : "Convert only"}
          </p>
        </div>
        <Button size="lg" disabled={!canStart || isStarting} onClick={onStart}>
          <Rocket /> {isStarting ? "Starting..." : "Start Batch"}
        </Button>
      </CardContent>
    </Card>
  );
}
