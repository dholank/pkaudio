"use client";

import type { useBatchAudioSettings } from "@/hooks/use-batch-audio-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";

type BatchSettings = ReturnType<typeof useBatchAudioSettings>;

type PresetToolbarProps = {
  settings: BatchSettings;
  showNameInput?: boolean;
};

/**
 * Reusable preset toolbar for Convert and Auto Cut pages.
 * Renders preset selector + save input/button.
 */
export function PresetToolbar({ settings, showNameInput = false }: PresetToolbarProps) {
  const {
    presets,
    selectedPresetId,
    presetName,
    savingPreset,
    applyPreset,
    saveCurrentAsPreset,
  } = settings;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Star className="size-4 text-cyan-300" /> Audio Preset</CardTitle>
        <CardDescription>Apply a saved preset or save current settings.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] space-y-2">
          <Label>Preset</Label>
          <Select value={selectedPresetId} onValueChange={applyPreset}>
            <SelectTrigger><SelectValue placeholder="Select preset" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Custom current settings</SelectItem>
              {presets.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}{p.isDefault ? " — default" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showNameInput ? (
          <div className="space-y-2">
            <Label>Save as</Label>
            <Input value={presetName} onChange={(e) => settings.setPresetName(e.target.value)} placeholder="Fast SFX" />
          </div>
        ) : null}
        <Button variant="outline" onClick={() => void saveCurrentAsPreset()} disabled={savingPreset}>
          {savingPreset ? "Saving..." : "Save preset"}
        </Button>
      </CardContent>
    </Card>
  );
}
