"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { CredentialFormCard } from "@/components/credentials/credential-form-card";
import { CredentialTable } from "@/components/credentials/credential-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCredentialRequest,
  deleteCredentialRequest,
  testCredentialRequest,
} from "@/lib/credentials/client";
import type { CredentialView, CreatorType } from "@/lib/credentials/types";

export function CredentialsManager({ initialCredentials }: { initialCredentials: CredentialView[] }) {
  const [credentials, setCredentials] = useState<CredentialView[]>(initialCredentials);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(input: { name: string; creatorType: CreatorType; creatorId: string; apiKey: string }) {
    setSubmitting(true);
    try {
      const credential = await createCredentialRequest(input);
      setCredentials((current) => [credential, ...current]);
      toast.success("Credential saved encrypted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save credential.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(id: string) {
    setBusyId(id);
    try {
      const credential = await testCredentialRequest(id);
      setCredentials((current) => current.map((item) => (item.id === id ? credential : item)));
      toast.success(`Credential status: ${credential.status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to test credential.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    const credential = credentials.find((item) => item.id === id);
    if (!window.confirm(`Delete credential "${credential?.name ?? id}"?`)) return;

    setBusyId(id);
    try {
      await deleteCredentialRequest(id);
      setCredentials((current) => current.filter((item) => item.id !== id));
      toast.success("Credential deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete credential.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/15 bg-emerald-500/8">
        <CardContent className="flex gap-3 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <div>
            <p className="font-medium text-emerald-100">Encrypted local storage active</p>
            <p className="mt-1 text-sm leading-6 text-emerald-100/75">
              API keys are encrypted with AES-256-GCM before SQLite storage. Full saved keys are never returned to the UI and are decrypted only in worker memory during upload.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Saved Credentials</CardTitle>
            <CardDescription>Real local SQLite credentials. Table values never include plaintext API keys.</CardDescription>
          </CardHeader>
          <CardContent>
            {credentials.length ? (
              <CredentialTable credentials={credentials} onTest={handleTest} onDelete={handleDelete} busyId={busyId} />
            ) : (
              <EmptyState icon={KeyRound} title="No Roblox credentials" description="Add an encrypted API key to upload converted audio automatically to Roblox Creator assets." actionLabel="Use the form on the right" />
            )}
          </CardContent>
        </Card>

        <CredentialFormCard onCreate={handleCreate} isSubmitting={submitting} />
      </div>
    </div>
  );
}
