"use client";

import { Clock3, ListChecks, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutoCutPreview } from "@/lib/trim/preview";

export function AutoCutCard({
  validUrlCount,
  preview,
  analyzing,
  converting,
  canConvert,
  onAnalyze,
  onConvert,
}: {
  validUrlCount: number;
  preview: AutoCutPreview | null;
  analyzing: boolean;
  converting: boolean;
  canConvert: boolean;
  onAnalyze: () => void;
  onConvert: () => void;
}) {
  return (
    <Card className="border-violet-500/20 bg-violet-500/[0.04]">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Scissors className="size-4 text-violet-300" /> Auto Cut / Trim
          </CardTitle>
          <CardDescription>
            Analyze one long source URL, cut it into fixed 5-minute parts, preview the parts, then queue each part as a normal Roblox conversion job.
          </CardDescription>
        </div>
        <Badge variant={validUrlCount === 1 ? "cyan" : "warning"}>1 URL mode</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm leading-6 text-zinc-400">
            {validUrlCount === 1 ? (
              <span>Ready to analyze the single valid URL from Source URLs.</span>
            ) : (
              <span>Auto Cut v1 requires exactly one valid YouTube/SoundCloud URL. Current valid URL count: {validUrlCount}.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onAnalyze} disabled={analyzing || converting || validUrlCount !== 1}>
              <Scissors /> {analyzing ? "Analyzing & cutting..." : "Analyze & Cut"}
            </Button>
            <Button onClick={onConvert} disabled={!canConvert || analyzing || converting}>
              <ListChecks /> {converting ? "Queueing parts..." : "Convert Parts"}
            </Button>
          </div>
        </div>

        {preview ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{preview.sourceTitle ?? "Untitled source"}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                  <Clock3 className="size-3.5" /> Duration {preview.durationLabel} • {preview.parts.length} part{preview.parts.length === 1 ? "" : "s"} • 5 min target segments
                </p>
              </div>
              <Badge variant="secondary" className="font-mono">{preview.previewId.slice(0, 8)}</Badge>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {preview.parts.map((part) => (
                <div key={part.index} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">Part {String(part.index).padStart(2, "0")}/{String(part.total).padStart(2, "0")}</p>
                    <Badge variant="outline">{part.durationLabel}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">Start {part.startLabel}</p>
                  <p className="mt-2 truncate text-xs text-zinc-300" title={part.title}>{part.title}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-zinc-500">
            No preview yet. Click Analyze & Cut first; Convert Parts stays disabled until the cut files are ready.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
