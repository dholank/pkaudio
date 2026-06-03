#!/usr/bin/env tsx

import { cleanRobloxAudioTitle } from "@/lib/roblox/metadata";
import { renderAssetName } from "@/lib/roblox/upload";

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const cases: Array<[raw: string | null | undefined, expected: string]> = [
  ["Artist - Song Name (Official Audio)", "Song Name"],
  ["Artist - Song Name - Lirik Terjemahan Indonesia", "Song Name"],
  ["Artist - Song Name | Lirik Terjemahan", "Song Name"],
  ["Artist - Song Name - Lyrics", "Song Name"],
  ["Artist - Song Name (Lyrics Translation)", "Song Name"],
  ["Artist - Song Name [Lirik Terjemahan Indonesia]", "Song Name"],
  ["Song Name Terjemahan Indonesia", "Song Name"],
  ["Lirik Terjemahan Indonesia - Song Name", "Song Name"],
  ["Artist - Lirik Terjemahan Indonesia", "Artist"],
  ["Lirik Terjemahan Indonesia", "PKAudio Upload"],
  ["Lyrics", "PKAudio Upload"],
  [null, "PKAudio Upload"],
];

for (const [raw, expected] of cases) {
  assertEqual(cleanRobloxAudioTitle(raw), expected, `cleanRobloxAudioTitle(${JSON.stringify(raw)})`);
}

assertEqual(
  renderAssetName("{title}", { title: cleanRobloxAudioTitle("Artist - Song Name - Lirik Terjemahan Indonesia"), jobId: "abcdef123456", platform: "youtube" }),
  "Song Name",
  "renderAssetName clean-title default",
);

assertEqual(
  renderAssetName("{platform} - {title} ({id})", { title: "Song Name", jobId: "abcdef123456", platform: "youtube" }),
  "youtube - Song Name (abcdef12)",
  "renderAssetName token replacement",
);

const longName = renderAssetName("{title}", { title: "A".repeat(80), jobId: "abcdef123456", platform: "youtube" });
assert(longName.length === 50, "renderAssetName should cap Roblox display name to 50 chars");

console.log("Roblox title metadata smoke passed.");
