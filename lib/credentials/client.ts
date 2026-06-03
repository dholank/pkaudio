import type { CredentialView, CreatorType } from "@/lib/credentials/types";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export async function fetchCredentials() {
  const payload = await parseResponse<{ credentials: CredentialView[] }>(
    await fetch("/api/credentials", { cache: "no-store" }),
  );
  return payload.credentials;
}

export async function createCredentialRequest(input: {
  name: string;
  creatorType: CreatorType;
  creatorId: string;
  apiKey: string;
}) {
  const payload = await parseResponse<{ credential: CredentialView }>(
    await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return payload.credential;
}

export async function testCredentialRequest(id: string) {
  const payload = await parseResponse<{ credential: CredentialView }>(
    await fetch(`/api/credentials/${id}/test`, { method: "POST" }),
  );
  return payload.credential;
}

export async function deleteCredentialRequest(id: string) {
  await parseResponse<{ ok: true }>(await fetch(`/api/credentials/${id}`, { method: "DELETE" }));
}
