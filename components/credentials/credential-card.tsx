"use client";

import { RotateCcw, Trash2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CredentialStatusBadge } from "@/components/credentials/credential-status-badge";
import type { CredentialView } from "@/lib/credentials/types";

type CredentialCardProps = {
  credential: CredentialView;
  onTest: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
};

function relativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CredentialCard({ credential, onTest, onDelete, busy }: CredentialCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/[0.13]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{credential.name}</h3>
            <CredentialStatusBadge status={credential.status} />
          </div>
          <p className="text-xs text-zinc-500">
            <span className="capitalize">{credential.creatorType}</span> {credential.creatorId}
            {" · "}
            <span className="font-mono">{credential.keyPreview}</span>
          </p>
          <p className="text-[11px] text-zinc-600">
            Last used: {relativeDate(credential.lastUsedAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => onTest(credential.id)} disabled={busy}>
            <RotateCcw /> {busy ? "Testing" : "Test"}
          </Button>
          <Button variant="outline" size="sm" className="border-rose-500/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10" onClick={() => onDelete(credential.id)} disabled={busy}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CredentialCardList({
  credentials,
  onTest,
  onDelete,
  busyId,
}: {
  credentials: CredentialView[];
  onTest: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  busyId: string | null;
}) {
  return (
    <div className="space-y-3">
      {credentials.map((credential) => (
        <CredentialCard
          key={credential.id}
          credential={credential}
          onTest={onTest}
          onDelete={onDelete}
          busy={busyId === credential.id}
        />
      ))}
    </div>
  );
}
