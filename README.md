# PKAudio

PKAudio is a localhost-first Roblox audio converter dashboard for private use on WSL2/Linux.

```txt
YouTube / SoundCloud URL
  -> queued in local SQLite
  -> local worker downloads/extracts audio with yt-dlp
  -> ffprobe detects the real input sample rate
  -> FFmpeg applies playback-rate speed + two-pass LUFS normalization + gain trim + peak limiter
  -> OGG Vorbis output is written to outputs/
  -> upload-enabled jobs enter converted status after local OGG is ready
  -> serial upload worker uploads converted OGGs using encrypted Open Cloud API key
  -> job is marked done after upload returns an asset ID
  -> worker polls Roblox moderation asynchronously on later ticks
```

## Current Status

**Phase 22 is implemented:** conversion and Roblox upload are split into separate worker lanes.

Implemented:

- Next.js App Router dashboard with `/convert`, `/queue`, `/credentials`, `/history`, and `/settings`.
- SQLite local persistence with Drizzle schema and automatic migrations.
- AES-256-GCM encrypted Roblox API key storage. API responses show masked previews only.
- Real batch/job queue in SQLite with job logs, retry/cancel/delete, history filters, and CSV/JSON export.
- Local worker (`npm run worker`) with parallel conversion slots for download, probe, convert, diagnostics, and waveform sidecars, plus one serial Roblox upload lane and async moderation polling.
- Split status pipeline: `queued -> downloading -> probing -> converting -> converted -> uploading -> done`, where `converted` means the local OGG is ready and upload is waiting for the batch conversion gate/serial upload lane.
- High-quality OGG Vorbis output (`q5`-`q8`) with advanced audio safety modes: Roblox Safe, High Quality, Loud, and Custom.
- Playback-rate speed effect via `asetrate={input_sample_rate}*{speed},aresample=44100`; this changes speed and pitch naturally.
- Two-pass LUFS normalization for consistent perceived volume (`target_lufs`) plus dynamic peak limit from `-6` to `-1 dBFS` using `alimiter=limit={10^(headroomDb/20)}`.
- Worker-side output diagnostics: duration, file size, peak/mean volume, sample rate, channels.
- Waveform/loudness graph sidecars and lazy UI previews.
- Roblox Open Cloud Assets upload using multipart `assetType: "Audio"`, selected user/group creator target, and encrypted credential decrypt only in worker memory.
- Roblox operation and moderation status tracking in Queue and History.
- Persistent Settings: default audio/upload options, worker concurrency/retry tuning, cleanup presets, audio presets, storage stats.
- Storage cleanup for `outputs/` and `tmp/jobs/` with traversal-safe path handling.
- Backup/restore in Settings: DB-only or DB + outputs archive, rollback snapshot before restore, and restore safety checks.
- Final QA Doctor in Settings and CLI (`npm run qa`, `npm run qa:full`) for WSL2/local readiness.

Known limitations:

- `/api/credentials/:id/test` validates Assets API authentication behavior, but deep creator quota/permission failures can still appear during an actual upload.
- Auto-upload jobs wait in `converted` until every job in the same batch is past download/probe/convert, then uploads run one-at-a-time to avoid Roblox API bottlenecks and duplicate upload risk.
- Roblox moderation/processing is external and can delay asset usability after upload.
- `next build` may emit a Turbopack NFT tracing warning for server-side filesystem helper imports; treat it as warning-only if the command exits `0`.

## Stack

```txt
Next.js App Router
TypeScript
Tailwind CSS
shadcn-style local UI components
Radix UI primitives
lucide-react icons
sonner toasts
SQLite
Drizzle ORM
better-sqlite3
AES-256-GCM via Node crypto
zod validation
tsx local scripts
ffmpeg / ffprobe / yt-dlp native binaries
Roblox Open Cloud Assets API
```

## Requirements

Use the Linux filesystem in WSL2 for best performance:

```txt
~/workspace/pkaudio
```

Avoid `/mnt/c/...` because SQLite, downloads, and media processing are much slower there.

Required Node tooling:

```bash
node -v
npm -v
```

Required media binaries:

```bash
ffmpeg -version
ffprobe -version
yt-dlp --version
```

Install on Ubuntu/WSL2:

```bash
sudo apt update
sudo apt install ffmpeg python3-pip
python3 -m pip install --user -U yt-dlp --break-system-packages
```

Make sure `~/.local/bin` is in `PATH` so `yt-dlp` is visible.

## Environment

Create `.env.local`:

```env
ENCRYPTION_MASTER_KEY=your_32_byte_base64_key
PKAUDIO_DB_PATH=./data/pkaudio.sqlite
```

Generate a master key:

```bash
openssl rand -base64 32
```

Rules:

- `ENCRYPTION_MASTER_KEY` must decode to exactly 32 bytes.
- This key is required to decrypt saved Roblox API keys.
- If the key is lost, saved API keys cannot be recovered.
- `.env.local` is ignored by git, is not included in PKAudio backups, and must never be committed.
- Do not rotate `ENCRYPTION_MASTER_KEY` after credentials exist unless you re-save/re-encrypt stored keys.
- Worker and QA scripts load `.env.local` automatically.

Optional Roblox/worker overrides:

```env
PKAUDIO_ROBLOX_ASSETS_BASE_URL=https://apis.roblox.com/assets/v1
PKAUDIO_ROBLOX_POLL_ATTEMPTS=30
PKAUDIO_ROBLOX_POLL_INTERVAL_MS=2500
PKAUDIO_MODERATION_POLL_MAX_ATTEMPTS=40
PKAUDIO_MODERATION_POLL_INTERVAL_MS=15000
PKAUDIO_MODERATION_POLL_MAX_PER_TICK=8
PKAUDIO_WORKER_INTERVAL_MS=3000
PKAUDIO_WORKER_RECOVERY_INTERVAL_MS=60000
PKAUDIO_WORKER_STALE_JOB_MS=1800000
PKAUDIO_WAVEFORM_BINS=240
```

## Install

```bash
cd ~/workspace/pkaudio
npm install
```

## Run

One-command local app + worker:

```bash
npm run pkaudio
```

Open:

```txt
http://127.0.0.1:3000
```

or from a Windows browser:

```txt
http://localhost:3000
```

Manual two-terminal mode:

```bash
npm run dev
npm run worker
```

One-shot worker test:

```bash
npm run worker:once
```

## Final QA / Doctor

Run doctor-only checks:

```bash
npm run qa
```

Run doctor + TypeScript + ESLint + production build:

```bash
npm run qa:full
```

The same checks are visible in `/settings` → **Final QA Doctor**.

Doctor checks include:

- Project is not running under `/mnt/c`.
- `.env.local` exists.
- `ENCRYPTION_MASTER_KEY` decodes to 32 bytes.
- SQLite connects and `PRAGMA quick_check` returns `ok`.
- SQLite path is on Linux filesystem.
- `ffmpeg`, `ffprobe`, and `yt-dlp` are installed and visible in `PATH`.
- `outputs/`, `tmp/jobs/`, and `backups/` are writable.
- Storage stats can be read.
- At least one backup exists.
- Worker heartbeat and active jobs are visible.

`WARN` items are safe to review manually. `FAIL` items should be fixed before conversion/upload work.

## Pages

```txt
/convert       Main batch conversion form, presets/defaults, audio safety controls, upload options
/queue         Live job monitor, logs, cancel/retry/delete, audio preview, diagnostics, waveform, moderation status
/credentials   Encrypted Roblox credential management and auth test
/history       Search/filter/export queued, converted, completed, and failed jobs with diagnostics/moderation fields
/settings      Defaults, presets, system status, worker health, storage cleanup, backup/restore, final QA doctor
```

Root `/` redirects to `/convert`.

## Audio Pipeline

PKAudio uses playback-rate mode, not tempo-preserving mode. Speed-up also raises pitch naturally.

Limiter/normalize ON filter shape:

```txt
asetrate={input_sample_rate}*{speed},aresample=44100,loudnorm=I={targetLufs}:TP={headroomDb}:LRA=11:measured_*,volume={amplifyDb}dB,alimiter=limit={10^(headroomDb/20)}
```

Limiter OFF manual-gain shape:

```txt
asetrate={input_sample_rate}*{speed},aresample=44100,volume={amplifyDb}dB
```

Rules:

- Always detect source sample rate with `ffprobe`; never hardcode input sample rate.
- Output format: OGG Vorbis via `libvorbis`.
- Output target: `44100 Hz`, stereo.
- Quality presets: `q5`, `q6`, `q7`, `q8`.
- Safety modes:
  - Roblox Safe: q7, limiter/normalize on, `-14 LUFS` target, `-3 dBFS` peak limit.
  - High Quality: q8, limiter/normalize on, `-13 LUFS` target, `-2.5 dBFS` peak limit.
  - Loud: q7, limiter/normalize on, `-12 LUFS` target, `-2 dBFS` peak limit.
  - Custom: manual quality, target LUFS, gain trim, limiter, and peak limit.
- `amplifyDb` is now a gain trim after LUFS normalization when limiter/normalize is on; the final limiter still caps peaks at the configured peak limit. When limiter is off, `amplifyDb` behaves as simple manual gain.

Encoder args:

```txt
-c:a libvorbis -q:a 5|6|7|8 -ar 44100 -ac 2
```

Diagnostics shown/stored:

```txt
outputDurationSec
outputSizeBytes
outputPeakDb
outputMeanDb
outputSampleRate
outputChannels
waveform/loudness sidecar JSON
```

Roblox warning targets:

- Audio duration max `7:00` / `420s`.
- Upload request size max `20 MB`.
- Peak should stay under the configured peak limit; above `-1 dBFS` is clipping risk.
- Sample rate should be `44100 Hz`.
- Channels should be stereo / `2`.

Generated files:

```txt
outputs/
outputs/<file>.ogg.waveform.json
```

Temporary files:

```txt
tmp/jobs/<jobId>/
```

## Worker Pipeline Split

The worker intentionally separates CPU/disk-heavy conversion from network/API-heavy Roblox upload:

1. Conversion lane claims up to `maxConcurrentJobs` queued jobs per tick.
2. Each conversion job writes diagnostics and waveform artifacts, then:
   - local-only jobs become `done`, or
   - auto-upload jobs become `converted` with a saved `outputPath`.
3. Upload lane claims only one `converted` job at a time.
4. Upload lane waits until the job's batch has no remaining `queued/downloading/probing/converting` jobs before starting Roblox upload.
5. Failed upload retries reuse the existing converted OGG by returning the job to `converted` instead of re-downloading/re-converting.

This keeps FFmpeg throughput high while keeping Roblox upload serial and safer.

## Roblox Upload Setup

The serial upload lane uses Roblox Open Cloud Assets API:

```txt
POST https://apis.roblox.com/assets/v1/assets
GET  https://apis.roblox.com/assets/v1/operations/{operationId}
GET  https://apis.roblox.com/assets/v1/assets/{assetId}?readMask=moderationResult
```

Create request:

- Header: `x-api-key: <saved encrypted key>`
- Multipart field `request`: JSON with:
  - `assetType: "Audio"`
  - `displayName`
  - `description`
  - `creationContext.creator.userId` or `creationContext.creator.groupId`
- Multipart field `fileContent`: generated `.ogg`, content type `audio/ogg`

PKAudio metadata rules:

```txt
displayName = cleaned song title only
description = Uploaded By PK Audio
```

Open Cloud key checklist:

1. Create an API key in Roblox Creator Dashboard / Open Cloud.
2. Grant Assets API create/upload access.
3. Scope it to the correct user/group creator target.
4. In PKAudio `/credentials`, set `creatorType = user` and user ID, or `creatorType = group` and group ID.
5. Paste the API key once. PKAudio stores encrypted payload + masked preview only.
6. In `/convert`, enable Auto upload and select that credential.

## Backup / Restore

Settings → **Backup & Restore** supports:

- DB-only backup: SQLite data, credentials encrypted, jobs/history/settings/presets.
- Full backup: SQLite data + `outputs/` audio/waveform files.
- Download/delete local backup archives.
- Restore with automatic rollback backup before replacing SQLite.
- Restore outputs only when the selected backup includes them.

Important:

- Backups include encrypted Roblox credentials but **do not include `.env.local`**.
- Keep `ENCRYPTION_MASTER_KEY` separately; restored credentials need the same key.
- Stop `npm run worker` / `npm run pkaudio` before restore.
- Restore refuses to run while a worker heartbeat is online or jobs are active.

Backup files live in:

```txt
backups/*.tar.gz
backups/*.manifest.json
```

## Database

Default local DB path:

```txt
data/pkaudio.sqlite
```

Current core tables:

```txt
credentials
batches
jobs
job_logs
worker_heartbeats
settings
audio_presets
```

The app auto-creates and migrates tables when the database client is first used.

## API Routes

Credential routes:

```txt
GET    /api/credentials
POST   /api/credentials
GET    /api/credentials/:id
PATCH  /api/credentials/:id
DELETE /api/credentials/:id
POST   /api/credentials/:id/test
```

Batch/job routes:

```txt
GET    /api/batches
POST   /api/batches
GET    /api/jobs
GET    /api/jobs/:id
DELETE /api/jobs/:id
GET    /api/jobs/:id/logs
POST   /api/jobs/:id/cancel
POST   /api/jobs/:id/retry
POST   /api/jobs/:id/roblox-status
POST   /api/jobs/:id/roblox-moderation
POST   /api/jobs/recover
GET    /api/history/export?format=csv
GET    /api/history/export?format=json
```

Output/system/settings/backup routes:

```txt
GET    /api/outputs/:path?preview=1
GET    /api/waveforms/:path
GET    /api/storage
POST   /api/storage
GET    /api/system
GET    /api/system/doctor
GET    /api/settings
PATCH  /api/settings
GET    /api/presets
POST   /api/presets
PATCH  /api/presets/:id
DELETE /api/presets/:id
GET    /api/backups
POST   /api/backups
GET    /api/backups/:id
DELETE /api/backups/:id
POST   /api/backups/:id/restore
```

## Build / Check

```bash
npm run qa
npm run typecheck
npm run lint
npm run build
# or all together:
npm run qa:full
```

## Troubleshooting

### `yt-dlp not found`

```bash
python3 -m pip install --user -U yt-dlp --break-system-packages
export PATH="$HOME/.local/bin:$PATH"
yt-dlp --version
```

Add the PATH line to `~/.bashrc` if needed.

### SQLite or conversion feels slow

Make sure the project and DB are under Linux filesystem, not `/mnt/c`:

```bash
pwd
realpath data/pkaudio.sqlite
```

Expected:

```txt
/home/<user>/workspace/pkaudio
```

### Saved credentials fail after restore

Restore used a different or missing `ENCRYPTION_MASTER_KEY`. Put the original key back into `.env.local`, restart the app/worker, then test credentials again.

### Restore refuses to run

Stop worker/app first:

```bash
Ctrl+C  # in npm run pkaudio terminal
# or stop the npm run worker terminal
```

Then refresh Settings → Final QA Doctor and retry restore.

### Build warning about Turbopack NFT tracing

`next build` can warn that a server route imported filesystem helpers dynamically. If build exits `0` and shows `Compiled successfully`, this is currently warning-only for local usage.

## Security Rules

- Never store Roblox API keys in plaintext.
- Never log API keys or include them in errors/toasts.
- API responses must return masked previews only.
- Worker decrypts selected keys only temporarily in memory.
- Treat `.env.local`, SQLite DB files, backups, and logs as sensitive local files.
- Backups contain encrypted credentials; keep them private.

## Planning Docs

Additional planning docs are kept in:

```txt
docs/MVP_PLAN.md
docs/MVP_FEATURES.md
docs/MVP_RESULT.md
```
