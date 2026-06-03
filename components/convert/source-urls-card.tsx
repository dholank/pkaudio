"use client";

import { useMemo } from "react";
import { Link2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

function getUrlStats(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  let valid = 0;
  let duplicates = 0;
  let invalid = 0;

  for (const line of lines) {
    const lower = line.toLowerCase();
    const supported = lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("soundcloud.com");
    if (!supported) {
      invalid += 1;
      continue;
    }
    if (seen.has(lower)) {
      duplicates += 1;
      continue;
    }
    seen.add(lower);
    valid += 1;
  }

  return { lines: lines.length, valid, duplicates, invalid };
}

export function SourceUrlsCard({ urls, onChange }: { urls: string; onChange: (value: string) => void }) {
  const stats = useMemo(() => getUrlStats(urls), [urls]);

  return (
    <Card className="min-h-full">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-cyan-300" /> Source URLs
          </CardTitle>
          <CardDescription>Paste YouTube or SoundCloud links, one per line.</CardDescription>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">
          {stats.valid} valid
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={urls}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=...\nhttps://soundcloud.com/..."
          className="min-h-[260px] resize-none font-mono leading-6"
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-200">{stats.valid} valid</span>
            <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-200">{stats.invalid} invalid</span>
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-200">{stats.duplicates} duplicates</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onChange(urls.split(/\r?\n/).filter((line, index, arr) => arr.indexOf(line) === index).join("\n"))}>
              <RotateCcw /> Dedupe
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange("")}> 
              <Trash2 /> Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { getUrlStats };
