# LUFS Normalization Refactor Plan

Goal: make PKAudio outputs sound more consistent across songs by using two-pass FFmpeg `loudnorm` when the safety limiter is enabled, while keeping Roblox-safe peak limiting.

## Approach

1. Keep the existing `headroomDb` storage column for compatibility, but present it as `Peak limit` in UI/copy.
2. Add `targetLufs` to settings, presets, batches, and jobs.
3. Treat `amplifyDb` as post-normalization gain trim when limiter/normalization is enabled; the final limiter still caps peaks at `headroomDb`. When limiter is off, keep it as simple manual gain.
4. Worker conversion path:
   - speed/pitch-coupled playback-rate filters
   - first-pass `loudnorm` analysis
   - second-pass `loudnorm` apply with measured stats
   - optional gain trim
   - `alimiter` safety ceiling keyed to `headroomDb`
   - OGG Vorbis encode
5. Update UI labels/help text, presets, CSV export, and docs.
6. Verify with smoke tests, typecheck, lint, build, and a real generated-audio FFmpeg smoke conversion.
