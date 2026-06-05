"use client";

import { useState } from "react";
import { AlertTriangle, Archive, DatabaseBackup, Download, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/utils";

export type BackupSummaryView = {
  schemaVersion: 1;
  id: string;
  label: string | null;
  mode: "db" | "full";
  createdAt: string;
  app: { name: string; version: string };
  paths: { archiveName: string; dbPath: string; outputsIncluded: boolean };
  stats: { dbBytes: number; outputBytes: number; outputFiles: number; archiveBytes: number };
  security: {
    containsEncryptedRobloxCredentials: boolean;
    envFileIncluded: false;
    requiresSameMasterKey: boolean;
    masterKeySha256Prefix: string | null;
  };
  exists: boolean;
};

type BackupMode = "db" | "full";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

function backupDownloadHref(id: string) {
  return `/api/backups/${encodeURIComponent(id)}`;
}

export function BackupRestoreCard({ initialBackups }: { initialBackups: BackupSummaryView[] }) {
  const [backups, setBackups] = useState(initialBackups);
  const [mode, setMode] = useState<BackupMode>("db");
  const [label, setLabel] = useState("");
  const [restoreOutputs, setRestoreOutputs] = useState(true);
  const [loading, setLoading] = useState(false);

  async function refreshBackups(silent = false) {
    if (!silent) setLoading(true);
    try {
      const result = await parseResponse<{ backups: BackupSummaryView[] }>(await fetch("/api/backups", { cache: "no-store" }));
      setBackups(result.backups);
      if (!silent) toast.success("Backup list refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh backups.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function createBackup() {
    setLoading(true);
    try {
      const result = await parseResponse<{ backup: BackupSummaryView; backups: BackupSummaryView[] }>(
        await fetch("/api/backups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, label: label.trim() || null }),
        }),
      );
      setBackups(result.backups);
      setLabel("");
      toast.success(`Backup created: ${result.backup.paths.archiveName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create backup.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreBackup(backup: BackupSummaryView) {
    const wantsOutputs = restoreOutputs && backup.paths.outputsIncluded;
    const confirmed = window.confirm(
      `Restore backup ${backup.paths.archiveName}?\n\n` +
        `A rollback backup will be created first. Current SQLite data will be replaced${wantsOutputs ? " and output files will be copied back" : ""}.\n\n` +
        "Do this only while the worker is idle.",
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await parseResponse<{ restore: { rollbackBackup: BackupSummaryView; restoredOutputs: boolean }; backups: BackupSummaryView[] }>(
        await fetch(`/api/backups/${encodeURIComponent(backup.id)}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restoreOutputs: wantsOutputs }),
        }),
      );
      setBackups(result.backups);
      toast.success(`Restore complete. Rollback saved: ${result.restore.rollbackBackup.paths.archiveName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore backup.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteBackup(backup: BackupSummaryView) {
    if (!window.confirm(`Delete backup ${backup.paths.archiveName}?`)) return;
    setLoading(true);
    try {
      await parseResponse<{ backup: BackupSummaryView }>(await fetch(`/api/backups/${encodeURIComponent(backup.id)}`, { method: "DELETE" }));
      setBackups((current) => current.filter((item) => item.id !== backup.id));
      toast.success("Backup deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete backup.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-4 text-emerald-300" /> Backup & Restore</CardTitle>
        <CardDescription>Local SQLite backup with optional outputs archive. Backups are saved under <span className="font-mono">backups/</span>.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Backup includes encrypted Roblox credentials. It does not include <span className="font-mono">.env.local</span>; keep the same master key separately or saved credentials cannot be decrypted after restore.</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Backup mode</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as BackupMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="db">SQLite DB only</SelectItem>
                <SelectItem value="full">SQLite DB + outputs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Optional label</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Before major cleanup" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void createBackup()} disabled={loading}>
            <Archive /> Create backup
          </Button>
          <Button variant="outline" onClick={() => void refreshBackups()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div><Label>Restore outputs when available</Label><p className="mt-1 text-xs text-zinc-500">DB restore always happens; outputs are copied only for full backups.</p></div>
          <Switch checked={restoreOutputs} onCheckedChange={setRestoreOutputs} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-white">Local backups</h3>
            <span className="text-xs text-zinc-500">{backups.length} backup{backups.length === 1 ? "" : "s"}</span>
          </div>
          {backups.length ? backups.map((backup) => (
            <div key={backup.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm text-white">{backup.paths.archiveName}</p>
                    <Badge variant={backup.mode === "full" ? "cyan" : "secondary"}>{backup.mode === "full" ? "DB + outputs" : "DB only"}</Badge>
                    {!backup.exists ? <Badge variant="destructive">archive missing</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(backup.createdAt).toLocaleString()} • archive {formatBytes(backup.stats.archiveBytes)} • DB {formatBytes(backup.stats.dbBytes)}
                    {backup.paths.outputsIncluded ? ` • outputs ${formatBytes(backup.stats.outputBytes)} / ${backup.stats.outputFiles} file(s)` : ""}
                  </p>
                  {backup.label ? <p className="mt-1 text-sm text-zinc-400">{backup.label}</p> : null}
                  <p className="mt-1 text-[11px] text-zinc-600">Master key fingerprint: {backup.security.masterKeySha256Prefix ?? "not recorded"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {backup.exists ? <Button variant="outline" size="sm" asChild><a href={backupDownloadHref(backup.id)}><Download /> Download</a></Button> : null}
                  {backup.exists ? <Button variant="outline" size="sm" onClick={() => void restoreBackup(backup)} disabled={loading}><RotateCcw /> Restore</Button> : null}
                  <Button variant="ghost" size="sm" className="text-rose-200 hover:text-rose-100" onClick={() => void deleteBackup(backup)} disabled={loading}><Trash2 /> Delete</Button>
                </div>
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
              No backups yet. Create a DB backup before risky cleanup, restore tests, or WSL migration.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
