# PKAudio / Roblox Audio Converter — MVP Feature Specification

## 1. Product Overview

PKAudio adalah website localhost untuk workflow personal mengubah audio dari YouTube/SoundCloud menjadi audio OGG yang siap diupload ke Roblox Creator Asset.

Tujuan utama website:

- Stabil untuk penggunaan personal/local.
- Optimal untuk batch audio conversion.
- Aman untuk penyimpanan Roblox API key.
- Mudah dikembangkan ke fitur history, credentials manager, batch jobs, dan Roblox status tracking.

Flow utama:

1. User memasukkan satu atau banyak URL YouTube/SoundCloud.
2. Sistem otomatis validasi URL dan menampilkan preview.
3. User memilih custom audio settings.
4. Sistem download audio source.
5. Sistem convert audio ke OGG Vorbis.
6. User bisa download hasil convert.
7. User bisa upload hasil convert ke Roblox Creator Asset memakai credential yang tersimpan.
8. History menyimpan semua job, status, metadata source, dan Roblox asset info.

---

## 2. Core MVP Features

## 2.1 Multiple URL Input

Website harus mendukung input lebih dari satu URL sekaligus.

Requirement:

- User bisa paste banyak URL dalam satu input area.
- Setiap URL diproses sebagai job terpisah.
- URL yang valid dan invalid tetap terlihat jelas di UI.
- Batch convert bisa dibuat dari semua URL valid.
- Invalid URL tidak boleh membuat seluruh batch gagal.

Supported source:

- YouTube
- YouTube short URL
- SoundCloud

---

## 2.2 Automatic URL Validation

Ketika user memasukkan URL, sistem otomatis melakukan validasi.

Requirement:

- Validasi berjalan otomatis setelah user input URL.
- Validasi tidak boleh terlalu agresif; idealnya menggunakan debounce.
- Validasi harus mendeteksi platform source.
- Validasi harus bisa membedakan URL valid, unsupported, dan gagal metadata.
- UI harus menampilkan status validasi per URL.

Status validasi:

- Valid
- Invalid URL
- Unsupported source
- Metadata fetch failed
- Loading / validating

---

## 2.3 Source Preview Card

Setiap URL valid harus menampilkan preview sebelum convert.

Preview data:

- Thumbnail
- Title / judul audio/video
- Duration
- Source type: YouTube atau SoundCloud
- Original URL
- Normalized URL jika tersedia
- Validation status

UI behavior:

- Preview card muncul per URL.
- User bisa menghapus URL card tertentu.
- User bisa melihat URL mana yang akan dikonversi.
- Convert button hanya aktif jika minimal ada satu URL valid.

---

## 2.4 Audio Customization

Website fokus pada custom audio sederhana dan predictable.

Settings MVP:

- Speed
- Amplification dB
- Output quality

Speed behavior:

- Speed menggunakan playback-rate behavior.
- Jika speed dinaikkan, durasi audio lebih pendek dan pitch/vokal ikut naik.
- Tidak menggunakan tempo-preserve mode.
- Tidak menggunakan pitch correction untuk MVP.

Amplification behavior:

- User bisa mengatur gain dalam dB.
- Amplification diterapkan sebelum limiter/final safety processing.

Default audio settings:

- Speed default: 2.30x
- Amplification default: -4 dB
- Output format: OGG Vorbis
- Output sample rate: 44100 Hz
- Output channel: Stereo

Important technical behavior:

- Sistem harus membaca sample rate input sebelum playback-rate conversion.
- Jangan hardcode input sample rate untuk speed processing.
- Source YouTube/SoundCloud bisa memiliki sample rate berbeda.

---

## 2.5 Audio Conversion Job

Setiap URL valid menjadi satu conversion job.

Job harus menyimpan:

- Job ID
- Batch ID jika berasal dari batch
- Source URL
- Normalized source URL
- Source type
- Source title
- Source thumbnail
- Source duration
- Speed setting
- Amplification setting
- Output format
- Output duration
- Output size
- Input file path
- Output file path
- Status
- Error jika gagal
- Created/updated/completed timestamp

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

---

## 2.6 Batch Convert

Sistem harus mendukung batch job.

Requirement:

- Satu batch berisi banyak audio jobs.
- Batch memiliki status keseluruhan.
- Setiap job tetap punya status masing-masing.
- Job gagal tidak menghentikan semua job lain.
- UI bisa menampilkan job berdasarkan batch atau semua history.

Batch data:

- Batch ID
- Batch title optional
- Total jobs
- Completed jobs
- Failed jobs
- Batch status
- Created date

---

## 2.7 Background Processing

Download dan convert tidak boleh blocking request utama.

Requirement:

- Job harus diproses di background.
- UI menerima job ID/batch ID segera setelah submit.
- UI melakukan polling atau realtime update untuk status.
- Sistem harus siap diganti ke queue/worker yang lebih robust.

Recommended behavior:

- Request create batch hanya membuat job dan enqueue.
- Worker menangani download, convert, dan upload.
- Status job diupdate setiap step.

---

## 2.8 Job Logs

Setiap job harus memiliki log.

Log berisi:

- Job queued
- Download started
- Download completed
- Source metadata/probe result
- Conversion started
- Conversion completed
- Upload started
- Upload result
- Error detail jika gagal

UI behavior:

- User bisa membuka logs dari history.
- Logs tampil sebagai modal/detail panel.
- Logs membantu debugging tanpa membuka terminal.

---

## 2.9 History Dashboard

History adalah pusat utama monitoring dan CRUD job.

History harus menampilkan:

- Thumbnail
- Title
- Source type
- Source URL yang digunakan convert
- Speed
- Amplification dB
- Output duration
- Output size
- Convert status
- Roblox status
- Roblox asset ID jika ada
- Created date
- Actions

Actions per job:

- View logs
- Download output
- Retry job
- Delete job
- Upload to Roblox
- Check Roblox status

History filter/search:

- Search by title
- Filter by source type
- Filter by convert status
- Filter by Roblox status
- Sort newest/oldest

---

## 2.10 History CRUD

History harus bisa dikelola user.

CRUD behavior:

- Read/list all jobs.
- View job detail.
- Delete job.
- Retry failed or completed job.
- Update optional metadata jika diperlukan.

Delete behavior:

- Delete job dari database.
- Delete downloaded source file.
- Delete output file.
- Delete logs.

Retry behavior:

- Reset status ke queued.
- Clear error.
- Clear output data lama jika perlu.
- Enqueue job ulang.

---

## 2.11 Roblox Credentials Side Panel

Website harus memiliki side panel untuk mengelola Roblox credentials.

Credential fields:

- Label
- Creator type: user/group
- Creator ID
- Creator name
- Roblox API key
- API key last 4 characters
- API key name jika tersedia
- Authorized user ID jika tersedia
- Created/updated timestamp

UI behavior:

- Credentials ditampilkan di side panel.
- User bisa add credential.
- User bisa edit credential.
- User bisa delete credential.
- Full API key tidak pernah ditampilkan lagi setelah disimpan.
- Saat edit, user bisa update API key secara optional.

Security requirement:

- API key harus disimpan encrypted.
- API key tidak boleh disimpan plaintext.
- API key tidak boleh ditampilkan kembali ke frontend.
- API key tidak boleh muncul di logs.
- API key tidak boleh muncul di error message.

---

## 2.12 Roblox Credential Validation

Sistem harus bisa memvalidasi credential Roblox.

Validation checks:

- API key valid.
- API key enabled.
- API key belum expired.
- API key memiliki asset write permission.
- API key memiliki permission untuk target user/group yang dipilih.

Credential status yang bisa ditampilkan:

- Valid
- Invalid key
- Missing asset write scope
- Wrong creator target
- Expired
- Disabled
- Unknown

---

## 2.13 Upload to Roblox

User bisa upload hasil convert ke Roblox Creator Asset.

Requirement:

- Hanya job status converted yang bisa diupload.
- User memilih credential yang akan dipakai.
- User memasukkan asset name.
- Description optional.
- Sistem upload OGG output ke Roblox.
- Sistem menyimpan asset ID atau operation ID dari response Roblox.

Upload status:

- not_uploaded
- uploading
- pending
- accepted
- rejected
- unknown

History harus menampilkan:

- Roblox asset ID
- rbxassetid format
- Roblox moderation/status
- Credential yang digunakan upload
- Upload error jika gagal

---

## 2.14 Roblox Asset Status Tracking

Setelah upload, sistem harus bisa melacak status Roblox asset.

Requirement MVP:

- Setelah upload sukses, status awal menjadi pending.
- User bisa melakukan manual check status.
- Sistem menyimpan hasil status terakhir.

Future improvement:

- Auto polling status.
- Background scheduler untuk check pending assets.
- Bulk status refresh.

---

## 2.15 Audio Output Preview

History harus memberikan akses ke hasil audio.

Requirement:

- User bisa play hasil converted audio di browser.
- User bisa download file OGG.
- User bisa melihat duration dan size output.

---

## 3. Dashboard Layout

Recommended layout:

- Main area untuk convert form dan history.
- Right side panel untuk Roblox Credentials.
- Modal untuk logs.
- Modal untuk upload Roblox.

Main sections:

1. Header
2. Convert batch form
3. Source preview cards
4. History table
5. Credential side panel
6. Modals/actions

---

## 4. API Feature Requirements

Backend perlu menyediakan API untuk:

Source preview:

- Preview single URL
- Preview multiple URLs

Batches:

- Create batch
- List batches
- View batch detail
- Delete batch

Jobs/history:

- List jobs
- View job detail
- Retry job
- Delete job
- Download output file
- View job logs
- Upload job to Roblox
- Check Roblox status

Credentials:

- List credentials
- Create credential
- Update credential
- Delete credential
- Validate credential

---

## 5. Data Model Requirements

Core entities:

- AudioBatch
- AudioJob
- RobloxCredential
- JobLog optional

AudioJob must include:

- Source metadata
- Audio settings
- Processing status
- Roblox upload status
- Output metadata
- Error data
- File paths
- Timestamps

RobloxCredential must include:

- Creator target
- Encrypted API key
- API key metadata
- Validation metadata
- Timestamps

---

## 6. Storage Requirements

Storage should be organized by job ID.

Storage categories:

- Downloaded source files
- Converted output files
- Logs
- Temporary files

Delete job should cleanup all related files.

System should support future cleanup rules:

- Delete files older than X days.
- Keep history but remove files.
- Manual cleanup.

---

## 7. Stability Requirements

The website should prioritize stability.

Requirements:

- Long-running tasks should not block HTTP requests.
- Each job should fail independently.
- Errors should be visible in UI.
- Job logs should capture important steps.
- API key secrets should never leak.
- File cleanup should avoid orphaned data.
- Conversion should be deterministic.
- Output format should be consistent.

---

## 8. Performance Requirements

Performance goals:

- Support multiple URL preview without freezing UI.
- Support batch conversion.
- Avoid unnecessary repeated metadata fetches.
- Keep frontend responsive during conversion/upload.
- Poll status efficiently.
- Avoid loading full logs unless user opens logs.

---

## 9. MVP Acceptance Criteria

MVP is ready when:

- User can add encrypted Roblox credentials.
- User can CRUD credentials from side panel.
- User can input multiple YouTube/SoundCloud URLs.
- Each URL auto-validates and shows preview thumbnail/title/duration.
- User can start batch convert.
- Each job appears in history.
- History updates statuses.
- User can view logs per job.
- User can download converted OGG.
- User can retry failed/completed jobs.
- User can delete history items and related files.
- User can upload converted audio to Roblox.
- History shows Roblox asset ID/status.
- Custom audio speed uses playback-rate behavior.
- API keys are never exposed after save.

---

## 10. Non-MVP / Future Features

Not required for MVP:

- Public authentication system
- Cloud hosting
- Multi-user support
- Payment/subscription system
- Advanced audio editing like trim/fade/EQ
- WebSocket realtime updates
- Desktop/Electron packaging
- Full automated Roblox moderation polling
- Bulk upload scheduling
- Preset management
- Audio waveform editor

---

## 11. Library Selection Criteria

When choosing libraries, prioritize:

- Stability
- Clear documentation
- Good async/background job support
- Easy local development
- Good TypeScript support for frontend
- Good form and validation ecosystem
- Secure secret handling
- Maintainable architecture
- Easy migration from SQLite to PostgreSQL if needed
- Easy replacement of local background processing with real worker queue
