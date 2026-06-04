# PKAudio Website Review & Refactor Roadmap

**Date:** 2026-06-05  
**Project:** PKAudio — Local Roblox Audio Converter Dashboard  
**Stack:** Next.js 16, React 19, Tailwind, shadcn-style UI, SQLite/Drizzle, FFmpeg/yt-dlp worker  
**Purpose:** Review UI/UX + code architecture secara keseluruhan dan bikin roadmap refactor yang gampang dipahami/di-eksekusi di sesi berikutnya.

---

## 0. How To Use This Document Later

Kalau nanti mau lanjut refactor, mulai dari bagian **"Recommended Execution Order"**.  
Format item rekomendasi:

```md
### [ID] Judul
- Current System: kondisi sekarang
- Problem: masalah user/dev
- Recommended Refactor: solusi yang disarankan
- Target Files: file yang kemungkinan disentuh
- Acceptance Criteria: tanda selesai
- Priority: P0/P1/P2/P3
```

Priority scale:

| Priority | Meaning |
|---|---|
| P0 | Fix immediately; bisa bikin user bingung atau bug visual/functionality |
| P1 | High-value refactor; improve UX/dev velocity signifikan |
| P2 | Nice optimization; bagus tapi tidak urgent |
| P3 | Long-term polish/architecture cleanup |

---

## 1. Executive Summary

PKAudio sudah punya fondasi kuat:

- Core pipeline audio sudah jelas: download/probe -> loudnorm/gain/limiter -> OGG -> upload Roblox -> moderation polling.
- Local-first architecture masuk akal untuk tool personal: SQLite, encrypted credentials, local worker.
- Fitur utama sudah lengkap: Convert, Auto Cut, Queue, History, Credentials, Settings, Backup/QA/System health.
- Recent UI cleanup membuat label/button lebih ringkas.

Masalah utama sekarang bukan fitur, tapi **information architecture dan duplication**:

1. Banyak halaman menampilkan terlalu banyak info teknis sekaligus.
2. Komponen job/audio metadata tersebar di beberapa bentuk: `JobCard`, `QueueAudioCard`, History table inline, preset cards.
3. `ConvertClient` dan `AutoCutClient` punya state/preset/audio/upload logic yang sangat mirip.
4. Repository/worker file mulai besar dan akan makin susah di-maintain.
5. Copywriting masih campur English/Indonesian dan beberapa helper text terlalu teknis.

Strategi terbaik: jangan rewrite besar-besaran. Lakukan refactor bertahap:

1. **Unify shared UI primitives** untuk audio/job/action.
2. **Extract shared batch settings hook** untuk Convert + Auto Cut.
3. **Progressive disclosure** di Settings/History/Credentials.
4. **Split repository/worker modules** setelah UI stabil.

---

## 2. Current Route & Page Map

| Route | Main Component | Current Role | UX Risk |
|---|---|---|---|
| `/convert` | `ConvertClient` | Batch URL conversion | Medium: banyak controls langsung tampil |
| `/auto-cut` | `AutoCutClient` | Analyze/cut 1 long URL -> parts | Medium: duplicated controls dari Convert |
| `/queue` | `QueueClient`, `QueueAudioCard` | Monitor latest batch only | Low-Medium: rich card besar tapi sesuai konteks |
| `/history` | `HistoryClient` | Search/filter/export all jobs | Medium: table data-dense, baru dipangkas tapi masih perlu responsive polish |
| `/credentials` | `CredentialsManager` | Save/test encrypted Roblox keys | Medium: table form + security copy bisa lebih sederhana |
| `/settings` | Settings cards | Defaults, presets, worker, backup, cleanup, QA | High: banyak advanced options di satu page |

---

## 3. Global UX Principles For Next Refactor

Gunakan prinsip ini biar UI konsisten:

1. **One Primary Action Per Card**  
   Setiap card harus punya 1 action utama. Secondary actions dipindah ke outline/ghost/menu.

2. **Compact First, Details On Demand**  
   Di Convert/Auto Cut/History, tampilkan ringkasan dulu. Detail teknis via tooltip, expanded row, dialog, atau Queue page.

3. **Status Before Metadata**  
   User pertama butuh tau: `queued/converting/done/failed`, baru setting audio.

4. **Use Shared Job UI Parts**  
   Jangan render speed/gain/quality/limiter ulang manual di 5 tempat.

5. **Short Labels + Tooltip For Icons**  
   Icon-only harus selalu ada tooltip/aria-label dan konten visible. Hindari `<a />` kosong di `asChild`.

6. **Mobile-first Tables**  
   Table 6+ kolom harus punya mode card/list di mobile atau minimal horizontal scroll yang sangat jelas.

---

## 4. Key Recommended Refactors

---

### [P0-01] Extract Shared Tooltip/Icon Button Component

- **Current System:**  
  `JobCard` dan `HistoryClient` punya logic tooltip button masing-masing. Sebelumnya ada bug invisible button karena `asChild` anchor kosong.

- **Problem:**  
  Icon-only buttons rawan tidak jelas fungsinya, inconsistent styling, dan bug invisible bisa terulang.

- **Recommended Refactor:**  
  Buat shared component:

  ```tsx
  components/shared/action-icon-button.tsx
  ```

  API yang disarankan:

  ```tsx
  <ActionIconButton
    icon={Download}
    label="Download OGG"
    href={outputDownloadHref(job.outputPath)}
  />

  <ActionIconButton
    icon={Trash2}
    label="Delete"
    tone="danger"
    onClick={...}
  />
  ```

- **Target Files:**
  - `components/shared/action-icon-button.tsx` (new)
  - `components/queue/job-card.tsx`
  - `components/history/history-client.tsx`
  - `components/queue/queue-audio-card.tsx` optionally

- **Acceptance Criteria:**
  - Semua icon-only actions punya tooltip + `aria-label`.
  - Anchor button selalu punya visible icon child.
  - Danger action punya consistent rose outline.
  - Build/typecheck pass.

- **Priority:** P0

---

### [P1-01] Create Shared Job Display Primitives

- **Current System:**  
  Job data dirender manual di beberapa tempat:
  - `JobCard` for Convert/Auto Cut recent queue
  - `QueueAudioCard` for Queue full view
  - `HistoryClient` inline table row
  - Preset/settings have similar audio metadata display

- **Problem:**  
  UI inconsistency dan banyak duplication. Setiap perubahan label/format harus diedit di banyak file.

- **Recommended Refactor:**  
  Buat reusable primitives:

  ```txt
  components/jobs/job-title-block.tsx
  components/jobs/job-audio-meta.tsx
  components/jobs/job-asset-summary.tsx
  components/jobs/job-action-row.tsx
  components/jobs/job-status-chips.tsx
  lib/jobs/display.ts
  ```

  Suggested responsibilities:

  | Component/Module | Responsibility |
  |---|---|
  | `job-title-block` | title, sourceUrl, job short id, platform chip |
  | `job-audio-meta` | speed, gain, quality, limiter, duration, size, peak |
  | `job-asset-summary` | asset id, moderation badge, operation state |
  | `job-action-row` | logs, copy, open, waveform, download, retry, delete |
  | `lib/jobs/display.ts` | derived labels: canRetry, canDownload, moderationLabel, relativeDate |

- **Target Files:**
  - `components/queue/job-card.tsx`
  - `components/queue/queue-audio-card.tsx`
  - `components/history/history-client.tsx`
  - new `components/jobs/*`
  - new `lib/jobs/display.ts`

- **Acceptance Criteria:**
  - Speed/gain/quality/limiter formatting only exists in 1 shared component/helper.
  - History and Recent Queue use same compact audio metadata.
  - Queue full card can still be richer, but reuses status/action helpers.

- **Priority:** P1

---

### [P1-02] Unify Convert & Auto Cut Settings Logic

- **Current System:**  
  `ConvertClient` and `AutoCutClient` duplicate many state variables and functions:
  - presets state
  - selected preset logic
  - speed/amplify/target LUFS/quality/safety/headroom/limiter
  - upload enabled/credential/title pattern
  - `applyPreset`
  - `saveCurrentAsPreset`
  - `handleSafetyModeChange`
  - `currentBatchSettings`

- **Problem:**  
  Every change to audio/upload/preset behavior must be duplicated. Risk of Convert and Auto Cut drifting.

- **Recommended Refactor:**  
  Create a hook + shared components:

  ```txt
  hooks/use-batch-audio-settings.ts
  components/convert/preset-toolbar.tsx
  components/convert/recent-queue-card.tsx
  ```

  Hook API sketch:

  ```ts
  const batchSettings = useBatchAudioSettings({
    initialSettings,
    initialPresets,
    initialCredentials,
    defaultPresetName: "Custom preset",
    saveDescription: "Saved from Convert page.",
  });
  ```

  Return:

  ```ts
  {
    settings,
    setters,
    presets,
    selectedPresetId,
    selectedCredential,
    assetNamePattern,
    applyPreset,
    saveCurrentAsPreset,
    handleSafetyModeChange,
    batchPayload,
  }
  ```

- **Target Files:**
  - `components/convert/convert-client.tsx`
  - `components/auto-cut/auto-cut-client.tsx`
  - new hook/components above

- **Acceptance Criteria:**
  - `ConvertClient` focuses only on URL batch creation.
  - `AutoCutClient` focuses only on analyze/trim batch creation.
  - Preset/audio/upload state logic not duplicated.

- **Priority:** P1

---

### [P1-03] Refactor Settings Into Progressive Disclosure

- **Current System:**  
  Settings page contains many cards and dense controls: persistent defaults, presets dialog, worker health, backup/restore, storage cleanup, system status, final QA.

- **Problem:**  
  User can be overwhelmed. Many advanced options are rarely used but always visible.

- **Recommended Refactor:**  
  Use section tabs or accordion groups:

  ```txt
  Settings
  ├── Audio Defaults
  ├── Presets
  ├── Worker & System
  ├── Storage & Backup
  └── QA / Doctor
  ```

  Also shorten SettingsDefaults copy:
  - `Persistent Defaults` -> `Defaults`
  - `Playback-rate speed, LUFS normalization...` -> `Default speed, gain, limiter, and upload behavior.`

- **Target Files:**
  - `app/(dashboard)/settings/page.tsx`
  - `components/settings/settings-defaults-card.tsx`
  - `components/settings/audio-presets-card.tsx`
  - possibly new `components/settings/settings-tabs.tsx`

- **Acceptance Criteria:**
  - First viewport shows only the most common settings.
  - Advanced/maintenance features are grouped away.
  - Mobile layout does not require huge vertical scrolling before first useful action.

- **Priority:** P1

---

### [P1-04] Make History Responsive With Mobile Card Mode

- **Current System:**  
  History table was refactored from 10 columns to 6 columns. Better, but still a table with horizontal overflow.

- **Problem:**  
  On mobile, tables remain hard to scan. Users may not understand action icons without hover tooltips.

- **Recommended Refactor:**  
  Keep table for desktop (`md+`), add card list for mobile:

  ```tsx
  <div className="hidden md:block">Table</div>
  <div className="space-y-3 md:hidden">HistoryJobCard</div>
  ```

  Mobile card layout:

  ```txt
  [status] [platform]        2d ago
  Title
  URL / short ID
  speed + gain + quality + limiter
  Asset/moderation
  [Logs] [Copy] [Open] [OGG]
  ```

- **Target Files:**
  - `components/history/history-client.tsx`
  - new `components/history/history-job-card.tsx`
  - shared job display primitives from [P1-01]

- **Acceptance Criteria:**
  - No horizontal scroll on mobile history page.
  - Actions have visible labels or tooltip/aria labels.
  - Desktop table still supports bulk select/export.

- **Priority:** P1

---

### [P1-05] Audio UX Semantics: Clarify Gain vs Peak Ceiling

- **Current System:**  
  Current audio chain is effectively:

  ```txt
  playback-rate -> loudnorm -> volume/gain trim -> alimiter(limit=headroom)
  ```

  `amplifyDb` is displayed as `Gain trim`; limiter peak ceiling comes from `headroomDb`.

- **Problem:**  
  User expectation can be different: if limiter is ON and amplify is set to `-2`, user may expect final max peak to be `-2 dBFS`, while system currently uses headroom for limiter ceiling. This can create mental model confusion.

- **Recommended Refactor:**  
  Decide one product model:

  **Option A — Keep current DSP, improve labels**
  - Rename `Gain trim` -> `Post-LUFS gain`
  - Keep `Peak limit` as the only ceiling control
  - Helper: `Gain changes loudness; Peak limit controls final max dBFS.`

  **Option B — Add linked limiter mode**
  - Add toggle: `Peak follows gain when limiter is ON`
  - Effective peak limit becomes derived from amplify/gain rule.
  - More complex; may confuse users unless explained carefully.

  **Recommended:** Option A first. It preserves predictable DSP and makes UI clearer.

- **Target Files:**
  - `components/convert/audio-settings-card.tsx`
  - `components/settings/settings-defaults-card.tsx`
  - `components/settings/audio-presets-card.tsx`
  - `lib/audio/processing.ts` only if Option B chosen

- **Acceptance Criteria:**
  - User can understand which setting controls loudness vs peak ceiling.
  - No hidden behavior where `amplifyDb` unexpectedly changes peak limit.

- **Priority:** P1

---

### [P2-01] Refactor Credentials Page From Dense Table To Credential Cards

- **Current System:**  
  `CredentialTable` has columns: Name, Type, Target ID, Key Preview, Status, Last Used, Actions.

- **Problem:**  
  It is okay for desktop but too table-like for small number of credentials. Most users likely have 1-3 keys.

- **Recommended Refactor:**  
  Replace table with card/list layout:

  ```txt
  [status] Credential Name                    [Test] [Delete]
  Group 3308646504 · key ...abcd
  Last used: 2d ago
  ```

  Keep table only if credentials > 8 or as optional compact mode.

- **Target Files:**
  - `components/credentials/credential-table.tsx`
  - maybe rename to `credential-list.tsx`

- **Acceptance Criteria:**
  - Credential actions are clearly labeled.
  - Security copy is shorter.
  - Mobile layout avoids horizontal table.

- **Priority:** P2

---

### [P2-02] Standardize Copywriting Language

- **Current System:**  
  UI copy is mostly English, but some helper text is Indonesian casual (`Isi angka...`, `lu`). App/sidebar also has mixed copy.

- **Problem:**  
  Mixed tone can feel inconsistent. Technical users may be okay, but polish suffers.

- **Recommended Refactor:**  
  Choose one app UI language:

  **Option A:** English professional UI, Indonesian only in docs/conversation.  
  **Option B:** Indonesian casual UI for personal localhost tool.

  Recommended for product polish: **Option A**.

  Create simple copy constants later if needed:

  ```txt
  lib/copy/ui.ts
  ```

- **Target Files:**
  - `components/**/*.tsx`
  - `components/layout/app-sidebar.tsx`
  - `components/credentials/credential-form-card.tsx`

- **Acceptance Criteria:**
  - No mixed Indonesian/English inside same card.
  - Button labels short and consistent.
  - Helper texts are direct and not too verbose.

- **Priority:** P2

---

### [P2-03] Extract API Client Helper

- **Current System:**  
  `parseResponse<T>` exists in `lib/jobs/client.ts`, `settings-defaults-card.tsx`, and likely other client modules.

- **Problem:**  
  Repeated fetch error handling, no centralized toast/error strategy, and inconsistent request wrappers.

- **Recommended Refactor:**  
  Add:

  ```txt
  lib/api/client.ts
  ```

  API sketch:

  ```ts
  export async function apiJson<T>(url: string, init?: RequestInit): Promise<T>
  export function postJson<T>(url: string, body: unknown): Promise<T>
  export function patchJson<T>(url: string, body: unknown): Promise<T>
  export function deleteJson<T>(url: string): Promise<T>
  ```

- **Target Files:**
  - `lib/jobs/client.ts`
  - `lib/presets/client.ts`
  - `lib/credentials/client.ts`
  - `lib/settings/client.ts` maybe new
  - settings card local fetch logic

- **Acceptance Criteria:**
  - No duplicated `parseResponse` in client components.
  - All API error messages handled consistently.

- **Priority:** P2

---

### [P2-04] Split `lib/jobs/repository.ts`

- **Current System:**  
  `lib/jobs/repository.ts` is very large (~1000+ lines). It handles mapping, create batch, create trim batch, list/filter, lifecycle, logs, delete, recovery, claim queue, etc.

- **Problem:**  
  Hard to reason about, risky to edit, and all job logic is in one file.

- **Recommended Refactor:**  
  Split by domain:

  ```txt
  lib/jobs/mappers.ts
  lib/jobs/queries.ts
  lib/jobs/commands.ts
  lib/jobs/batches.ts
  lib/jobs/trim-batches.ts
  lib/jobs/lifecycle.ts
  lib/jobs/recovery.ts
  lib/jobs/artifacts.ts
  lib/jobs/repository.ts  # barrel/re-export compatibility layer
  ```

- **Target Files:**
  - `lib/jobs/repository.ts`
  - new files above
  - existing imports can keep importing from repository via re-export initially

- **Acceptance Criteria:**
  - No behavior change.
  - `repository.ts` becomes small exports barrel or orchestration layer.
  - Build/typecheck pass.

- **Priority:** P2

---

### [P2-05] Split Worker Media Pipeline

- **Current System:**  
  `lib/worker/media.ts` handles source resolving, yt-dlp download, local trim copy, ffprobe, ffmpeg conversion, loudnorm analysis, diagnostics, waveform, job lifecycle.

- **Problem:**  
  Too much responsibility. Audio processing changes become risky.

- **Recommended Refactor:**

  ```txt
  lib/worker/source.ts       # getSourceInfo, downloadAudio, localSourcePath
  lib/worker/probe.ts        # ffprobe parsing
  lib/worker/convert.ts      # convertToOgg, ffmpeg invocation
  lib/worker/diagnostics.ts  # volumedetect/output metrics
  lib/worker/media.ts        # processMediaJob orchestration only
  ```

- **Target Files:**
  - `lib/worker/media.ts`
  - new files above

- **Acceptance Criteria:**
  - `processMediaJob` reads as a clear step-by-step pipeline.
  - FFmpeg command builder/testable logic separated.
  - Smoke tests still pass.

- **Priority:** P2

---

### [P2-06] Add Smoke/Test Aggregator Script

- **Current System:**  
  There are multiple smoke scripts:
  - `smoke-auto-cut-plan`
  - `smoke-trim-batch-order`
  - `smoke-roblox-audio-code-order`
  - `smoke-auto-cut-media`
  - `smoke-latest-queue`
  - `smoke-converted-upload`

  But package scripts only expose `build`, `lint`, `typecheck`, `qa`, `worker`.

- **Problem:**  
  QA steps are easy to forget after refactor.

- **Recommended Refactor:**  
  Add `scripts/smoke-all.ts` or package script:

  ```json
  "smoke": "tsx scripts/smoke-all.ts"
  ```

  Or simpler:

  ```json
  "verify": "npm run typecheck && npm run lint && npm run build && npm run smoke"
  ```

- **Target Files:**
  - `package.json`
  - `scripts/smoke-all.ts`

- **Acceptance Criteria:**
  - One command verifies major app behavior.
  - Each smoke script has clear pass/fail output.

- **Priority:** P2

---

### [P3-01] Add Worker Control / Better Worker Guidance UI

- **Current System:**  
  UI tells user to run `npm run worker`. Worker status banner exists.

- **Problem:**  
  New users may not know worker must run. Localhost app could feel broken if worker is off.

- **Recommended Refactor:**  
  Add stronger CTA in Queue/Convert:

  ```txt
  Worker is offline. Run: npm run worker
  [Copy command] [Open setup guide]
  ```

  Optional advanced local-only feature: API endpoint to spawn worker process. But be careful with security and lifecycle.

- **Target Files:**
  - `components/queue/worker-status-banner.tsx`
  - `components/settings/worker-health-card.tsx`

- **Acceptance Criteria:**
  - User knows exactly why queued jobs are not progressing.
  - Copy command button available.

- **Priority:** P3

---

### [P3-02] Formalize DB Migration Strategy

- **Current System:**  
  Schema evolved with new trim columns. Need ensure migrations/bootstrapping are predictable.

- **Problem:**  
  As schema grows, ad-hoc migration risk increases.

- **Recommended Refactor:**  
  Document and implement a clear migration pattern:

  ```txt
  lib/db/migrations.ts
  drizzle migrations or custom schema version table
  ```

- **Target Files:**
  - `lib/db/client.ts`
  - `lib/db/schema.ts`
  - `drizzle` config if present/needed

- **Acceptance Criteria:**
  - Existing local DB upgrades safely.
  - New columns/defaults are validated on app boot.

- **Priority:** P3

---

## 5. Page-by-Page UX Review

---

### 5.1 Convert Page

**Strengths**
- Main flow is understandable: paste URLs -> audio settings -> upload settings -> start.
- Preset support is useful.
- Recent queue preview is good but should stay compact.

**Issues**
- Audio settings card has many controls visible at once.
- Preset save area consumes top space.
- Convert duplicates Auto Cut logic.

**Recommendations**
1. Extract preset toolbar shared with Auto Cut.
2. Consider `Basic / Advanced` inside Audio Output:
   - Basic: Safety mode, Speed, Gain, Upload
   - Advanced: Target LUFS, Peak limit, Quality
3. Add short explainer near Start Batch: `X URLs will be queued. Worker converts them locally.`

---

### 5.2 Auto Cut Page

**Strengths**
- Separate menu is a good decision.
- Single URL constraint is clear.
- Preview-before-queue pattern is right.

**Issues**
- It repeats Convert settings and preset logic.
- Analyze/cut step and conversion step could be visually separated more strongly.

**Recommendations**
1. Step layout:
   - Step 1: Source URL
   - Step 2: Analyze & preview parts
   - Step 3: Settings + Queue parts
2. Make generated parts preview more prominent than settings until analysis is complete.
3. Reuse Convert shared hook/components.

---

### 5.3 Queue Page

**Strengths**
- Latest-batch-only is a strong UX decision.
- `QueueAudioCard` is appropriate here because Queue is the detail page.
- Mini waveform is useful and visually distinctive.

**Issues**
- Full cards can still feel heavy if batch has many items.
- Button row could use shared action component.

**Recommendations**
1. Add density toggle later: `Comfortable / Compact`.
2. Extract action row and status chip logic.
3. Add quick count summary: `Uploaded 5/10 · Approved 4/5` near copy buttons.

---

### 5.4 History Page

**Strengths**
- Table was improved by reducing columns.
- Advanced filters are now collapsible.
- Relative date + tooltip improves scanning.

**Issues**
- Still table-first; mobile can be hard.
- Actions are icon-only; tooltips don't help touch users.
- Export/reset/bulk controls share same visual weight.

**Recommendations**
1. Desktop table + mobile card layout.
2. Use shared `ActionIconButton`.
3. Move export actions into compact `Export` dropdown if action row gets crowded.
4. Add `Details` expansion for diagnostics rather than showing everything inline.

---

### 5.5 Credentials Page

**Strengths**
- Security model is explained.
- API key visibility toggle exists.
- Test/delete flows are clear.

**Issues**
- Table is overkill for likely small credential count.
- Security explanation is long.
- Form helper text mixes Indonesian casual with English UI.

**Recommendations**
1. Replace table with credential cards.
2. Shorten security copy:
   `Keys are encrypted locally. Worker decrypts only during upload.`
3. Standardize language.
4. Add `Test after save` toggle or auto-test newly created credential.

---

### 5.6 Settings Page

**Strengths**
- Comprehensive control center.
- Preset dialog exists.
- Worker/system/QA/backup are powerful for local tool.

**Issues**
- Settings is the densest page.
- Audio defaults form uses raw number inputs; Convert card uses sliders and presets. Mental model differs.
- Preset dialog is large.

**Recommendations**
1. Tabs/accordion by category.
2. Reuse same audio controls as Convert where possible.
3. Add summaries before advanced controls.
4. Keep destructive/maintenance actions visually separated.

---

## 6. Code Architecture Review

---

### 6.1 Frontend State & Component Architecture

**Main issue:** Page client components are becoming orchestration + UI + business logic mixed.

Examples:
- `ConvertClient` and `AutoCutClient` manage many state fields directly.
- `HistoryClient` manages filters, selection, actions, table rendering, waveform expansion in one component.

**Recommendation:** Extract hooks and subcomponents when component exceeds ~250 lines or has 3+ responsibilities.

Target split:

```txt
components/convert/convert-client.tsx       # orchestrates Convert only
components/auto-cut/auto-cut-client.tsx     # orchestrates Auto Cut only
hooks/use-batch-audio-settings.ts           # shared state/preset logic
hooks/use-history-filters.ts                # URL param filter logic
components/history/history-filter-card.tsx
components/history/history-table.tsx
components/history/history-job-card.tsx
```

---

### 6.2 Backend/API Layer

**Main issue:** API routes likely repeat validation/try/catch patterns.

**Recommendation:** Add route helper:

```txt
lib/api/route.ts
```

Possible helper:

```ts
export function jsonOk<T>(data: T, status = 200): Response
export function jsonError(error: unknown, fallback: string, status = 400): Response
export async function withApiHandler(fn: () => Promise<Response>): Promise<Response>
```

Benefits:
- consistent error payload `{ error }`
- no duplicate `try/catch`
- easier logging later

---

### 6.3 Job Repository

**Main issue:** `lib/jobs/repository.ts` is too large and mixes many domains.

**Best refactor sequence:**
1. Extract pure mappers first (`toJobView`, `toBatchView`, `toJobLogView`).
2. Extract query functions (`listJobs`, `listLatestBatchJobs`, filters).
3. Extract lifecycle commands (`claimNextQueuedJobs`, `completeJob`, `failJob`, etc.).
4. Extract batch creation and trim batch creation.
5. Keep `repository.ts` as barrel export to avoid updating every import at once.

---

### 6.4 Worker / FFmpeg Pipeline

**Main issue:** `lib/worker/media.ts` owns too many concerns.

**Recommended pipeline readability:**

```ts
export async function processMediaJob(job: JobView) {
  const sourceInfo = await resolveSource(job);
  const sourcePath = await prepareSource(job, sourceInfo);
  const probe = await probeAudio(sourcePath);
  const outputPath = await convertJobAudio(job, sourcePath, probe);
  const diagnostics = await analyzeOutput(outputPath);
  await markConverted(job, outputPath, diagnostics);
  await maybeUploadOrComplete(job);
}
```

Make FFmpeg command generation testable without running FFmpeg.

---

### 6.5 Audio Processing

**Current design is solid:** 2-pass loudnorm + post gain + true peak-ish limiter is a good strategy for Roblox-safe audio.

**Open product decision:** whether `amplifyDb` should remain a gain trim or influence limiter ceiling. Recommendation: keep as gain trim and make labels clear.

**Testing recommendation:** add unit tests for filter strings:

```txt
buildLoudnormAnalyzeFilter
buildLoudnormApplyFilter
buildManualGainFilter
parseLoudnormAnalysis
```

---

## 7. Recommended Execution Order

### Phase 0 — Stabilize Current Dirty Work

Current local dirty files observed during review:

```txt
M components/history/history-client.tsx
M components/queue/job-card.tsx
M next-env.d.ts
```

Before starting a new refactor:

```bash
npm run build
npm run typecheck
npm run lint
```

Then commit the UI fixes separately.

---

### Phase 1 — UI Primitive Extraction (Highest ROI)

1. [P0-01] Extract `ActionIconButton`.
2. [P1-01] Extract job display primitives.
3. Replace usages in `JobCard` and `HistoryClient` first.
4. Optional: replace `QueueAudioCard` action row after behavior verified.

**Why first:** reduces future UI bugs and makes History/Queue/Recent cards consistent.

---

### Phase 2 — Convert / Auto Cut Unification

1. [P1-02] Add `useBatchAudioSettings`.
2. Add shared `PresetToolbar`.
3. Add shared `RecentQueueCard`.
4. Simplify both client components.

**Why second:** removes most visible code duplication without touching backend.

---

### Phase 3 — Settings/Credentials UX Polish

1. [P1-03] Settings tabs/accordion.
2. [P2-01] Credential cards.
3. [P2-02] Copywriting language standardization.

**Why third:** improves polish and reduces user overwhelm.

---

### Phase 4 — Backend/Worker Architecture

1. [P2-03] API client helper.
2. [P2-04] Split job repository.
3. [P2-05] Split worker media pipeline.
4. [P2-06] Add smoke/verify script.

**Why last:** deeper refactor; do after UI behavior is stable.

---

## 8. Suggested Future File Structure

```txt
components/
  jobs/
    job-title-block.tsx
    job-audio-meta.tsx
    job-status-chips.tsx
    job-asset-summary.tsx
    job-action-row.tsx
  shared/
    action-icon-button.tsx
  convert/
    preset-toolbar.tsx
    recent-queue-card.tsx
hooks/
  use-batch-audio-settings.ts
  use-history-filters.ts
lib/
  api/
    client.ts
    route.ts
  jobs/
    display.ts
    mappers.ts
    queries.ts
    batches.ts
    trim-batches.ts
    lifecycle.ts
    recovery.ts
    repository.ts
  worker/
    source.ts
    probe.ts
    convert.ts
    diagnostics.ts
    media.ts
```

---

## 9. Quality Checklist For Every Refactor

Run these after each refactor chunk:

```bash
npm run typecheck
npm run lint
npm run build
```

If touching worker/audio/trim:

```bash
npm run worker:once
# plus relevant smoke scripts if available
```

Manual UX checks:

- Convert page mobile width ~375px.
- Auto Cut page with URL empty, invalid, valid, preview ready.
- Queue with job queued/converting/done/failed.
- History with assetId and without assetId.
- Credentials with 0, 1, 3 credentials.
- Settings on small screen.

Accessibility checks:

- Icon-only buttons have tooltip + aria-label.
- Touch targets >= 44px where possible.
- No invisible `asChild` anchor buttons.
- Focus rings remain visible.
- Danger actions use consistent rose styling.

---

## 10. Short List Of Best Next Tasks

If the next session asks "lanjut refactor", do this order:

1. **Create `ActionIconButton`** and replace duplicate tooltip icon buttons.  
2. **Create `JobAudioMeta` + `JobTitleBlock`** and use in History + JobCard.  
3. **Extract `useBatchAudioSettings`** for Convert/Auto Cut.  
4. **Add mobile card mode for History**.  
5. **Refactor Credentials table into cards**.  
6. **Split `lib/jobs/repository.ts`** after UI stable.

---

## 11. Notes / Cautions

- Do not make Recent Queue cards as rich as Queue cards. Convert/Auto Cut should stay preview-focused.
- Do not hide critical status behind hover-only UI; touch users need visible cues.
- Avoid introducing heavy animations; this is a utility dashboard, clarity > decoration.
- Keep Roblox-safe audio defaults conservative: target LUFS and peak ceiling should not encourage clipping.
- When editing audio pipeline, add smoke tests before changing FFmpeg filters.
- When moving repository functions, preserve exports initially to reduce import churn.

---

## 12. Final Recommendation

Overall: **the app is functionally strong but needs design-system consolidation.**  
The best ROI is not adding features right now, but making existing systems easier to scan and easier to maintain:

```txt
Shared primitives -> Shared settings hook -> Progressive disclosure -> Backend module split
```

This will make future changes (audio behavior, Roblox upload flow, Auto Cut improvements) much safer and faster.
