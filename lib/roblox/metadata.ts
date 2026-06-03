const FALLBACK_TITLE = "PKAudio Upload";
export const ROBLOX_AUDIO_DESCRIPTION = "Uploaded By PK Audio";

const DASH_SPLIT_RE = /\s+[-–—|:]\s+/;
const TITLE_NOISE_PATTERN = [
  "official\\s*(?:music\\s*)?(?:video|audio)",
  "lyric\\s*video",
  "lyrics?(?:\\s+(?:translation|translated|terjemahan(?:\\s+(?:indonesia|indo))?|indonesia|indo))?",
  "lirik(?:\\s+lagu)?(?:\\s+terjemahan(?:\\s+(?:indonesia|indo))?)?",
  "terjemahan(?:\\s+(?:indonesia|indo))?",
  "subtitles?(?:\\s+(?:indonesia|indo))?",
  "sub\\s*indo",
  "indo\\s*sub",
  "visuali[sz]er",
  "music\\s*video",
  "audio\\s*only",
  "mv",
  "hd",
  "4k",
  "8k",
  "topic",
].join("|");
const BRACKET_NOISE_RE = new RegExp(`[([{][^\\])}]*?(?:${TITLE_NOISE_PATTERN})[^\\])}]*?[\\])}]`, "gi");
const TRAILING_NOISE_RE = new RegExp(`(?:\\s+[-–—|:]\\s*|\\s+)?(?:${TITLE_NOISE_PATTERN})\\s*$`, "gi");
const LEADING_NOISE_RE = new RegExp(`^(?:${TITLE_NOISE_PATTERN})(?:\\s+[-–—|:]\\s*|\\s+)`, "gi");
const NOISE_ONLY_RE = new RegExp(`^(?:${TITLE_NOISE_PATTERN})(?:\\s*(?:[-–—|:/,])\\s*|\\s+(?:${TITLE_NOISE_PATTERN}))*$`, "i");
const FEATURE_RE = /\s+(?:ft\.?|feat\.?|featuring)\s+.+$/i;
const ARTIST_CHANNEL_RE = /\s+-\s+topic$/i;

function normalizeSeparators(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripControlAndUnsafe(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripEmptyBrackets(value: string) {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    const next = current
      .replace(/\s*[([{]\s*[\])}]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (next === current) break;
    current = next;
  }
  return current;
}

function removeKnownNoise(value: string) {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    if (NOISE_ONLY_RE.test(current)) return "";

    const next = stripEmptyBrackets(
      current
        .replace(ARTIST_CHANNEL_RE, "")
        .replace(BRACKET_NOISE_RE, " ")
        .replace(LEADING_NOISE_RE, "")
        .replace(TRAILING_NOISE_RE, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (next === current) break;
    current = next;
  }
  return NOISE_ONLY_RE.test(current) ? "" : current;
}

function maybeTakeSongSide(value: string) {
  const parts = value.split(DASH_SPLIT_RE).map((part) => removeKnownNoise(part).trim()).filter(Boolean);
  if (parts.length < 2) return value;

  const last = parts[parts.length - 1];
  const first = parts[0];

  // Most YouTube/SoundCloud music titles are "Artist - Song". Prefer the right side.
  // If the right side is only a known channel suffix/noise, keep the left side.
  if (NOISE_ONLY_RE.test(last)) return first;
  return last;
}

export function cleanRobloxAudioTitle(rawTitle: string | null | undefined) {
  const raw = stripControlAndUnsafe(normalizeSeparators(rawTitle ?? ""));
  if (!raw) return FALLBACK_TITLE;

  let cleaned = removeKnownNoise(raw);
  cleaned = maybeTakeSongSide(cleaned);
  cleaned = removeKnownNoise(cleaned);
  cleaned = cleaned.replace(FEATURE_RE, "");
  cleaned = removeKnownNoise(cleaned);
  cleaned = stripControlAndUnsafe(stripEmptyBrackets(cleaned));

  // Keep Roblox display names compact and avoid punctuation-only leftovers.
  cleaned = cleaned.replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, "").trim();
  if (!cleaned || !/[\p{L}\p{N}]/u.test(cleaned)) return FALLBACK_TITLE;

  return cleaned.slice(0, 50).trim() || FALLBACK_TITLE;
}
