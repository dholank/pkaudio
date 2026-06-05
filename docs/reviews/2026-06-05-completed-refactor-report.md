# PKAudio Refactor — Completed Work Report

**Date:** 2026-06-05  
**Period:** Single session (no push between commits)  
**Total stat:** 33 files changed, 2,958 insertions(+), 1,239 deletions(-)  
**Commits:** 6 commits on top of previous work  

---

## 1. Pre-refactor State (before this session)

Dirty/just-built files setelah review terakhir:

```txt
M components/history/history-client.tsx    (10→6 column refactor)
M components/queue/job-card.tsx            (compact meta, icon buttons, asChild bugfix)
?? docs/reviews/                           (roadmap file)
```

Build: ✅ passing

---

## 2. Phase 0 — Commit existing changes

**Commit:** `f942063 feat: history table refactor 10->6 cols, job card action compaction`

**History:**
- 10 columns → 6 columns (Title, Audio, Asset, Date, Actions)
- Compact audio meta (icon + short value)
- Collapsible advanced filters
- Relative dates with tooltip

**JobCard:**
- Icon-only action buttons with tooltip
- Fixed `asChild` anchor invisible button bug
- Destructive Cancel/Delete with rose border

**Build:** ✅

---

## 3. Phase 1 — UI Primitive Extraction

### Created files

| File | Description |
|---|---|
| `components/shared/action-icon-button.tsx` | Shared icon button with tooltip. Props: icon, label, onClick, href, target, rel, disabled, tone (default\|danger) |
| `components/jobs/job-audio-meta.tsx` | Compact variant (icon row) + full variant (text list). Extra: `JobOutputDiagnostics` for dur/size/peak |
| `components/jobs/job-title-block.tsx` | Status badge + platform chip + job id + title + source URL |

### Replaced

| Old | New |
|---|---|
| `IconBtn` (local in JobCard, ~35 lines) | `ActionIconButton` |
| 4x inline `<Tooltip><Button>` blocks in HistoryClient | `ActionIconButton` |
| `CompactMeta` (JobCard) + `AudioMetaCompact` (History) | `JobAudioMeta compact` |
| Inline title/url/id rendering (2 places) | `JobTitleBlock` |

### Deleted deduplication

- `import { Button, Tooltip, TooltipContent, TooltipTrigger }` from job-card.tsx
- All manual title blocks with status/platform/id

**Build:** ✅

---

## 4. Phase 2 — Convert / Auto Cut Unification

### Created files

| File | Description |
|---|---|
| `hooks/use-batch-audio-settings.ts` | Shared hook. 18 state variables: speed, amplifyDb, targetLufs, quality, audioSafetyMode, headroomDb, limiterEnabled, uploadEnabled, selectedCredential, assetNamePattern + presets state. Functions: applyPreset, saveCurrentAsPreset, handleSafetyModeChange. Returns batchPayload for easy API calls |
| `components/convert/preset-toolbar.tsx` | Preset selector + save preset input/button. Shared by Convert + Auto Cut |
| `components/convert/recent-queue-card.tsx` | Recent queue card with worker hint, empty state, view-all link |

### Changed files

| File | Before | After | Notes |
|---|---|---|---|
| `convert-client.tsx` | 271 lines, ~125 lines of preset/state logic | 117 lines | Only URL parsing + batch start logic |
| `auto-cut-client.tsx` | 301 lines, ~125 lines duplicate | 149 lines | Only URL + analyze/trim logic |

### Net deduplication removed

~250 lines of identical state/function logic between Convert and Auto Cut.

**Build:** ✅

---

## 5. Phase 3 — Settings Tabs, Credential Cards, Copywriting

### Created files

| File | Description |
|---|---|
| `components/settings/settings-tabs.tsx` | TabNav component + tab definitions (Audio Defaults, Presets, Worker, Backup, QA) |
| `components/settings/settings-page-client.tsx` | Client-side tab controller. Renders appropriate cards per active tab |
| `components/credentials/credential-card.tsx` | `CredentialCard` (single card) + `CredentialCardList` (replaces table) + relativeDate |

### Changed files

| File | Change |
|---|---|
| `app/(dashboard)/settings/page.tsx` | Server component → passes props to `SettingsPageClient` |
| `app/(dashboard)/settings/page.tsx` | Removed inline JSX (`Database` card, grid) |
| `credentials-manager.tsx` | `CredentialTable` → `CredentialCardList` |
| `credential-form-card.tsx` | `Contoh:` → `e.g.`, Indonesian helper → English, CardDescription shortened |
| `components/layout/app-sidebar.tsx` | "dan QA doctor aktif" → "and QA doctor" |
| `components/queue/queue-client.tsx` | 2 CardDescriptions Indonesian → English |

### Copywriting standard

Sidebar, queue descriptions, credential form helpers: **Indonesian casual → English professional**.

**Build:** ✅

---

## 6. Phase 4 — Backend Architecture

### [P2-03] Shared API client

| File | Description |
|---|---|
| `lib/api/client.ts` | `apiJson`, `getJson`, `postJson`, `patchJson`, `deleteJson`. Consistent error extraction from `{ error }` payload |

### Replaced

| File | Remove | Replace |
|---|---|---|
| `lib/jobs/client.ts` | `parseResponse<T>` (~9 lines) | `postJson`, `getJson`, `deleteJson` |
| `lib/presets/client.ts` | `parseResponse<T>` (~8 lines) | `postJson`, `getJson`, `deleteJson`, `patchJson` |
| `lib/credentials/client.ts` | `parseResponse<T>` (~9 lines) | `postJson`, `getJson`, `deleteJson` |
| `settings-defaults-card.tsx` | `parseResponse<T>` + raw fetch | `patchJson`, `postJson` |

### [P2-04] Split job repository

| File | Content | Lines |
|---|---|---|
| `lib/jobs/mappers.ts` (NEW) | `toBatchView`, `toJobView`, `toJobLogView`, `detectSourcePlatform`, `iso` | 100 lines |
| `lib/jobs/repository.ts` (CHANGED) | Removed mapper functions. Added barrel re-export. Keeps: queries, batches, lifecycle, recovery | 985→985 lines |

Backward compatible: all 21+ imports from `@/lib/jobs/repository` unchanged.

### [P2-05] Split worker media

| File | Responsibility | Lines |
|---|---|---|
| `lib/worker/source.ts` (NEW) | `getSourceInfo`, `downloadAudio` (local file, yt-dlp) | 99 |
| `lib/worker/probe.ts` (NEW) | `probeAudio` (ffprobe) | 54 |
| `lib/worker/convert.ts` (NEW) | `convertToOgg` (loudnorm + gain + limiter + vorbis) | 87 |
| `lib/worker/diagnostics.ts` (NEW) | `analyzeOutputAudio` (volumedetect + quality warnings) | 65 |
| `lib/worker/media.ts` (CHANGED) | Orchestration only + barrel re-exports | 431→151 |

### [P2-06] Smoke/verify scripts

| Script | Command |
|---|---|
| `scripts/smoke-all.ts` (NEW) | Runs 8 smoke scripts sequentially, isolated temp DB per script, aggregate pass/fail |
| `npm run smoke` | `tsx scripts/smoke-all.ts` |
| `npm run verify` | `typecheck && lint && build && smoke` |

**Build:** ✅

---

## 7. File Tree Changes

### New files (16 files)

```txt
components/
  shared/action-icon-button.tsx
  jobs/job-audio-meta.tsx
  jobs/job-title-block.tsx
  convert/preset-toolbar.tsx
  convert/recent-queue-card.tsx
  credentials/credential-card.tsx
  settings/settings-tabs.tsx
  settings/settings-page-client.tsx
hooks/
  use-batch-audio-settings.ts
lib/
  api/client.ts
  jobs/mappers.ts
  worker/source.ts
  worker/probe.ts
  worker/convert.ts
  worker/diagnostics.ts
scripts/
  smoke-all.ts
```

### Modified files (16 files)

```txt
app/(dashboard)/settings/page.tsx
components/auto-cut/auto-cut-client.tsx
components/convert/convert-client.tsx
components/credentials/credential-form-card.tsx
components/credentials/credentials-manager.tsx
components/history/history-client.tsx
components/layout/app-sidebar.tsx
components/queue/job-card.tsx
components/queue/queue-client.tsx
components/settings/settings-defaults-card.tsx
lib/credentials/client.ts
lib/jobs/client.ts
lib/jobs/repository.ts
lib/presets/client.ts
lib/worker/media.ts
package.json
```

---

## 8. Architecture Diagram (Post-Refactor)

```txt
Frontend
├── shared/action-icon-button.tsx
├── jobs/
│   ├── job-title-block.tsx      # status + platform + title + URL
│   └── job-audio-meta.tsx       # speed/gain/quality/limiter/diagnostics
├── convert/
│   ├── preset-toolbar.tsx       # shared by Convert + Auto Cut
│   └── recent-queue-card.tsx    # shared
├── auto-cut/          ← uses same hooks + preset toolbar
├── history/
│   └── history-client.tsx       ← uses ActionIconButton + JobAudioMeta + JobTitleBlock
├── queue/
│   └── job-card.tsx             ← uses ActionIconButton + JobAudioMeta + JobTitleBlock
├── credentials/
│   └── credential-card.tsx      # replaces credential-table.tsx
└── settings/
    ├── settings-tabs.tsx
    └── settings-page-client.tsx

Hooks
└── use-batch-audio-settings.ts   # shared by Convert + Auto Cut

Lib
├── api/client.ts                 # centralized fetch helpers
├── jobs/
│   ├── mappers.ts                # pure data mappers
│   ├── client.ts                 # API client wrappers
│   └── repository.ts             # DB queries + lifecycle
├── worker/
│   ├── source.ts                 # yt-dlp download + local files
│   ├── probe.ts                  # ffprobe
│   ├── convert.ts                # ffmpeg OGG pipeline
│   ├── diagnostics.ts            # output quality checks
│   └── media.ts                  # orchestration

Scripts
└── smoke-all.ts                  # aggregate smoke test runner
```

---

## 9. Verification Status

Post-review verification:

```bash
npm run typecheck  # ✅ passed
npm run lint       # ✅ passed
npm run build      # ✅ passed
npm run smoke      # ✅ passed
```

---

## 10. Key Decisions Documented

| Decision | Rationale |
|---|---|
| `ActionIconButton` uses `href` prop for links | Avoids `asChild` invisible anchor bug. No self-closing `<a />`; external hrefs open in a new tab by default |
| `JobAudioMeta` has both compact + full variants | One component, two display modes. Avoids 2+ inline meta renders |
| `useBatchAudioSettings` returns `as const` | TypeScript dedupes the returned object to literal types |
| Settings tabs on client side only | TabNav + SettingsPageClient are pure UI; no DB import needed. Avoids `better-sqlite3` client compilation error |
| Credential cards instead of table | For likely 1-3 keys, cards are more scannable and mobile-friendly |
| English UI standard | Personal tool but consistent English professional tone avoids mixed-language confusion |
| Worker barrel re-exports | Backward compatible. Existing `from "@/lib/worker/media"` imports still resolve |
| Mappers barrel re-export from repository | 21+ imports unchanged. No migration needed |
| Repository split deferred for queries/commands | Mappers extracted first (pure, easy); queries/commands split can follow |

---

## 11. Post-review Fixes Applied

| Fix | Files |
|---|---|
| Escaped JSX quotes so lint passes | `components/convert/roblox-upload-card.tsx` |
| `RecentQueueCard.workerHint` now accepts React nodes, not HTML strings | `components/convert/recent-queue-card.tsx`, `convert-client.tsx`, `auto-cut-client.tsx` |
| Auto Cut shows the preset name input before saving | `components/auto-cut/auto-cut-client.tsx` |
| External `ActionIconButton` links default to `target="_blank" rel="noreferrer"` | `components/shared/action-icon-button.tsx` |
| Smoke runner isolates each script behind `tmp/smoke-suite/*.sqlite` and uses a 120s timeout | `scripts/smoke-all.ts` |
| Removed leftover local meta/dead imports after extraction | `components/history/history-client.tsx`, `components/queue/job-card.tsx`, `lib/worker/media.ts` |

---

## 12. Next Refactor Candidates (from roadmap)

These were identified but deferred:

| Item | Priority | Reason for defer |
|---|---|---|
| History mobile card mode (`md:hidden` + cards) | P1 | Would make mobile more usable; needs HistoryJobCard component |
| Settings default card copy: "Audio defaults" desc | P1 | Can be shortened |
| `lib/api/route.ts` — server-side API error helper | P2 | Would reduce route boilerplate, but not urgent |
| Split `repository.ts` queries/commands further | P2 | Mappers extracted; queries/commands still in repository.ts |
| Worker pipeline: add unit tests for filter string builders | P2 | Audio pipeline changes need fast feedback |
| DB migration strategy | P3 | Schema stable enough |
| Worker control UI (inline command copy) | P3 | Status banner exists; functional enough |
