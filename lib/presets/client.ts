import type { AudioPresetView } from "@/lib/presets/types";
import type { AudioPresetPayloadInput, AudioPresetPatchInput } from "@/lib/presets/validation";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}

export async function fetchAudioPresets() {
  return parseResponse<{ presets: AudioPresetView[] }>(await fetch("/api/presets"));
}

export async function createAudioPresetRequest(payload: AudioPresetPayloadInput) {
  return parseResponse<{ preset: AudioPresetView }>(
    await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateAudioPresetRequest(id: string, payload: AudioPresetPatchInput) {
  return parseResponse<{ preset: AudioPresetView }>(
    await fetch(`/api/presets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function deleteAudioPresetRequest(id: string) {
  return parseResponse<{ preset: AudioPresetView }>(await fetch(`/api/presets/${id}`, { method: "DELETE" }));
}
