"use client";

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CredentialView } from "@/lib/credentials/types";

export function RobloxUploadCard({
  credentials,
  selectedCredential,
  uploadEnabled,
  assetNamePattern,
  loading = false,
  onCredentialChange,
  onUploadEnabledChange,
  onAssetNamePatternChange,
}: {
  credentials: CredentialView[];
  selectedCredential: string;
  uploadEnabled: boolean;
  assetNamePattern: string;
  loading?: boolean;
  onCredentialChange: (value: string) => void;
  onUploadEnabledChange: (value: boolean) => void;
  onAssetNamePatternChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-cyan-300" /> Roblox Upload
          </CardTitle>
          <CardDescription>Choose an encrypted Open Cloud key for automatic Roblox audio asset upload after conversion.</CardDescription>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <span className="text-xs text-zinc-400">Auto upload</span>
          <Switch checked={uploadEnabled} onCheckedChange={onUploadEnabledChange} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label>Target credential</Label>
          <Select value={selectedCredential} onValueChange={onCredentialChange} disabled={!uploadEnabled || loading || credentials.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading credentials..." : credentials.length ? "Select credential" : "No credentials saved"} />
            </SelectTrigger>
            <SelectContent>
              {credentials.map((credential) => (
                <SelectItem key={credential.id} value={credential.id}>
                  {credential.name} — {credential.creatorType} {credential.creatorId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="roblox-title-pattern">Roblox title pattern</Label>
          <Input
            id="roblox-title-pattern"
            value={assetNamePattern}
            onChange={(event) => onAssetNamePatternChange(event.target.value)}
            placeholder="{title}"
            maxLength={120}
            disabled={loading}
          />
          <p className="text-xs leading-5 text-zinc-500">
            Tokens: <span className="font-mono text-zinc-300">{"{title}"}</span>, <span className="font-mono text-zinc-300">{"{id}"}</span>, <span className="font-mono text-zinc-300">{"{platform}"}</span>. Final Roblox title is cleaned and capped to 50 chars.
          </p>
        </div>
        <Button variant="outline" className="lg:mb-0" asChild>
          <Link href="/credentials">Manage Keys</Link>
        </Button>
        <div className="lg:col-span-3 rounded-xl border border-emerald-500/15 bg-emerald-500/8 px-3 py-3 text-xs leading-5 text-emerald-100/85">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>Saved keys are encrypted locally with AES-256-GCM. The worker decrypts the selected key only in memory while uploading to Roblox. Description stays fixed as “Uploaded By PK Audio”.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
