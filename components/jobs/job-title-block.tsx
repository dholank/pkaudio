"use client";

import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/queue/status-badge";
import type { JobView } from "@/lib/jobs/types";

/**
 * Job title block with status badge, platform badge, job id, title, and source URL.
 * Variants:
 *   compact=true  — small text for cards (default)
 *   compact=false — normal text with truncation for denser layouts
 *   showId=true   — show short job ID
 */
export function JobTitleBlock({
  job,
  compact = true,
  showId = true,
}: {
  job: Pick<JobView, "status" | "sourcePlatform" | "id" | "title" | "sourceUrl">;
  compact?: boolean;
  showId?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={job.status} />
        <Badge variant="secondary" className="text-[10px]">{job.sourcePlatform}</Badge>
        {showId ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-zinc-600">
            {job.id.slice(0, 8)}
          </span>
        ) : null}
      </div>
      <h3 className={`mt-2 break-words font-semibold text-white ${compact ? "text-sm" : "text-base md:truncate"}`}>
        {job.title ?? "Queued source"}
      </h3>
      <p className={`break-all font-mono text-zinc-600 ${compact ? "text-[11px] line-clamp-1" : "mt-1 text-xs md:truncate"}`}>
        {job.sourceUrl}
      </p>
      {!compact ? (
        <div className="font-mono text-[11px] text-zinc-700">{job.id.slice(0, 8)}</div>
      ) : null}
    </>
  );
}
