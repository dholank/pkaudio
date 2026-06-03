const FALLBACK_TITLE = "PKAudio Upload";
export const ROBLOX_AUDIO_DESCRIPTION = "Uploaded By PK Audio";

const DASH_SPLIT_RE = /\s+[-–—|:]\s+/;
const BRACKET_NOISE_RE = /[([{][^\])}]*?(?:official\s*(?:music\s*)?(?:video|audio)|lyrics?|lyric\s*video|visuali[sz]er|mv|music\s*video|audio\s*only|hd|4k|8k)[^\])}]*?[\])}]/gi;
const TRAILING_NOISE_RE = /(?:\s+[-–—|:]\s*)?(?:official\s*(?:music\s*)?(?:video|audio)|lyrics?|lyric\s*video|visuali[sz]er|mv|music\s*video|audio\s*only|hd|4k|8k|topic)\s*$/gi;
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
    const next = stripEmptyBrackets(
      current
        .replace(ARTIST_CHANNEL_RE, "")
        .replace(BRACKET_NOISE_RE, " ")
        .replace(TRAILING_NOISE_RE, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (next === current) break;
    current = next;
  }
  return current;
}

function maybeTakeSongSide(value: string) {
  const parts = value.split(DASH_SPLIT_RE).map((part) => removeKnownNoise(part).trim()).filter(Boolean);
  if (parts.length < 2) return value;

  const last = parts[parts.length - 1];
  const first = parts[0];

  // Most YouTube/SoundCloud music titles are "Artist - Song". Prefer the right side.
  // If the right side is only a known channel suffix/noise, keep the left side.
  if (/^(topic|lyrics?|official|audio)$/i.test(last)) return first;
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
