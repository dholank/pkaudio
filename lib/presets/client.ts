import { postJson, getJson, deleteJson, patchJson } from "@/lib/api/client";
import type { AudioPresetView } from "@/lib/presets/types";
import type { AudioPresetPayloadInput, AudioPresetPatchInput } from "@/lib/presets/validation";

export async function fetchAudioPresets() {
  const payload = await getJson<{ presets: AudioPresetView[] }>("/api/presets");
  return payload.presets;
}

export async function createAudioPresetRequest(payload: AudioPresetPayloadInput) {
  return postJson<{ preset: AudioPresetView }>("/api/presets", payload);
}

export async function updateAudioPresetRequest(id: string, payload: AudioPresetPatchInput) {
  return patchJson<{ preset: AudioPresetView }>(`/api/presets/${id}`, payload);
}

export async function deleteAudioPresetRequest(id: string) {
  return deleteJson<{ preset: AudioPresetView }>(`/api/presets/${id}`);
}
