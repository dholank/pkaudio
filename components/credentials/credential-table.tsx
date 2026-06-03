"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CredentialStatusBadge } from "@/components/credentials/credential-status-badge";
import type { CredentialView } from "@/lib/credentials/types";

export function CredentialTable({
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
    <Table>
      <TableHeader>
        <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Target ID</TableHead>
        <TableHead>Key Preview</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Used</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {credentials.map((credential) => (
          <TableRow key={credential.id}>
            <TableCell className="font-medium text-white">{credential.name}</TableCell>
            <TableCell className="capitalize text-zinc-400">{credential.creatorType}</TableCell>
            <TableCell className="font-mono text-zinc-400">
              <span className="mr-2 text-[11px] uppercase tracking-wide text-zinc-600">{credential.creatorType === "group" ? "Group" : "User"}</span>
              {credential.creatorId}
            </TableCell>
            <TableCell className="font-mono text-zinc-400">{credential.keyPreview}</TableCell>
            <TableCell><CredentialStatusBadge status={credential.status} /></TableCell>
            <TableCell className="text-zinc-500">{credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString() : "Never"}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onTest(credential.id)} disabled={busyId === credential.id}>
                  <RotateCcw /> {busyId === credential.id ? "Testing" : "Test"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(credential.id)} disabled={busyId === credential.id} className="text-rose-200 hover:text-rose-100">
                  <Trash2 />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
