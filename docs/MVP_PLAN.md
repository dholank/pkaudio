# PKAudio — Final MVP Plan

## 1. Product Summary

PKAudio adalah website localhost untuk membuat audio Roblox dari sumber YouTube/SoundCloud.

Flow utama:

1. User memasukkan satu atau banyak URL YouTube/SoundCloud.
2. Website otomatis validasi URL dan mengambil preview metadata.
3. User memilih audio settings.
4. Sistem membuat batch job.
5. Worker download audio source.
6. Worker convert audio ke OGG Vorbis dengan playback-rate speed.
7. Hasil convert muncul di history.
8. User bisa download hasil OGG.
9. User bisa upload hasil OGG ke Roblox Creator Asset menggunakan Roblox credential yang tersimpan.
10. History menyimpan status convert, status upload, rbxassetid, logs, dan metadata source.

Target utama MVP:

- Stabil di WSL2 Ubuntu.
- Optimal untuk batch convert personal.
- Aman untuk menyimpan Roblox API key.
- Mudah dikembangkan setelah MVP.

---

## 2. Final Tech Stack

### 2.1 Fullstack Framework

- Next.js App Router
- TypeScript
- Node.js runtime untuk API routes dan server-side logic

Alasan:

- Satu codebase untuk frontend dan backend.
- Cocok untuk dashboard React.
- API routes cukup untuk CRUD, preview, upload trigger, dan SSE endpoint.
- TypeScript end-to-end membuat model data lebih konsisten.

---

### 2.2 UI & Styling

- Tailwind CSS
- shadcn/ui
- lucide-react
- sonner untuk toast/notification

Komponen utama:

- Data table untuk history.
- Sheet/drawer untuk Roblox Credentials side panel.
- Dialog/modal untuk logs dan upload Roblox.
- Badge untuk status job dan Roblox status.
- Toast untuk feedback action.

---

### 2.3 Client State, Table, Form, Validation

- TanStack Query untuk client data fetching, cache, mutation, dan polling.
- TanStack Table untuk history table filtering/sorting.
- React Hook Form untuk form handling.
- Zod untuk validation schema.

MVP status update:

- Gunakan TanStack Query polling dulu untuk stability.
- SSE bisa ditambahkan setelah MVP stabil.

Polling target:

- History/job list refresh setiap 2 detik saat ada active job.
- Polling bisa dimatikan/diringankan saat tidak ada active job.

---

### 2.4 Database

- SQLite
- Drizzle ORM
- better-sqlite3
- Drizzle Kit untuk migrations

Alasan:

- Zero-config untuk localhost.
- Cocok untuk data history, credentials, metadata, jobs.
- Drizzle ringan dan type-safe.

SQLite requirement:

- Database wajib disimpan di Linux filesystem WSL2, bukan `/mnt/c`.
- Aktifkan WAL mode untuk concurrency lebih aman.
- SQLite cukup untuk MVP personal/local.

---

### 2.5 Queue & Background Jobs

- Redis
- BullMQ
- Worker process terpisah dari Next.js web server.

Process architecture:

- Process 1: Next.js web server.
- Process 2: BullMQ audio worker.
- Process 3: Redis server.

BullMQ digunakan untuk:

- Batch jobs.
- Download queue.
- Convert queue.
- Upload queue jika dibutuhkan.
- Retry.
- Concurrency limit.
- Job progress.
- Job logs/events.

Concurrency MVP:

- Default audio conversion concurrency: 1–2 job parallel.
- Rekomendasi awal WSL2: concurrency 2 agar tidak membuat sistem lag.

---

### 2.6 Downloader

- System binary `yt-dlp`
- Node library `execa`

Requirement:

- Jangan menggunakan downloader NPM seperti `ytdl-core` untuk MVP.
- Gunakan `yt-dlp` system binary karena lebih stabil untuk YouTube/SoundCloud.
- `execa` dipakai untuk menjalankan binary, menangkap stdout/stderr, timeout, error, dan cancel process.

Use cases:

- Fetch metadata preview tanpa download.
- Download best audio source.
- Support cookies file optional jika dibutuhkan.

---

### 2.7 Audio Processing

- System binary `ffmpeg`
- System binary `ffprobe`
- Node library `execa`

Recommendation:

- Gunakan `execa` untuk menjalankan `ffmpeg` dan `ffprobe` secara eksplisit.
- Jangan wajib menggunakan `fluent-ffmpeg`; raw `ffmpeg` args lebih predictable untuk filter custom.
- Setiap command penting harus bisa dilog untuk debugging.

---

### 2.8 Roblox API

- Native `fetch` / undici-compatible request
- FormData untuk upload multipart
- Roblox Open Cloud API key

Use cases:

- API key introspection/validation.
- Upload OGG ke Creator Asset.
- Store response asset ID / operation ID.
- Optional status check untuk moderation/status asset.

---

### 2.9 Security

- Node.js native `crypto`
- AES-256-GCM untuk enkripsi Roblox API key
- Master key disimpan di `.env`
- Zod/env validation untuk memastikan env wajib tersedia

Security rules:

- Roblox API key tidak boleh disimpan plaintext.
- Full API key tidak boleh dikirim kembali ke frontend setelah disimpan.
- API key tidak boleh muncul di logs.
- API key tidak boleh muncul di error message.
- Dekripsi API key hanya dilakukan di memory saat worker/API perlu Roblox request.

---

## 3. WSL2 Ubuntu Requirements

Project dan storage wajib berada di Linux filesystem, contoh:

- `~/workspace/pkaudio`
- `/home/<user>/workspace/pkaudio`

Jangan menyimpan project, SQLite DB, storage audio, atau output OGG di:

- `/mnt/c/...`
- Windows Desktop/Documents/Downloads path

Alasan:

- Cross-OS filesystem WSL2 lambat.
- SQLite lebih rawan masalah jika DB berada di Windows mounted drive.
- Audio download/convert jauh lebih cepat di Linux filesystem.

System binary requirement:

- Redis server tersedia di Ubuntu.
- yt-dlp tersedia sebagai system command.
- ffmpeg tersedia sebagai system command.
- ffprobe tersedia sebagai system command.

Hot reload note:

- Jika file watcher Next.js bermasalah di WSL2, gunakan polling watcher env.

---

## 4. Audio Configuration Final

### 4.1 Output Format

Final output MVP:

- Format: OGG
- Codec: Vorbis
- Sample rate: 44100 Hz
- Channels: Stereo
- Quality: high quality Vorbis, target sekitar q7 atau setara

Roblox target:

- Output harus berupa audio OGG yang bisa diupload ke Roblox Creator Asset.

---

### 4.2 Speed Behavior

Speed menggunakan playback-rate behavior.

Artinya:

- Speed naik membuat durasi lebih pendek.
- Pitch/vokal ikut naik.
- Vokal bisa terdengar cempreng/chipmunk.
- Tidak menggunakan tempo-preserve.
- Tidak menggunakan `atempo`.
- Tidak menggunakan pitch correction untuk MVP.

Default:

- Speed default: 2.30x
- Speed range: 1.00x sampai 3.00x

Expected duration formula:

- Output duration = input duration / speed

Contoh:

- 234.44 detik dengan speed 2.30x menjadi sekitar 101.93 detik.

---

### 4.3 Amplification Behavior

Amplification menggunakan dB gain.

Default:

- Amplification default: -4 dB
- Range: -20 dB sampai +20 dB

Behavior:

- Amplification diterapkan sebelum limiter/final safety processing.
- Positive dB membuat audio lebih keras.
- Negative dB membuat audio lebih pelan.

---

### 4.4 Critical Sample Rate Rule

Sistem wajib membaca input sample rate dengan `ffprobe` sebelum membuat playback-rate filter.

Rule final:

- `inputSampleRate = ffprobe(inputFile)`
- Playback-rate filter harus memakai `inputSampleRate * speed`
- Setelah itu resample ke 44100 Hz

Jangan hardcode input sample rate:

- Jangan hardcode 44100 sebagai input sample rate.
- Jangan hardcode 48000 sebagai input sample rate.

Alasan:

- YouTube/SoundCloud source bisa 44100 Hz, 48000 Hz, atau sample rate lain.
- Hardcode sample rate menyebabkan effective speed dan pitch salah.
- Bug yang harus dihindari: speed 2.30x menjadi sekitar 2.11x karena input 48000 Hz diproses dengan base 44100 Hz.

---

### 4.5 Final Audio Filter Concept

Pipeline audio final secara konsep:

1. Probe input sample rate.
2. Apply playback-rate speed using input sample rate.
3. Resample output ke 44100 Hz.
4. Jika limiter/normalize ON: jalankan 2-pass LUFS normalization untuk perceived loudness yang konsisten.
5. Apply gain trim dB (`amplifyDb`) setelah normalization, lalu final peak limiter.
6. Jika limiter OFF: apply manual gain langsung tanpa LUFS normalization.
7. Encode ke OGG Vorbis.
8. Probe output duration, size, peak, sample rate, channels.

Limiter target:

- Gunakan limiter/final safety processing agar output tidak terlalu clipping.
- Target peak limit default Roblox Safe: `-3 dBFS`.
- Target loudness default Roblox Safe: `-14 LUFS`.
- Gain trim tidak boleh menaikkan final peak melewati configured peak limit saat limiter aktif.

---

## 5. MVP Feature Requirements

## 5.1 Multiple URL Input

Requirement:

- User bisa paste banyak URL sekaligus.
- Satu URL menjadi satu job.
- Banyak URL menjadi satu batch.
- Invalid URL tidak menggagalkan seluruh batch.
- User bisa menghapus URL dari preview list sebelum convert.

---

## 5.2 Automatic URL Validation & Preview

Requirement:

- URL divalidasi otomatis saat user input.
- Gunakan debounce agar tidak terlalu banyak request.
- Sistem mendeteksi source type: YouTube/SoundCloud.
- Sistem fetch metadata tanpa download full audio.

Preview card menampilkan:

- Thumbnail
- Title
- Duration
- Source type
- Original URL
- Normalized URL jika tersedia
- Validation status

Validation status:

- loading
- valid
- invalid
- unsupported_source
- metadata_failed

---

## 5.3 Batch Jobs

Requirement:

- Batch memiliki batch ID.
- Batch menyimpan total jobs, completed jobs, failed jobs.
- Setiap job punya status sendiri.
- Job gagal tidak menghentikan job lain.
- Batch bisa ditampilkan di history.

---

## 5.4 Job Status

Processing status:

- queued
- downloading
- downloaded
- converting
- converted
- uploading
- uploaded
- failed
- cancelled

Roblox status:

- not_uploaded
- pending
- accepted
- rejected
- unknown

---

## 5.5 Job Logs

Setiap job harus punya logs.

Logs mencatat:

- Queue created
- Metadata preview result
- Download started
- Download completed
- Input probe result
- Conversion started
- Conversion completed
- Output probe result
- Upload started
- Upload result
- Errors

UI:

- Logs bisa dibuka dari history.
- Logs tampil sebagai dialog/modal.

---

## 5.6 History Dashboard

History table menampilkan:

- Thumbnail
- Title
- Source type
- Source URL
- Speed
- Amplification dB
- Output duration
- Output size
- Convert status
- Roblox status
- Roblox asset ID / rbxassetid
- Created date
- Actions

Actions:

- View logs
- Download OGG
- Retry
- Delete
- Upload to Roblox
- Check Roblox status

Filters/search:

- Search by title
- Filter by source type
- Filter by convert status
- Filter by Roblox status
- Sort newest/oldest

---

## 5.7 History CRUD

Requirement:

- List jobs.
- View job detail.
- Delete job.
- Retry job.
- Download output file.

Delete behavior:

- Delete DB row.
- Delete source file.
- Delete output file.
- Delete logs.

Retry behavior:

- Reset status to queued.
- Clear error.
- Clear stale output/upload fields if needed.
- Enqueue job again.

---

## 5.8 Roblox Credentials Side Panel

Requirement:

- Credentials tampil di right side panel/sheet.
- User bisa add credential.
- User bisa edit credential.
- User bisa delete credential.
- Full API key tidak pernah ditampilkan setelah save.

Credential fields:

- Label
- Creator type: user/group
- Creator ID
- Creator name optional
- Encrypted API key
- API key last 4 chars
- API key metadata optional
- Authorized user ID optional

---

## 5.9 Roblox Credential Validation

Validation checks:

- API key valid.
- API key enabled.
- API key not expired.
- API key has asset write scope.
- API key target matches selected user/group.

UI status:

- valid
- invalid
- expired
- disabled
- missing_scope
- wrong_creator_target
- unknown

---

## 5.10 Upload to Roblox

Requirement:

- Only converted jobs can be uploaded.
- User selects Roblox credential.
- User sets asset name.
- Description optional.
- Upload OGG output to Roblox Creator Asset.
- Save Roblox asset ID and/or operation ID.
- Set Roblox status to pending after upload success.

History display:

- rbxassetid format if asset ID exists.
- Roblox status.
- Upload error if failed.

---

## 5.11 Roblox Status Tracking

MVP requirement:

- Manual status check button.
- Store latest Roblox status.

Future:

- Auto polling pending assets.
- Background scheduled status check.
- Bulk status refresh.

---

## 6. Data Model Requirements

Core tables:

- audio_batches
- audio_jobs
- roblox_credentials
- job_logs optional, or file-based logs

Audio job stores:

- Source metadata
- Audio settings
- Processing status
- Roblox upload status
- Output metadata
- File paths
- Error message
- Timestamps

Credential stores:

- Creator target
- Encrypted API key
- API key metadata
- Validation metadata
- Timestamps

---

## 7. Storage Requirements

Storage should be organized by job ID.

Storage categories:

- downloads
- outputs
- logs
- temp

Rules:

- Store inside Linux filesystem.
- Delete job cleans related files.
- Output filename should be safe and deterministic.
- Logs should not contain secrets.

---

## 8. Worker Architecture

BullMQ worker responsibilities:

1. Receive job ID.
2. Load job from DB.
3. Update status to downloading.
4. Download source via yt-dlp.
5. Probe input with ffprobe.
6. Convert audio with ffmpeg.
7. Probe output.
8. Update DB status to converted.
9. Write logs throughout the process.

Upload can be:

- Triggered from API and run immediately for MVP, or
- Enqueued as separate BullMQ job for better robustness.

Recommended MVP:

- Convert jobs use BullMQ.
- Upload can also use BullMQ if implementation time allows.

---

## 9. Realtime/Status Update Plan

MVP:

- TanStack Query polling every 2 seconds while jobs are active.

After MVP:

- SSE endpoint using BullMQ QueueEvents.
- Frontend receives job status updates without polling.

---

## 10. Development Scripts Requirement

Project should support scripts for:

- Next.js dev server
- BullMQ worker dev process
- Running both dev server and worker together
- Database migrations
- Database studio/inspect if needed
- Build production bundle

Recommended dev process:

- Redis runs separately.
- Web server and worker run separately or via combined dev command.

---

## 11. MVP Acceptance Criteria

MVP is ready when:

- User can manage encrypted Roblox credentials.
- User can input multiple YouTube/SoundCloud URLs.
- Each URL auto-validates and shows preview.
- User can start batch convert.
- Jobs process in background queue.
- History updates status.
- User can view logs.
- User can download converted OGG.
- User can retry jobs.
- User can delete jobs and related files.
- User can upload converted audio to Roblox.
- History shows Roblox asset ID/status.
- Audio speed is playback-rate behavior.
- Input sample rate is probed before speed conversion.
- API keys are never exposed after save.

---

## 12. Non-MVP / Future Features

Not required for MVP:

- Public auth
- Cloud hosting
- Multi-user accounts
- Payment/subscription
- Advanced audio editor
- Waveform editor
- Electron packaging
- Full automatic moderation tracking
- Bulk scheduled upload
- Presets management

---

## 13. Final Library Checklist

Final recommended stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react
- sonner
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- SQLite
- Drizzle ORM
- better-sqlite3
- Drizzle Kit
- Redis
- BullMQ
- execa
- system yt-dlp
- system ffmpeg
- system ffprobe
- native fetch/FormData for Roblox API
- Node crypto AES-256-GCM
- concurrently or equivalent for dev orchestration

---

## 14. Important Lessons From Prototype

- Playback-rate speed must not use `atempo`.
- Pitch should naturally follow speed for MVP.
- Input sample rate must be probed before `asetrate`.
- Hardcoding 44100 or 48000 as input sample rate causes wrong duration/pitch.
- Use Linux filesystem inside WSL2 for project, DB, downloads, outputs, and logs.
- Keep API keys encrypted and never log them.
