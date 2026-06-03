"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreatorType } from "@/lib/credentials/types";

export function CredentialFormCard({
  onCreate,
  isSubmitting,
}: {
  onCreate: (input: { name: string; creatorType: CreatorType; creatorId: string; apiKey: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState("");
  const [creatorType, setCreatorType] = useState<CreatorType>("group");
  const [creatorId, setCreatorId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({ name, creatorType, creatorId, apiKey });
    setName("");
    setCreatorType("group");
    setCreatorId("");
    setApiKey("");
    setShowKey(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-cyan-300" /> Add Credential</CardTitle>
        <CardDescription>Save a Roblox Open Cloud API key encrypted in local SQLite. Grant it Assets API permission for creator asset upload.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credential-name">Display name</Label>
            <Input id="credential-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: PK Audio Group / Akun Utama" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="space-y-2">
              <Label>Creator type</Label>
              <Select value={creatorType} onValueChange={(value) => setCreatorType(value as CreatorType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creator-id">{creatorType === "group" ? "Group ID" : "User ID"}</Label>
              <Input
                id="creator-id"
                value={creatorId}
                onChange={(event) => setCreatorId(event.target.value)}
                placeholder={creatorType === "group" ? "Contoh: 3308646504" : "Contoh: 123456789"}
                className="font-mono"
                required
                inputMode="numeric"
              />
              <p className="text-xs leading-5 text-zinc-500">
                {creatorType === "group"
                  ? "Isi angka dari URL group Roblox, bukan User ID akun lu."
                  : "Isi Roblox User ID akun target upload."}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste Roblox Open Cloud API key"
                className="pr-10 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="absolute right-3 top-3.5 text-zinc-600 transition hover:text-zinc-300"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <Button className="w-full" disabled={isSubmitting}>
            <ShieldCheck /> {isSubmitting ? "Saving..." : "Save encrypted key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
