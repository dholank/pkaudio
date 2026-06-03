"use client";

import { useState } from "react";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBytes } from "@/lib/utils";

type DirectoryStats = {
  root: string;
  exists: boolean;
  bytes: number;
  files: number;
  dirs: number;
};

type StorageStats = {
  outputs: DirectoryStats;
  temp: DirectoryStats;
};

type CleanupTarget = "temp" | "outputs" | "all";
type RetentionValue = "all" | "24h" | "7d";

const retentionToMs: Record<RetentionValue, number | null> = {
  all: null,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

function StatRow({ label, stats }: { label: string; stats: DirectoryStats }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="mt-1 truncate font-mono text-xs text-zinc-600">{stats.root}</p>
        </div>
        <div className="text-right font-mono text-lg text-cyan-100">{formatBytes(stats.bytes)}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
        <span>{stats.exists ? "Exists" : "Will be created on demand"}</span>
        <span>•</span>
        <span>{stats.files} files</span>
        <span>•</span>
        <span>{stats.dirs} folders</span>
      </div>
    </div>
  );
}

export function StorageCleanupCard({
  initialStorage,
  initialTarget = "temp",
  initialRetention = "all",
}: {
  initialStorage: StorageStats;
  initialTarget?: CleanupTarget;
  initialRetention?: RetentionValue;
}) {
  const [storage, setStorage] = useState(initialStorage);
  const [target, setTarget] = useState<CleanupTarget>(initialTarget);
  const [retention, setRetention] = useState<RetentionValue>(initialRetention);
  const [loading, setLoading] = useState(false);

  async function refreshStorage(silent = false) {
    if (!silent) setLoading(true);
    try {
      const result = await parseResponse<{ storage: StorageStats }>(await fetch("/api/storage", { cache: "no-store" }));
      setStorage(result.storage);
      if (!silent) toast.success("Storage stats refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh storage stats.");
    } finally {
      if (!silent) setLoading(false);
    }
  }


  async function cleanup() {
    const label = target === "all" ? "temp and output files" : target === "temp" ? "temp files" : "output files";
    const scope = retention === "all" ? "all" : `files older than ${retention}`;
    if (!window.confirm(`Delete ${scope} ${label}? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const result = await parseResponse<{
        cleanup: { deletedBytes: number; deletedFiles: number; deletedDirs: number; skipped: number };
        storage: StorageStats;
      }>(
        await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, maxAgeMs: retentionToMs[retention] }),
        }),
      );
      setStorage(result.storage);
      toast.success(
        `Deleted ${result.cleanup.deletedFiles} file(s), ${result.cleanup.deletedDirs} folder(s), ${formatBytes(result.cleanup.deletedBytes)}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cleanup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FolderOpen className="size-4 text-cyan-300" /> Storage & Cleanup</CardTitle>
        <CardDescription>Real output/temp storage stats and safe cleanup for local files.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <StatRow label="Output folder" stats={storage.outputs} />
          <StatRow label="Temp jobs folder" stats={storage.temp} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Output folder</Label><Input value="outputs/" className="font-mono" readOnly /></div>
          <div className="space-y-2"><Label>Temp folder</Label><Input value="tmp/jobs/" className="font-mono" readOnly /></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cleanup target</Label>
            <Select value={target} onValueChange={(value) => setTarget(value as CleanupTarget)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="temp">Temp files only</SelectItem>
                <SelectItem value="outputs">Output OGG files only</SelectItem>
                <SelectItem value="all">Temp + outputs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Delete scope</Label>
            <Select value={retention} onValueChange={(value) => setRetention(value as RetentionValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All files</SelectItem>
                <SelectItem value="24h">Older than 24 hours</SelectItem>
                <SelectItem value="7d">Older than 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refreshStorage()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh stats
          </Button>
          <Button variant="outline" className="text-rose-200 hover:text-rose-100" onClick={() => void cleanup()} disabled={loading}>
            <Trash2 /> Run cleanup
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
