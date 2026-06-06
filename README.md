# PKAudio

PKAudio is a local-first Roblox audio converter dashboard for personal use on WSL2/Linux.

It downloads audio from YouTube or SoundCloud, converts it to Roblox-friendly OGG Vorbis, optionally uploads it to Roblox Open Cloud Assets, and gives you ready-to-paste Lua snippets for normal audio and Auto Cut audio groups.

## Features

- Local Next.js dashboard for converting and managing audio jobs.
- YouTube / SoundCloud download via `yt-dlp`.
- FFmpeg audio conversion to OGG Vorbis (`44100 Hz`, stereo).
- Playback-rate speed effect that changes speed and pitch naturally.
- LUFS normalization, gain trim, and true peak limiting for Roblox-safe output.
- Auto Cut mode for splitting long audio into ordered parts.
- SQLite queue/history with job logs, retry, cancel, delete, and export.
- Optional Roblox upload via Open Cloud Assets API.
- Encrypted local storage for Roblox API keys.
- Moderation/status polling after upload.
- Queue copy helpers:
  - normal Roblox Lua audio snippet (`SoundId`)
  - Auto Cut Roblox Lua snippet (`SoundIds` array)
- Backup/restore, storage cleanup, presets, worker settings, and QA doctor.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI components
- Radix UI primitives
- SQLite + Drizzle ORM + better-sqlite3
- Node crypto AES-256-GCM
- FFmpeg / ffprobe / yt-dlp
- Roblox Open Cloud Assets API

## Requirements

Recommended location in WSL2/Linux:

```bash
~/workspace/pkaudio
```

Avoid running this project from `/mnt/c/...` because SQLite and media processing are much slower on the Windows-mounted filesystem.

Required tools:

```bash
node -v
npm -v
ffmpeg -version
ffprobe -version
yt-dlp --version
```

Ubuntu/WSL2 install example:

```bash
sudo apt update
sudo apt install ffmpeg python3-pip
python3 -m pip install --user -U yt-dlp --break-system-packages
```

Make sure `~/.local/bin` is in your `PATH` so `yt-dlp` is available.

## Installation

```bash
git clone https://github.com/dholank/pkaudio.git
cd pkaudio
npm install
```

## Environment

Create `.env.local`:

```env
ENCRYPTION_MASTER_KEY=your_32_byte_base64_key
PKAUDIO_DB_PATH=./data/pkaudio.sqlite
```

Generate a valid master key:

```bash
openssl rand -base64 32
```

Important:

- `ENCRYPTION_MASTER_KEY` must decode to exactly 32 bytes.
- The key is required to decrypt saved Roblox API keys.
- If the key is lost, saved Roblox credentials cannot be recovered.
- `.env.local` is ignored by git and is not included in PKAudio backups.
- Do not rotate the key after saving credentials unless you re-save the credentials.

Optional overrides:

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

## Running Locally

Recommended command for normal use:

```bash
npm run pkaudio
```

This starts both:

- `npm run start` — production Next.js server on port `3000`
- `npm run worker` — local converter/upload worker

Open:

```txt
http://localhost:3000
```

Stop both processes with `Ctrl+C`.

Development mode with hot reload:

```bash
npm run dev
npm run worker
```

Production build:

```bash
npm run build
npm run start
```

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run start        # Production web server
npm run pkaudio      # Start web server + worker together
npm run worker       # Start media worker only
npm run worker:once  # Run one worker tick
npm run qa           # Local readiness checks
npm run qa:full      # QA + typecheck + lint + build
npm run smoke        # Smoke test suite
npm run verify       # typecheck + lint + build + smoke
```

## App Pages

```txt
/convert       Submit conversion batches and configure audio/upload options
/auto-cut      Split long audio into Roblox-ready parts
/queue         Monitor latest jobs, logs, previews, copy code, Roblox status
/credentials   Manage encrypted Roblox Open Cloud API keys
/history       Search, filter, export, and inspect older jobs
/settings      Defaults, presets, worker health, cleanup, backup, QA doctor
```

Root `/` redirects to `/convert`.

## Audio Pipeline

PKAudio uses playback-rate mode, not tempo-preserving mode. Increasing speed also raises pitch naturally.

With limiter/normalize enabled:

```txt
asetrate={input_sample_rate}*{speed},aresample=44100,loudnorm=I={targetLufs}:TP={headroomDb}:LRA=11:measured_*,volume={amplifyDb}dB,alimiter=limit={10^(headroomDb/20)}
```

With limiter disabled:

```txt
asetrate={input_sample_rate}*{speed},aresample=44100,volume={amplifyDb}dB
```

Audio rules:

- Input sample rate is detected with `ffprobe`.
- Output format is OGG Vorbis via `libvorbis`.
- Output sample rate is `44100 Hz`.
- Output channels are stereo.
- Quality presets are `q5`, `q6`, `q7`, and `q8`.
- Default Roblox Safe mode targets `-14 LUFS` and peak limit around `-3 dBFS`.

## Roblox Upload

PKAudio uploads audio through Roblox Open Cloud Assets API:

```txt
POST https://apis.roblox.com/assets/v1/assets
GET  https://apis.roblox.com/assets/v1/operations/{operationId}
GET  https://apis.roblox.com/assets/v1/assets/{assetId}?readMask=moderationResult
```

Setup checklist:

1. Create a Roblox Open Cloud API key.
2. Grant Assets API upload/create access.
3. Scope the key to the correct user or group creator.
4. Add the credential in `/credentials`.
5. In `/convert` or `/auto-cut`, enable Auto upload and select the credential.

Stored credentials are encrypted locally and only decrypted inside the worker process when needed.

## Copy Formats

Normal audio copy format:

```lua
{
	SongName = "Audio Title",
	SoundId = "rbxassetid://123456789",
	ImageId = "rbxassetid://131267688688616",
	PlaybackSpeed = 0.43,
},
```

Auto Cut copy format:

```lua
{
	SongName = "Audio Title",
	SoundIds = {
		"rbxassetid://111111111",
		"rbxassetid://222222222",
		"rbxassetid://333333333",
	},
	ImageId = "rbxassetid://95717589436679",
	PlaybackSpeed = 0.43,
},
```

## Data and Generated Files

Default local database:

```txt
data/pkaudio.sqlite
```

Generated audio:

```txt
outputs/
outputs/*.ogg
outputs/*.ogg.waveform.json
```

Temporary worker files:

```txt
tmp/jobs/
tmp/autocut/
```

Backup files:

```txt
backups/*.tar.gz
backups/*.manifest.json
```

These runtime folders are ignored by git.

## Backup and Restore

Settings → Backup & Restore supports:

- DB-only backup.
- Full backup with `outputs/` files.
- Restore with rollback snapshot.
- Optional output restore when the backup includes audio files.

Backups include encrypted Roblox credentials but do not include `.env.local`. Keep `ENCRYPTION_MASTER_KEY` separately.

## Project Structure

```txt
app/                 Next.js App Router pages and API routes
components/          UI and feature components
hooks/               Shared React hooks
lib/audio/           Audio option helpers and validation
lib/credentials/     Credential encryption and storage
lib/db/              SQLite client and schema
lib/jobs/            Queue repository, mappers, and types
lib/roblox/          Roblox API and Lua copy format helpers
lib/trim/            Auto Cut planning utilities
lib/worker/          Worker source/probe/convert/upload pipeline
scripts/             CLI scripts for worker, QA, smoke tests, startup
```

## QA

Run local readiness checks:

```bash
npm run qa
```

Run full verification:

```bash
npm run verify
```

`npm run verify` runs TypeScript, ESLint, production build, and smoke tests.

## Notes

- This project is designed for personal localhost usage, not public hosting.
- There is no authentication layer because the app is intended to run only on your machine.
- Keep `.env.local`, `data/`, `outputs/`, `tmp/`, and `backups/` out of git.
- Stop `npm run pkaudio` before restoring backups.
