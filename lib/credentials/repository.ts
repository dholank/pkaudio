import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { credentials, type CredentialRow } from "@/lib/db/schema";
import { decryptApiKey, encryptApiKey, maskApiKey } from "@/lib/credentials/crypto";
import type { CredentialCreateInput, CredentialUpdateInput } from "@/lib/credentials/validation";
import type { CredentialStatus, CredentialView, CreatorType } from "@/lib/credentials/types";

function formatTimestamp(timestamp: number | null) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

export function toCredentialView(row: CredentialRow): CredentialView {
  return {
    id: row.id,
    name: row.name,
    creatorType: row.creatorType,
    creatorId: row.creatorId,
    keyPreview: row.keyPreview,
    status: row.status,
    lastUsedAt: formatTimestamp(row.lastUsedAt),
    testedAt: formatTimestamp(row.testedAt),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function listCredentials() {
  const rows = getDb().select().from(credentials).all();
  return rows.map(toCredentialView);
}

export async function getCredentialById(id: string) {
  const row = getDb().select().from(credentials).where(eq(credentials.id, id)).get();
  return row ?? null;
}

export async function createCredential(input: CredentialCreateInput) {
  const now = Date.now();
  const row = {
    id: randomUUID(),
    name: input.name,
    creatorType: input.creatorType,
    creatorId: input.creatorId,
    keyPreview: maskApiKey(input.apiKey),
    encryptedApiKey: encryptApiKey(input.apiKey),
    status: "untested" as CredentialStatus,
    lastUsedAt: null,
    testedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  getDb().insert(credentials).values(row).run();
  return toCredentialView(row);
}

export async function updateCredential(id: string, input: CredentialUpdateInput) {
  const existing = await getCredentialById(id);
  if (!existing) return null;

  const patch: Partial<typeof credentials.$inferInsert> = {
    updatedAt: Date.now(),
  };

  if (input.name !== undefined) patch.name = input.name;
  if (input.creatorType !== undefined) patch.creatorType = input.creatorType;
  if (input.creatorId !== undefined) patch.creatorId = input.creatorId;
  if (input.apiKey !== undefined) {
    patch.encryptedApiKey = encryptApiKey(input.apiKey);
    patch.keyPreview = maskApiKey(input.apiKey);
    patch.status = "untested";
    patch.testedAt = null;
  }

  getDb().update(credentials).set(patch).where(eq(credentials.id, id)).run();
  const updated = await getCredentialById(id);
  return updated ? toCredentialView(updated) : null;
}

export async function deleteCredential(id: string) {
  const result = getDb().delete(credentials).where(eq(credentials.id, id)).run();
  return result.changes > 0;
}

export async function testCredential(id: string) {
  const existing = await getCredentialById(id);
  if (!existing) return null;

  let status: CredentialStatus = "failed";

  try {
    const apiKey = decryptApiKey(existing.encryptedApiKey);
    status = apiKey.trim().length >= 16 ? "active" : "failed";
  } catch {
    status = "failed";
  }

  const now = Date.now();
  getDb()
    .update(credentials)
    .set({ status, testedAt: now, updatedAt: now })
    .where(eq(credentials.id, id))
    .run();

  const updated = await getCredentialById(id);
  return updated ? toCredentialView(updated) : null;
}

export async function getCredentialForUpload(id: string) {
  const row = await getCredentialById(id);
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    creatorType: row.creatorType as CreatorType,
    creatorId: row.creatorId,
    apiKey: decryptApiKey(row.encryptedApiKey),
  };
}

export async function recordCredentialUse(id: string, status: CredentialStatus = "active") {
  const now = Date.now();
  getDb()
    .update(credentials)
    .set({ status, lastUsedAt: now, testedAt: now, updatedAt: now })
    .where(eq(credentials.id, id))
    .run();

  const updated = await getCredentialById(id);
  return updated ? toCredentialView(updated) : null;
}
