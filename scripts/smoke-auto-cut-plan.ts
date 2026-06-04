#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { formatTrimPartTitle, planFixedTrimSegments } from "@/lib/trim/auto-cut";

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

const exact = planFixedTrimSegments({ durationSec: 600, segmentSec: 300 });
assert.equal(exact.length, 2, "600s audio should produce exactly two 5-minute parts");
assert.deepEqual(
  exact.map((part) => ({ index: part.index, total: part.total, startSec: part.startSec, durationSec: round(part.durationSec) })),
  [
    { index: 1, total: 2, startSec: 0, durationSec: 300 },
    { index: 2, total: 2, startSec: 300, durationSec: 300 },
  ],
  "Exact multiples should not create an empty trailing part",
);

const uneven = planFixedTrimSegments({ durationSec: 721.42, segmentSec: 300 });
assert.equal(uneven.length, 3, "721.42s audio should produce three fixed parts");
assert.deepEqual(
  uneven.map((part) => ({ index: part.index, total: part.total, startSec: part.startSec, durationSec: round(part.durationSec) })),
  [
    { index: 1, total: 3, startSec: 0, durationSec: 300 },
    { index: 2, total: 3, startSec: 300, durationSec: 300 },
    { index: 3, total: 3, startSec: 600, durationSec: 121.42 },
  ],
  "Last part should contain only remaining audio duration",
);

assert.equal(formatTrimPartTitle("Artist - Song Name", uneven[0]), "Artist - Song Name Part 01/03");
assert.equal(formatTrimPartTitle(null, uneven[2]), "PKAudio Upload Part 03/03");
assert.throws(() => planFixedTrimSegments({ durationSec: 0, segmentSec: 300 }), /positive duration/i);

console.log("[smoke] auto-cut fixed segment planning passed.");
