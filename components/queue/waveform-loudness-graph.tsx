"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WaveformAnalysis } from "@/lib/audio/waveform";
import { waveformHref } from "@/lib/audio/waveform";

function formatDb(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)} dBFS`;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildPath(points: WaveformAnalysis["points"], width: number, height: number, key: "peak" | "rms") {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - clamp01(point[key]) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function WaveformSvg({ analysis }: { analysis: WaveformAnalysis }) {
  const gradientId = useId().replaceAll(":", "");
  const width = 720;
  const height = 120;
  const center = height / 2;
  const peakPath = buildPath(analysis.points, width, center - 6, "peak");
  const rmsPath = buildPath(analysis.points, width, center - 14, "rms");
  const headroomY = center - Math.pow(10, analysis.summary.headroomTargetDb / 20) * (center - 6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Waveform and loudness graph" className="h-36 w-full overflow-visible rounded-xl border border-white/10 bg-black/20">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <line x1="0" x2={width} y1={center} y2={center} stroke="rgba(255,255,255,0.14)" strokeDasharray="4 5" />
      <line x1="0" x2={width} y1={headroomY} y2={headroomY} stroke="rgba(251,191,36,0.55)" strokeDasharray="6 6" />
      <line x1="0" x2={width} y1={height - headroomY} y2={height - headroomY} stroke="rgba(251,191,36,0.35)" strokeDasharray="6 6" />
      {analysis.points.map((point, index) => {
        const x = (index / analysis.points.length) * width;
        const barWidth = Math.max(1, width / analysis.points.length - 0.5);
        const barHeight = clamp01(point.peak) * (center - 6);
        const color = point.clips ? "rgb(244 63 94)" : point.exceedsHeadroom ? "rgb(251 191 36)" : "rgb(34 211 238)";
        return <rect key={point.index} x={x} y={center - barHeight} width={barWidth} height={barHeight * 2} rx="1" fill={color} opacity={point.clips || point.exceedsHeadroom ? 0.88 : 0.56} />;
      })}
      <path d={`${peakPath} L${width},${center} L0,${center} Z`} fill={`url(#${gradientId})`} transform={`translate(0 ${6})`} />
      <path d={rmsPath} fill="none" stroke="rgb(167 139 250)" strokeWidth="2" transform={`translate(0 ${14})`} />
      <text x="10" y="18" fill="rgba(255,255,255,0.55)" fontSize="11">Peak bars • purple RMS • amber = above -3 dBFS</text>
    </svg>
  );
}

export function WaveformLoudnessGraph({ outputPath }: { outputPath: string | null }) {
  const [state, setState] = useState<{ path: string | null; analysis: WaveformAnalysis | null; missing: boolean }>({
    path: null,
    analysis: null,
    missing: false,
  });

  useEffect(() => {
    if (!outputPath) return;
    let cancelled = false;

    fetch(waveformHref(outputPath), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? "missing" : "unavailable");
        }
        return (await response.json()) as WaveformAnalysis;
      })
      .then((payload) => {
        if (!cancelled) setState({ path: outputPath, analysis: payload, missing: false });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ path: outputPath, analysis: null, missing: error.message === "missing" });
      });

    return () => {
      cancelled = true;
    };
  }, [outputPath]);

  const analysis = state.path === outputPath ? state.analysis : null;
  const missing = state.path === outputPath && state.missing;
  const loading = Boolean(outputPath && state.path !== outputPath);

  const badge = useMemo(() => {
    if (!analysis) return null;
    if (analysis.summary.clipBins > 0) return <Badge variant="destructive">{analysis.summary.clipBins} clipping bins</Badge>;
    if (analysis.summary.headroomExceededBins > 0) return <Badge variant="warning">{analysis.summary.headroomExceededBins} above -3 dBFS</Badge>;
    return <Badge variant="success">Headroom OK</Badge>;
  }, [analysis]);

  if (!outputPath) return null;

  return (
    <div className="mt-4 rounded-2xl border border-violet-500/15 bg-violet-500/[0.045] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-50">
          <BarChart3 className="size-4 text-violet-300" /> Waveform & loudness
        </div>
        {badge}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" /> Loading waveform artifact...
        </div>
      ) : analysis ? (
        <>
          <WaveformSvg analysis={analysis} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-600">Peak</span><br /><span className="font-mono text-zinc-100">{formatDb(analysis.summary.peakDb)}</span></div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-600">RMS</span><br /><span className="font-mono text-zinc-100">{formatDb(analysis.summary.rmsDb)}</span></div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-600">Bins</span><br /><span className="font-mono text-zinc-100">{analysis.source.bins}</span></div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400"><span className="text-zinc-600">Duration</span><br /><span className="font-mono text-zinc-100">{analysis.source.durationSec.toFixed(2)}s</span></div>
          </div>
          {analysis.summary.clipBins || analysis.summary.headroomExceededBins ? (
            <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Peaks above target are highlighted. Lower amplify or keep limiter enabled if this looks too hot.
            </div>
          ) : (
            <div className="mt-3 flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              <Activity className="mt-0.5 size-4 shrink-0" /> Waveform stays under the -3 dBFS headroom target.
            </div>
          )}
        </>
      ) : missing ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-zinc-400">
          Waveform belum ada untuk file lama ini. Retry/reprocess job buat generate artifact baru.
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-zinc-400">
          Waveform unavailable.
        </div>
      )}
    </div>
  );
}
