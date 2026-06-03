### Berikut adalah penyesuaian **Tech Stack & Library** yang paling optimal khusus untuk lingkungan **WSL2 Ubuntu**:

---

### 1. Core Architecture (The Linux-Native Stack)

*   **Framework Utama: Next.js (App Router) + TypeScript**
    *   **Alasan:** Tetap menjadi pilihan terbaik. Anda bisa menjalankan UI (React) dan Backend (Node.js API/Workers) dalam satu codebase. WSL2 menangani Node.js dengan sangat sempurna.
*   **Database History & CRUD: SQLite (via Drizzle ORM + `better-sqlite3`)**
    *   **Alasan:** Untuk data *persistent* seperti History, Roblox Credentials, dan Metadata, SQLite tetap raja untuk *zero-config*. Tidak perlu setup server Postgres. Drizzle ORM sangat ringan dan *type-safe*.
*   **Background Queue & Jobs: Redis + BullMQ**
    *   **Alasan (Upgrade dari in-memory queue):** Karena di Ubuntu, menginstal Redis sangat mudah (`sudo apt install redis-server`). **BullMQ** akan menangani antrean *batch download*, *concurrency limits*, *retries*, dan *job logs* secara otomatis. Ini jauh lebih robust dan sesuai dengan spek MVP Anda (status tracking, retry, cancel).

---

### 2. Audio & Downloader (Memanfaatkan Native Linux Binaries)

Di WSL2 Ubuntu, **jangan gunakan library NPM yang mencoba mem-bundle FFmpeg/yt-dlp** (seperti `@ffmpeg-installer` atau `ytdl-core`). Gunakan binary asli Linux untuk performa maksimal.

*   **Downloader: `yt-dlp` (System Binary via `execa`)**
    *   **Instalasi di Ubuntu:** `sudo add-apt-repository ppa:tomtomtom/yt-dlp && sudo apt update && sudo apt install yt-dlp`
    *   **Library Node:** Gunakan **`execa`** (bukan `child_process` bawaan). `execa` jauh lebih baik dalam menangani *streaming output*, *error catching*, dan *killing process* jika user membatalkan (cancel) job.
*   **Audio Converter: FFmpeg (System Binary via `fluent-ffmpeg`)**
    *   **Instalasi di Ubuntu:** `sudo apt install ffmpeg`
    *   **Library Node:** **`fluent-ffmpeg`**. Ini adalah wrapper yang sangat stabil untuk meracik filter audio (Speed pitch-up, Amplification dB, resample 44100Hz) menjadi OGG Vorbis.

---

### 3. UI & Client-Side (Realtime Dashboard)

*   **UI Components: shadcn/ui + Tailwind CSS**
    *   Sangat cocok untuk membuat *Data Table* (History), *Sheet/Drawer* (Roblox Credentials Side Panel), dan *Dialog* (Job Logs).
*   **Realtime Job Status: Server-Sent Events (SSE) atau Socket.io**
    *   **Alasan:** Daripada frontend melakukan *polling* (request berulang-ulang ke API), gunakan **SSE (Server-Sent Events)**. Saat BullMQ memproses job di backend, backend bisa langsung *push* update status (`downloading` -> `converting`) ke frontend secara realtime. Sangat hemat resource CPU.
*   **Form & Validation: React Hook Form + Zod**
    *   Untuk validasi URL batch secara instan di sisi client sebelum dikirim ke backend.

---

### 4. Security (Roblox API Keys)

*   **Enkripsi: `crypto` (Node.js Native)**
    *   Gunakan **AES-256-GCM**. Simpan *Master Key* di file `.env`. Saat user menyimpan API key Roblox, enkripsi dulu sebelum masuk ke SQLite. Dekripsi hanya di memory saat worker BullMQ butuh mengirim file ke Roblox Open Cloud API.

---

### ⚠️ Aturan Emas (Crucial) untuk WSL2

Karena Anda menggunakan WSL2, ada satu hal teknis yang **wajib** Anda perhatikan agar aplikasi tidak lemot:

1.  **JANGAN simpan file di `/mnt/c/` (Windows Drive):**
    Sistem file WSL2 dan Windows memiliki *cross-OS I/O* yang sangat lambat. Jika Anda menyimpan file audio `.ogg` atau database SQLite di folder Windows (contoh: `/mnt/c/Users/Name/Desktop/pkaudio`), proses download dan konversi akan **sangat lambat** dan SQLite bisa *corrupt*.
2.  **Simpan di Linux File System (`~/`):**
    Buat folder project Anda di home directory Ubuntu, misalnya: `~/workspace/pkaudio`. Kecepatan baca/tulisnya akan secepat SSD native.
3.  **File Watcher (Hot Reload):**
    Terkadang WSL2 gagal mendeteksi perubahan file untuk *hot-reload* Next.js. Jika ini terjadi, tambahkan variabel ini di file `.env` Anda:
    ```env
    CHOKIDAR_USEPOLLING=true
    ```

---

### Arsitektur Pemrosesan Job (Dengan BullMQ)

Berikut adalah gambaran bagaimana library **BullMQ** akan menyederhanakan spek MVP Anda:

```typescript
// worker.ts (Berjalan di background WSL2)
import { Worker, Job } from 'bullmq';
import { execa } from 'execa';
import ffmpeg from 'fluent-ffmpeg';

const connection = { host: 'localhost', port: 6379 }; // Redis lokal Ubuntu

const audioWorker = new Worker('audio-queue', async (job: Job) => {
  const { url, speed, ampDb } = job.data;

  // 1. Update status ke 'downloading'
  await job.updateProgress({ step: 'downloading' });
  
  // 2. Download pakai yt-dlp (execa sangat bagus untuk ini)
  const tempAudio = `/tmp/${job.id}.webm`;
  await execa('yt-dlp', ['-x', '--audio-format', 'best', '-o', tempAudio, url]);
  
  await job.updateProgress({ step: 'converting' });
  
  // 3. Convert pakai FFmpeg (fluent-ffmpeg)
  const outputPath = `~/workspace/pkaudio/outputs/${job.id}.ogg`;
  await new Promise((resolve, reject) => {
    ffmpeg(tempAudio)
      .audioFilters([
        `asetrate=48000*${speed}`, // Speed naik, pitch ikut naik
        `aresample=44100`,         // Target Roblox
        `volume=${ampDb}dB`        // Amplification
      ])
      .audioCodec('libvorbis')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });

  await job.updateProgress({ step: 'completed' });
  return { outputPath };

}, { connection, concurrency: 2 }); // Maksimal 2 job jalan bareng biar WSL ga nge-lag
```

---

### Rangkuman Tech Stack WSL2 Ubuntu

| Kategori | Teknologi / Library | Cara Install di WSL2 |
| :--- | :--- | :--- |
| **Framework Fullstack** | Next.js (App Router) + TS | `npx create-next-app@latest` |
| **Database Utama** | SQLite + Drizzle ORM | File `.db` lokal (NPM install) |
| **Queue / Background** | Redis + BullMQ | `sudo apt install redis-server` |
| **Downloader** | `yt-dlp` + `execa` (NPM) | `sudo apt install yt-dlp` |
| **Audio Converter** | FFmpeg + `fluent-ffmpeg` (NPM)| `sudo apt install ffmpeg` |
| **UI & Styling** | shadcn/ui + Tailwind | `npx shadcn@latest init` |
| **Realtime Status** | SSE (Server-Sent Events) | Native Next.js API Route |
| **HTTP Client** | Native `fetch` (Roblox API) | - |
| **Enkripsi** | Node.js `crypto` | - |

**Kesimpulan:**
Dengan WSL2 Ubuntu, Anda mendapatkan lingkungan *production-grade* (Linux, Node, Redis, FFmpeg) tapi dengan kenyamanan pengembangan di Windows. Menggunakan **Next.js + SQLite (untuk history) + Redis/BullMQ (untuk antrean job)** adalah kombo paling *bulletproof* untuk spesifikasi MVP PKAudio Anda.