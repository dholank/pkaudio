"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { JobLogView, JobView } from "@/lib/jobs/types";

export function JobLogDialog({
  open,
  job,
  logs,
  loading,
  onOpenChange,
}: {
  open: boolean;
  job: JobView | null;
  logs: JobLogView[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Job logs</DialogTitle>
          <DialogDescription>{job?.sourceUrl ?? "Select a job to inspect logs."}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[360px] rounded-xl border border-white/10 bg-[#050507] p-4">
          {loading ? (
            <p className="font-mono text-sm text-zinc-500">Loading logs...</p>
          ) : logs.length ? (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="font-mono text-xs leading-6 text-zinc-300">
                  <span className="text-zinc-600">[{new Date(log.createdAt).toLocaleTimeString()}]</span>{" "}
                  <span className={log.level === "error" ? "text-rose-300" : log.level === "warn" ? "text-amber-300" : "text-cyan-200"}>{log.level.toUpperCase()}</span>{" "}
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-zinc-500">No logs yet.</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
