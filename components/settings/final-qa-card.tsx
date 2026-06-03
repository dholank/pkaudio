"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw, Terminal, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DoctorReport, DoctorStatus } from "@/lib/system/doctor";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

function statusBadge(status: DoctorStatus) {
  if (status === "pass") return <Badge variant="success">PASS</Badge>;
  if (status === "warn") return <Badge variant="warning">WARN</Badge>;
  return <Badge variant="destructive">FAIL</Badge>;
}

function statusIcon(status: DoctorStatus) {
  if (status === "pass") return <CheckCircle2 className="size-4 text-emerald-300" />;
  if (status === "warn") return <AlertTriangle className="size-4 text-amber-300" />;
  return <XCircle className="size-4 text-rose-300" />;
}

function summaryVariant(status: DoctorReport["summary"]["status"]) {
  if (status === "ready") return "success";
  if (status === "needs_attention") return "warning";
  return "destructive";
}

export function FinalQaCard({ initialReport }: { initialReport: DoctorReport }) {
  const [report, setReport] = useState(initialReport);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const result = await parseResponse<{ doctor: DoctorReport }>(await fetch("/api/system/doctor", { cache: "no-store" }));
      setReport(result.doctor);
      toast.success("Final QA doctor refreshed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh final QA doctor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardList className="size-4 text-emerald-300" /> Final QA Doctor</CardTitle>
        <CardDescription>WSL2/local readiness checks before running conversions, cleanup, or restore.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Overall</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={summaryVariant(report.summary.status)}>{report.summary.status.replace("_", " ")}</Badge>
              <span className="text-xs text-zinc-500">{new Date(report.generatedAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-zinc-500">Pass</p><p className="mt-1 font-mono text-2xl text-emerald-200">{report.summary.pass}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-zinc-500">Warn / Fail</p><p className="mt-1 font-mono text-2xl text-amber-200">{report.summary.warn}<span className="text-zinc-600">/</span><span className="text-rose-200">{report.summary.fail}</span></p></div>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/8 p-4 text-sm leading-6 text-cyan-100/80">
          <Terminal className="mr-2 inline size-4" /> CLI checks: <span className="font-mono">npm run qa</span> for doctor only, <span className="font-mono">npm run qa:full</span> for doctor + typecheck + lint + build.
        </div>

        <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
          {report.checks.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-white">{statusIcon(item.status)} {item.label}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-zinc-500">{item.detail}</p>
                  {item.remediation ? <p className="mt-2 text-xs leading-5 text-amber-200/85">Fix: {item.remediation}</p> : null}
                </div>
                {statusBadge(item.status)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh doctor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
