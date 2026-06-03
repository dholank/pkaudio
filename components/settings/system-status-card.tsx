import { Database, KeyRound, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDatabaseInfo, getSqlite } from "@/lib/db/client";
import { getSystemChecks } from "@/lib/system/checks";

export async function SystemStatusCard() {
  let dbOk = true;
  try {
    getSqlite();
  } catch {
    dbOk = false;
  }

  const checks = await getSystemChecks();
  const rows = [
    {
      name: "SQLite",
      detail: dbOk ? getDatabaseInfo().path : "Database connection failed",
      ok: dbOk,
      status: dbOk ? "Ready" : "Error",
      icon: Database,
    },
    {
      name: "AES-256-GCM",
      detail: process.env.ENCRYPTION_MASTER_KEY ? "Credential master key configured" : "ENCRYPTION_MASTER_KEY missing",
      ok: Boolean(process.env.ENCRYPTION_MASTER_KEY),
      status: process.env.ENCRYPTION_MASTER_KEY ? "Ready" : "Missing",
      icon: KeyRound,
    },
    ...Object.values(checks).map((check) => ({
      name: check.name,
      detail: check.ok ? `${check.path} • ${check.version ?? "version unavailable"}` : check.error ?? "Missing",
      ok: check.ok,
      status: check.ok ? "Ready" : "Missing",
      icon: Server,
    })),
  ];

  const workerReady = Object.values(checks).every((check) => check.ok);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Server className="size-4 text-cyan-300" /> System Status</CardTitle>
        <CardDescription>Real local checks for SQLite, encryption, ffmpeg, ffprobe, and yt-dlp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((check) => {
          const Icon = check.icon;
          return (
            <div key={check.name} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-mono text-sm text-white"><Icon className="size-4 text-zinc-500" /> {check.name}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{check.detail}</p>
              </div>
              <Badge variant={check.ok ? "success" : "warning"}>{check.status}</Badge>
            </div>
          );
        })}

        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-4 text-sm leading-6 text-cyan-100/80">
          Worker: <span className="font-mono">{workerReady ? "npm run worker" : "install missing binaries first"}</span>
          <br />One-shot test: <span className="font-mono">npm run worker:once</span>
        </div>
      </CardContent>
    </Card>
  );
}
