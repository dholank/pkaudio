import { postJson, getJson, deleteJson } from "@/lib/api/client";
import type { CredentialView, CreatorType } from "@/lib/credentials/types";

export async function fetchCredentials() {
  const payload = await getJson<{ credentials: CredentialView[] }>("/api/credentials");
  return payload.credentials;
}

export async function createCredentialRequest(input: {
  name: string;
  creatorType: CreatorType;
  creatorId: string;
  apiKey: string;
}) {
  const payload = await postJson<{ credential: CredentialView }>("/api/credentials", input);
  return payload.credential;
}

export async function testCredentialRequest(id: string) {
  const payload = await postJson<{ credential: CredentialView }>(`/api/credentials/${id}/test`);
  return payload.credential;
}

export async function deleteCredentialRequest(id: string) {
  await deleteJson<{ ok: true }>(`/api/credentials/${id}`);
}
