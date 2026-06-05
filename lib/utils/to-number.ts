/**
 * Parses a numeric input string safely.
 * - Returns the number if valid (finite).
 * - Returns `null` for empty string or "-" (user is typing negative).
 * - Returns `fallback` for other invalid input.
 */
export function toNumber(value: string, fallback: number): number | null {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}
