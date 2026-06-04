"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AUDIO_SAFETY_MODE_PRESETS, type AudioQuality, type AudioSafetyMode } from "@/lib/audio/options";
import { createAudioPresetRequest } from "@/lib/presets/client";
import type { AudioPresetView } from "@/lib/presets/types";
import type { AppSettingsView } from "@/lib/settings/types";
import type { CredentialView } from "@/lib/credentials/types";

export type BatchSettingsPayload = {
  speed: number;
  amplifyDb: number;
  targetLufs: number;
  quality: AudioQuality;
  audioSafetyMode: AudioSafetyMode;
  headroomDb: number;
  limiterEnabled: boolean;
  uploadEnabled: boolean;
  credentialId: string | null;
  assetNamePattern: string;
};

type BatchAudioSettingsOptions = {
  initialSettings: AppSettingsView;
  initialPresets: AudioPresetView[];
  initialCredentials: CredentialView[];
  defaultPresetName?: string;
  saveDescription?: string;
};

const noCredentialId = "";

export function useBatchAudioSettings({
  initialSettings,
  initialPresets,
  initialCredentials,
  defaultPresetName = "Custom preset",
  saveDescription = "Saved from preset.",
}: BatchAudioSettingsOptions) {
  const defaultPreset = useMemo(
    () => initialPresets.find((preset) => preset.isDefault) ?? null,
    [initialPresets],
  );
  const defaultCredentialExists = initialSettings.defaultCredentialId
    ? initialCredentials.some((c) => c.id === initialSettings.defaultCredentialId)
    : false;
  const presetCredentialExists = defaultPreset?.credentialId
    ? initialCredentials.some((c) => c.id === defaultPreset.credentialId)
    : false;

  // ——— presets ———
  const [presets, setPresets] = useState(initialPresets);
  const [selectedPresetId, setSelectedPresetId] = useState(defaultPreset?.id ?? "none");
  const [presetName, setPresetName] = useState(defaultPresetName);
  const [savingPreset, setSavingPreset] = useState(false);

  // ——— audio settings ———
  const [speed, setSpeed] = useState(defaultPreset?.speed ?? initialSettings.defaultSpeed);
  const [amplifyDb, setAmplifyDb] = useState(defaultPreset?.amplifyDb ?? initialSettings.defaultAmplifyDb);
  const [targetLufs, setTargetLufs] = useState(defaultPreset?.targetLufs ?? initialSettings.defaultTargetLufs);
  const [quality, setQuality] = useState<AudioQuality>(defaultPreset?.quality ?? initialSettings.defaultQuality);
  const [audioSafetyMode, setAudioSafetyMode] = useState<AudioSafetyMode>(
    defaultPreset?.audioSafetyMode ?? initialSettings.defaultAudioSafetyMode,
  );
  const [headroomDb, setHeadroomDb] = useState(defaultPreset?.headroomDb ?? initialSettings.defaultHeadroomDb);
  const [limiterEnabled, setLimiterEnabled] = useState(defaultPreset?.limiterEnabled ?? initialSettings.defaultLimiterEnabled);

  // ——— upload settings ———
  const [uploadEnabled, setUploadEnabled] = useState(defaultPreset?.uploadEnabled ?? initialSettings.defaultUploadEnabled);
  const [selectedCredential, setSelectedCredential] = useState(
    presetCredentialExists
      ? (defaultPreset?.credentialId ?? noCredentialId)
      : defaultCredentialExists
        ? (initialSettings.defaultCredentialId ?? noCredentialId)
        : (initialCredentials[0]?.id ?? noCredentialId),
  );
  const [assetNamePattern, setAssetNamePattern] = useState(
    defaultPreset?.assetNamePattern ?? initialSettings.defaultAssetNamePattern,
  );

  // ——— batch payload builder ———
  const batchPayload: BatchSettingsPayload = {
    speed,
    amplifyDb,
    targetLufs,
    quality,
    audioSafetyMode,
    headroomDb,
    limiterEnabled,
    uploadEnabled,
    credentialId: uploadEnabled && selectedCredential ? selectedCredential : null,
    assetNamePattern,
  };

  // ——— apply preset ———
  const applyPreset = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId);
      if (presetId === "none") return;
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;
      setSpeed(preset.speed);
      setAmplifyDb(preset.amplifyDb);
      setTargetLufs(preset.targetLufs);
      setQuality(preset.quality);
      setAudioSafetyMode(preset.audioSafetyMode);
      setHeadroomDb(preset.headroomDb);
      setLimiterEnabled(preset.limiterEnabled);
      setUploadEnabled(preset.uploadEnabled);
      setSelectedCredential(
        preset.credentialId && initialCredentials.some((c) => c.id === preset.credentialId)
          ? preset.credentialId
          : (initialCredentials[0]?.id ?? noCredentialId),
      );
      setAssetNamePattern(preset.assetNamePattern);
      toast.success(`Applied preset: ${preset.name}.`);
    },
    [presets, initialCredentials],
  );

  // ——— save current as preset ———
  const saveCurrentAsPreset = useCallback(async (): Promise<AudioPresetView | null> => {
    if (!presetName.trim()) {
      toast.error("Preset name is required.");
      return null;
    }
    setSavingPreset(true);
    try {
      const result = await createAudioPresetRequest({
        name: presetName.trim(),
        description: saveDescription,
        speed,
        amplifyDb,
        targetLufs,
        quality,
        audioSafetyMode,
        headroomDb,
        limiterEnabled,
        uploadEnabled,
        credentialId: uploadEnabled && selectedCredential ? selectedCredential : null,
        assetNamePattern,
        isDefault: false,
      });
      setPresets((current) => [result.preset, ...current]);
      setSelectedPresetId(result.preset.id);
      toast.success(`Preset saved: ${result.preset.name}.`);
      return result.preset;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preset.");
      return null;
    } finally {
      setSavingPreset(false);
    }
  }, [presetName, saveDescription, speed, amplifyDb, targetLufs, quality, audioSafetyMode, headroomDb, limiterEnabled, uploadEnabled, selectedCredential, assetNamePattern]);

  // ——— handle safety mode change ———
  const handleSafetyModeChange = useCallback((mode: AudioSafetyMode) => {
    setAudioSafetyMode(mode);
    if (mode === "custom") return;
    const preset = AUDIO_SAFETY_MODE_PRESETS[mode];
    setQuality(preset.quality);
    setLimiterEnabled(preset.limiterEnabled);
    setHeadroomDb(preset.headroomDb);
    setTargetLufs(preset.targetLufs);
    if (preset.amplifyDb !== undefined) setAmplifyDb(preset.amplifyDb);
  }, []);

  return {
    // state
    presets,
    setPresets,
    selectedPresetId,
    setSelectedPresetId,
    presetName,
    setPresetName,
    savingPreset,

    // audio settings
    speed,
    setSpeed,
    amplifyDb,
    setAmplifyDb,
    targetLufs,
    setTargetLufs,
    quality,
    setQuality,
    audioSafetyMode,
    setAudioSafetyMode,
    headroomDb,
    setHeadroomDb,
    limiterEnabled,
    setLimiterEnabled,

    // upload settings
    uploadEnabled,
    setUploadEnabled,
    selectedCredential,
    setSelectedCredential,
    assetNamePattern,
    setAssetNamePattern,

    // helpers
    applyPreset,
    saveCurrentAsPreset,
    handleSafetyModeChange,
    batchPayload,
  } as const;
}
