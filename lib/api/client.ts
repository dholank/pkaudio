/**
 * Shared API helpers for client-side fetch wrappers.
 * Every function parses JSON, extracts `error`, and throws consistently.
 */

export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status}).`);
  }
  return payload;
}

export async function getJson<T>(url: string): Promise<T> {
  return apiJson<T>(url, { cache: "no-store" });
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  return apiJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  return apiJson<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteJson<T>(url: string, body?: unknown): Promise<T> {
  return apiJson<T>(url, {
    method: "DELETE",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
