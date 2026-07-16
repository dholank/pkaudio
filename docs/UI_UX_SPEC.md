# PKAudio — UI-UX Specification

**Version:** 1.0
**Last Updated:** 2026-07-16
**Status:** Reflecting current implementation (v0.1.0-local)

---

## 1. Product Identity

PKAudio adalah localhost dashboard untuk workflow personal Roblox audio conversion. Target user: single developer/power-user yang mengelola konversi audio YouTube/SoundCloud → OGG → upload ke Roblox Creator Asset.

**Core persona:** Solo Roblox developer yang butuh convert banyak audio dengan cepat, setting audio yang predictable, dan upload + copy-paste Lua snippet ke game mereka.

**Brand attributes:** Tool-focused, technical-but-clean, dark-first, fast.

---

## 2. Design System

### 2.1 Color Tokens

Dark theme only — app forces `dark` class on `<html>`.

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `240 10% 4%` (~#09090b) | Page background |
| `--foreground` | `0 0% 98%` | Primary text |
| `--card` | `240 8% 7%` (~#111114) | Card surfaces |
| `--muted` | `240 6% 13%` | Muted surfaces |
| `--muted-foreground` | `240 5% 65%` (~#a1a1aa) | Secondary text |
| `--border` | `240 5% 17%` | Borders, dividers |
| `--primary` | `263 85% 66%` (violet) | Brand accent |
| `--secondary` / `--accent` | `190 95% 45%` (cyan) | Interactive accent |
| `--destructive` | `0 84% 60%` (rose/red) | Errors, danger actions |
| `--ring` | `263 85% 66%` | Focus ring |

**Functional color usage via Tailwind classes:**

| Context | Classes |
|---------|---------|
| Borders | `border-white/[0.08]` (standard), `border-white/10` (emphasized) |
| Surface hover | `bg-white/[0.035]` (default), `bg-white/[0.05]` (hover), `bg-white/[0.08]` (active) |
| Success/positive | `border-emerald-500/20 bg-emerald-500/10 text-emerald-200` |
| Warning | `border-amber-500/20 bg-amber-500/10 text-amber-100` |
| Error/danger | `border-rose-500/20 bg-rose-500/10 text-rose-100` |
| Info/cyan accent | `border-cyan-500/20 bg-cyan-500/10 text-cyan-200` |
| Violet accent | `bg-violet-500/15 text-violet-100` |

**Background gradients (body):**
```css
radial-gradient(circle at top left, rgba(139,92,246,0.16), transparent 32rem),
radial-gradient(circle at 80% 10%, rgba(6,182,212,0.12), transparent 28rem),
linear-gradient(180deg, #09090b 0%, #050507 100%)
```

**Brand gradient (logo icon, sidebar):** `from-violet-500 to-cyan-400`

**Text selection:** `rgba(139,92,246,0.42)` background, white text.

### 2.2 Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Page title (h1) | Geist Sans | 600 | `text-2xl`–`text-3xl` | `tracking-tight` |
| Card title (h2) | Geist Sans | 600 | `text-xl` | — |
| Section heading | Geist Sans | 500 | `text-sm`–`text-base` | — |
| Body | Geist Sans | 400 | `text-sm` | — |
| Helper / caption | Geist Sans | 400 | `text-xs` | — |
| Mono (IDs, paths, values) | Geist Mono | 400 | `text-xs`–`text-sm` | — |
| UPPERCASE labels | Geist Sans | — | `text-[11px]` | `tracking-[0.12em]`–`tracking-[0.16em]` |

**Font family consolidation:** `font-sans` maps to Geist Sans; `font-mono` maps to Geist Mono.

### 2.3 Spacing

- Page content padding: `px-4 py-6 sm:px-8 lg:py-8`
- Card internal padding: `p-4` to `p-5`
- Vertical stack gaps: `space-y-3` (tight), `space-y-6` (section)
- Grid gaps: `gap-3` to `gap-6`
- Sidebar width: `w-72` (288px)
- Content max-width: `max-w-[1500px]`

### 2.4 Border Radius

| Size | Token | Value | Usage |
|------|-------|-------|-------|
| Card | `rounded-2xl` | 16px | Cards, sidebar, panels |
| Subtle | `rounded-xl` | 12px | Inset surfaces, inner containers |
| Pill | `rounded-full` | — | Chips, speed presets, mobile nav pills |

### 2.5 Shadows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-glow` | `0 0 32px rgba(139,92,246,0.18)` | Logo icon in sidebar |
| `shadow-card` | `0 1px 0 rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.28)` | Cards |

### 2.6 Iconography

Library: **Lucide React** (`lucide-react`). Icons always sized `size-3` to `size-5` with accent colors matching context.

**Page icons (sidebar nav + topbar):**
- Convert: `AudioWaveform`
- Auto Cut: `Scissors`
- Queue: `ListMusic`
- Credentials: `KeyRound`
- History: `History`
- Settings: `Settings`

**Contextual accent icons:**
- Processing: `BarChart3`
- Success: `CheckCircle2`
- Error: `XCircle`
- Warning: `AlertTriangle`
- Audio: `FileAudio2`, `Volume2`, `Gauge`, `SlidersHorizontal`
- Security: `ShieldCheck`
- Upload: `UploadCloud`
- Logs: `Terminal`
- Copy: `Copy`
- Download: `Download`
- External: `ExternalLink`
- Info: `Info`
- Search: `Search`
- Filter: `Filter`
- Refresh: `RefreshCw`
- DB: `Database`
- Server: `Server`
- Activity: `Activity`
- Sparkles: `Sparkles`

---

## 3. Layout Architecture

### 3.1 Shell Structure

```
+---------------------------------------------------------+
|                         Topbar                           |
+--------+------------------------------------------------+
|        |                                                |
| Sidebar|              Main Content Area                 |
| (fixed)|            max-width: 1500px                    |
| 288px  |            px-4 sm:px-8                         |
|        |                                                |
+--------+------------------------------------------------+
```

**Sidebar** (`AppSidebar`):
- Fixed left, 288px wide, `lg+` only
- Always visible on desktop
- Background: `bg-[#0b0b0f]/92 backdrop-blur-xl`
- Border: right border `border-white/[0.08]`
- Contains:
  1. Logo (`AudioWaveform` icon in gradient box + "PKAudio" text + sparkle)
  2. Navigation (6 nav items, icon + label, active state highlighted)
  3. Info panel ("Local-first pipeline" feature list)
  4. Footer ("Local system" + live indicator + waveform bars + version)

**Mobile Nav** (`MobileNav`):
- Sticky top, `lg:hidden`
- Background: `bg-[#09090b]/90 backdrop-blur-xl`
- Contains: logo row + horizontal scrollable pill navigation
- Active pill: `border-violet-400/30 bg-violet-500/15 text-violet-100`

**Topbar** (`Topbar`):
- Below navbar / beside sidebar (inside `lg:pl-72`)
- Background: `bg-[#09090b]/72 backdrop-blur-xl` with audio grid pattern overlay
- Contains: page title + description + system status badges (SQLite, Queue, Worker)

**Main content area:**
- `mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8 lg:py-8`
- Stacks children vertically with `space-y-6`

### 3.2 Navigation States

| State | Desktop (sidebar) | Mobile (pills) |
|-------|-------------------|-----------------|
| Active | `bg-white/[0.08] text-white` + cyan icon + inner shadow | `border-violet-400/30 bg-violet-500/15 text-violet-100` |
| Inactive | `text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200` | `border-white/10 bg-white/[0.035] text-zinc-400` |

### 3.3 Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| Default (mobile) | Full-width, stacked layout, mobile nav |
| `sm` (640px) | Horizontal padding increases, grids go 2-col |
| `md` (768px) | 3-col grids in filter areas |
| `lg` (1024px) | Sidebar appears, mobile nav hides |
| `xl` (1280px) | Convert: 2-col layout (source URLs + audio settings) |
| `2xl` (1536px) | Wider columns in Convert page |

---

## 4. Page Specifications

### 4.1 `/convert` — Convert Audio

**Primary goal:** Submit multiple YouTube/SoundCloud URLs for batch audio conversion.

**Page flow:**
1. User pastes URLs into textarea
2. Each URL auto-validates (debounced)
3. User adjusts audio settings or uses presets
4. User optionally enables Roblox upload with credential
5. User clicks "Start Converting"
6. Jobs appear in recent queue preview

**Component layout (top to bottom):**
```
[PresetToolbar]
[grid: SourceUrlsCard | AudioSettingsCard]
[RobloxUploadCard]
[BatchSummaryCard]
[RecentQueueCard]
```

#### 4.1.1 PresetToolbar
- Horizontal row: preset dropdown + save button + optional name input
- Presets load saved audio settings (speed, gain, LUFS, quality, safety mode)
- "Save as Preset" button opens inline name input

#### 4.1.2 SourceUrlsCard
- Large textarea for URL input (one URL per line)
- Real-time stats: total lines, valid URLs, invalid/unsupported
- Deduplication (case-insensitive)
- Supported platforms: YouTube (`youtube.com`, `youtu.be`), SoundCloud (`soundcloud.com`)
- Auto-trim whitespace, skip empty lines

#### 4.1.3 AudioSettingsCard
- **Safety mode** dropdown:
  - "Roblox Safe" (preset: -14 LUFS, -3 dBFS peak, limiter ON)
  - "Custom"
- **Quality** dropdown: q5, q6, q7, q8 (with per-quality descriptions)
- **Speed** slider (0.5–3.0, step 0.01) + number input + quick-preset pills: 1x, 1.25x, 1.5x, 2x, 2.3x
- **Gain trim** slider (-12 to +12 dB, step 0.5) + number input + quick-preset pills: -3, 0, +3, +6
- **Limiter + normalize** toggle
  - When ON: LUFS target slider + Peak limit slider (both disabled when OFF)
- **Warning panel:** conditional warnings for extreme settings (amber/rose alerts)
- **Summary footer:** "Final output: OGG • 44.1kHz • Stereo • Q7 • -14 LUFS → peak ≤ -3 dBFS"

#### 4.1.4 RobloxUploadCard
- Auto-upload toggle
- Credential selector (dropdown of saved credentials)
- Asset name pattern input (with placeholder describing default behavior)
- Only shows full options when upload enabled

#### 4.1.5 BatchSummaryCard
- Summary stats: valid URLs count, speed, gain, quality, safety mode, upload setting
- "Start Converting" button (disabled if no valid URLs, or upload enabled but no credential selected)
- Loading state on button while request in flight

#### 4.1.6 RecentQueueCard
- Shows up to 5 most recent jobs from the batch just created
- Worker hint: "Run `npm run worker` to convert & auto-upload."
- Empty state: "No active jobs — Paste a YouTube or SoundCloud URL to start converting audio for Roblox."

### 4.2 `/auto-cut` — Auto Cut

**Primary goal:** Split long audio into Roblox-compatible parts with optional overlap.

Follows same structural pattern as Convert but with additional trim/overlap configuration.

### 4.3 `/queue` — Queue

**Primary goal:** Monitor the latest batch's jobs — download, conversion, upload, moderation.

**Component layout:**
```
[WorkerStatusBanner]
[Latest Batch Overview Card]
[Stats grid (4 cards)]
[Filter Card]
[Job cards list]
[JobLogDialog (modal)]
```

#### 4.3.1 WorkerStatusBanner
- Conditional banner: shows only when worker is down/stale
- Status: connected, disconnected, last heartbeat
- Visual: amber/rose background depending on severity

#### 4.3.2 Latest Batch Overview Card
- Gradient border: `border-cyan-500/20` with cyan-to-violet gradient BG
- Batch ID (truncated, monospace), batch status badge
- Description: "Queue shows only the latest batch..."
- Actions: "Copy code" (all approved jobs → Lua module), "History" link

#### 4.3.3 Stats Grid
4 stat cards (responsive: 1→2→4 columns):
- Converting (count of queued/downloading/probing/converting)
- Converted (count of converted/uploading/done + has output)
- Uploaded (has assetId)
- Accepted (robloxModerationState === "approved")

Each: label (uppercase), large number, small badge.

#### 4.3.4 Filter Card
- Search input with magnifier icon
- Status dropdown (All, Queued, Downloading, Probing, Converting, Converted, Uploading, Done, Failed, Cancelled)
- Refresh button (with spin animation while loading)

**Auto-polling:** 2.5s interval when live jobs or pending moderation exist.

#### 4.3.5 QueueAudioCard (Job Card)

Each job card is a rich card containing:

**Left: Thumbnail area** — gradient square with `FileAudio2` icon (future: actual YouTube thumbnail).

**Status chips (3 badges):**
1. Convert status: Converting / Converted / Failed / Cancelled / Queued (color + icon vary)
2. Upload status: Local only / Uploading / Uploaded / Upload failed (color + icon vary)
3. Moderation status: Accepted / Reviewing / Rejected / Not checked (with attempt count)

**Content:**
- Source platform badge (YouTube / SoundCloud)
- Title (h3, white, semibold)
- Source URL (monospace, cyan, clickable, external link)
- Audio settings row (speed, gain, quality, safety mode, LUFS→peak, duration, file size)
- Normal speed info chip (in-game reciprocal speed)
- Asset ID chip (cyan, clickable, copies Lua snippet)
- Progress bar (when job not done, shows % and attempt count)
- Error block (rose background, when failed)

**Right: Waveform** (when output exists) — mini waveform visualization.

**Bottom: Action buttons row:**
- Logs (terminal icon)
- Copy Code (when has asset id)
- Roblox audit (when has operation id)
- Moderation check (when has asset id)
- External link to Roblox asset page
- Download OGG (when output exists)

#### 4.3.6 JobLogDialog
- Modal/dialog showing job processing logs
- Timestamped log entries
- Loading state while fetching
- Auto-refreshes job data in parent list

### 4.4 `/credentials` — Credentials

**Primary goal:** Manage encrypted Roblox Open Cloud API keys.

**Page layout:**
```
[CredentialsManager]
  ├── Add credential form (collapsed by default, expandable)
  └── Credential table/cards
       ├── Label, Creator type+ID, API key mask (last 4), status badge
       ├── Validate button
       ├── Edit button
       └── Delete button
```

**Add credential form fields:**
- Label (required)
- Creator type: User / Group
- Creator ID
- API Key input (masked after save)
- Validation status display after test

**Security behavior:**
- Full API key never sent back to frontend after initial save
- Only last 4 characters shown (masked)
- Validate button tests key without revealing it
- Delete requires confirmation

**Status badge variants:**
- Valid (green) / Invalid (red) / Expired (amber) / Missing scope (amber) / Wrong target (amber) / Unknown (muted)

### 4.5 `/history` — History

**Primary goal:** Search, filter, export, and manage all past jobs across all batches.

**Page layout:**
```
[HistoryClient]
  ├── Search/filter bar
  │    ├── Search input (searches title, URL, asset ID)
  │    ├── Status filter dropdown
  │    ├── Roblox moderation filter dropdown
  │    ├── Sort: newest/oldest
  │    └── Export buttons (CSV, JSON)
  ├── Bulk selection controls (when items selected)
  │    └── Copy All Lua code, Delete All
  ├── Data table
  │    ├── Checkbox column (for bulk actions)
  │    ├── Title + thumbnail
  │    ├── Status badge
  │    ├── Speed
  │    ├── Gain
  │    ├── Quality
  │    ├── Duration
  │    ├── Size
  │    ├── Asset ID
  │    ├── Moderation status
  │    ├── Created (relative: "5m ago", "2h ago", "3d ago")
  │    └── Actions (icon buttons for logs, download, retry, delete)
  └── JobLogDialog (shared with Queue)
```

**Table row hover:** `hover:bg-white/[0.03]`

**Bulk actions:**
- Select all / deselect all
- Copy All Lua code (only jobs with assetId + approved moderation)
- Delete all selected (only deletable-status jobs)

**Export:** CSV and JSON via API endpoint, preserving current filters/sort/query in URL params.

**Empty state:** "No history yet. Convert some audio to see it here."

### 4.6 `/settings` — Settings

**Primary goal:** Configure defaults, manage presets, worker health, backup/restore, storage cleanup, QA doctor.

**Page layout (vertical stack of cards):**

#### 4.6.1 SettingsDefaultsCard
- Default speed
- Default gain
- Default quality
- Default safety mode
- Default LUFS target
- Default headroom
- Save button

#### 4.6.2 AudioPresetsCard
- List saved presets with their settings displayed
- Each preset: name, settings summary, load/edit/delete actions
- Create new preset form

#### 4.6.3 WorkerHealthCard
- Worker status: running/stopped/stale
- Last heartbeat timestamp
- Active jobs count
- Completed jobs count
- Concurrency config

#### 4.6.4 BackupRestoreCard
- Create backup (DB only or DB + outputs)
- Restore from backup (with rollback)
- List existing backups (timestamps, sizes, manifests)
- Download/delete individual backups

#### 4.6.5 StorageCleanupCard
- Disk usage stats (outputs, tmp, database)
- Cleanup actions: clear temp files, clear old outputs
- Confirmation dialogs for destructive actions

#### 4.6.6 FinalQACard
- System doctor diagnostics
- Tool availability checks (ffmpeg, yt-dlp, node/npm versions)
- Database integrity check
- Worker connectivity check
- Run full QA button

#### 4.6.7 SystemStatusCard
- App version
- Node version
- SQLite status
- Queue DB status
- Uptime
- Memory usage

**Tabs variant:** On narrow screens, settings sections can be organized via tabs (`SettingsTabs`) to reduce vertical scroll.

---

## 5. Shared Component Library

### 5.1 Cards

All cards use consistent styling via the `.pkaudio-card` utility:
```css
rounded-2xl border border-white/[0.08] bg-[#111114]/90 shadow-card backdrop-blur
```

**Card structure:**
- `CardHeader`: title (h2/h3) + optional description
- `CardContent`: main content, usually `space-y-3` to `space-y-6`

**Special cards:**
- Accent/gradient cards: queue batch overview (`border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-[#111114] to-violet-500/10`)
- Error cards: `border-rose-500/20 bg-rose-500/10`
- Warning cards: `border-amber-500/20 bg-amber-500/10`

### 5.2 Badges

Variant system:
| Variant | Usage | Example |
|---------|-------|---------|
| `success` (emerald) | Completed, uploaded, approved, accepted | "Converted" |
| `destructive` (rose) | Failed, rejected, error | "Failed" |
| `warning` (amber) | Pending, reviewing, warning | "Pending" |
| `cyan` (cyan) | In progress, converting, uploading | "Converting" |
| `secondary` (muted) | Neutral, queued, not checked | "Queued" |
| `outline` | Platform labels, supplementary | "YouTube" |

Uppercase labels with tracking: `text-[11px] uppercase tracking-[0.12em]`

### 5.3 Buttons

| Variant | Usage | Visual |
|---------|-------|--------|
| Default (filled) | Primary actions | Violet/cyan gradient or solid |
| `outline` | Secondary actions, filter toolbars | Border white/10, transparent bg |
| `ghost` | Tertiary, links disguised as buttons | No border, subtle hover |
| `destructive` | Delete, dangerous actions | Rose/red |

All buttons: `rounded-xl`, `h-9` or `h-8` for `size="sm"`.

Icons inside buttons: always left-aligned, `size-4`.

**Icon-only buttons:** For table actions (logs, download, retry, delete) via `ActionIconButton` — tooltip on hover.

### 5.4 Inputs & Controls

**Text inputs:** `.pkaudio-field` — `border-white/10 bg-[#09090b] text-white`, with focus ring `violet-400/70`, placeholder `text-zinc-600`.

**Select dropdowns:** Radix Select with custom trigger styling matching inputs.

**Sliders:** Radix Slider with:
- Track: `bg-white/10`
- Range: `bg-violet-500` or `bg-cyan-500`
- Thumb: white circle with shadow

**Switches:** Radix Switch with:
- Unchecked: `bg-white/10`
- Checked: `bg-violet-500`

**Textareas:** Matching input styling, for URL input.

### 5.5 Progress

Radix Progress bar:
- Background: `bg-white/10`
- Indicator: `bg-gradient-to-r from-violet-500 to-cyan-400`
- Height: `h-2`
- Rounded: `rounded-full`

### 5.6 Scrollable Areas

Radix ScrollArea for content-heavy containers (history table, log dialogs).

### 5.7 Empty State

`EmptyState` component: icon (large, muted), title, description, optional action button with link.

Example: `/queue` when no jobs:
```
[ListMusic icon, size-10, text-zinc-600]
"No latest queue items"
"Start a new batch from Convert. Older converted/uploaded audio is available in History."
[Go to Convert button → /convert]
```

### 5.8 Waveform Visualization

`WaveformLoudnessGraph` / `QueueMiniWaveform`: renders pre-computed waveform data from `.waveform.json` files as SVG bars with LUFS loudness coloring:
- Green: within safe range
- Amber: approaching peak limit
- Red: clipping/over peak limit

### 5.9 Job Title Block

`JobTitleBlock`: reusable component showing thumbnail + title + source URL + platform badge. Used in queue cards and history table.

### 5.10 Audio Meta

`JobAudioMeta`: displays audio settings (speed, gain, quality, LUFS, headroom, limiter state) in a compact row. `JobOutputDiagnostics` adds duration and file size.

---

## 6. Interaction Patterns

### 6.1 Notifications (Toast)

Library: **Sonner** (`sonner`)
- Position: bottom-right
- Theme: dark with `richColors`
- Duration: default (~4s)
- Types: success (emerald), error (rose), info (cyan), warning (amber)

**Toast usage rules:**
- One toast per user action
- Success on complete: "Batch queued with 5 jobs."
- Error with message: "Failed to start batch." (user-facing, not raw error)
- Info for supplementary: "3 queue items skipped because upload is not done yet."

### 6.2 Loading States

| Context | Pattern |
|---------|---------|
| Button action | Button text changes + `disabled` + subtle opacity |
| Data fetching (initial) | Skeleton cards / shimmer |
| Data fetching (refresh) | Spinning `RefreshCw` icon on button |
| Polling | Silent background refresh, no visual indicator |
| Log dialog loading | "Loading..." text + `logsLoading` state |
| Progress jobs | Progress bar with % and attempt count |

### 6.3 Empty States

Every list/table section shows an `EmptyState` when empty — never just blank space.

| Page | Condition | Message |
|------|-----------|---------|
| Convert (recent queue) | No jobs | "No active jobs — Paste a YouTube or SoundCloud URL..." |
| Queue (filtered) | No matches | "No latest queue items" → Go to Convert |
| History | No jobs at all | "No history yet. Convert some audio to see it here." |
| History (filtered) | No matches | "No results for this filter." + clear filter hint |
| Credentials | No saved keys | "No credentials yet. Add your first Roblox API key." |

### 6.4 Error States

- Inline errors: rose-tinted card/pill below the affected context
- API errors: toast notification with user-facing message
- Job errors: displayed inside job card as rose block with error text
- Network failures: toast "Failed to fetch..." with retry suggestion

### 6.5 Confirmation Dialogs

Destructive actions must confirm via:
- Native `confirm()` for simple delete operations
- Inline confirmation text for high-risk operations (backup restore, credential delete)

### 6.6 Copy Behavior

| Context | Trigger | Format |
|---------|---------|--------|
| Single asset ID | Click chip on Queue card | Lua snippet: `{ SongName = "...", SoundId = "rbxassetid://...", ... }` |
| All codes (Queue) | "Copy code" button | Full Lua module with all approved jobs |
| All codes (History) | Bulk selection + Copy | Same Lua module format |
| Clipboard unavailable | Button click | Toast: "Clipboard is not available in this browser." |

### 6.7 External Links

- Source URLs: open in new tab (`target="_blank" rel="noreferrer"`)
- Roblox asset pages: `https://create.roblox.com/store/asset/{assetId}`
- History → Queue navigation via Link components

---

## 7. Copywriting & Tone

**Language:** English for UI labels, technical descriptions; mixed English + Indonesian acceptable for docs/comments. UI should be consistently English.

**Tone:** Technical but approachable. Direct, no marketing fluff.

**Rules:**
- Labels: short, imperative where applicable ("Save Preset", "Start Converting", "Copy Code")
- Descriptions: one sentence, explains the action ("Download, speed-shift, amplify, encode OGG, and upload Roblox assets in one batch.")
- Helper text: practical guidance ("Run `npm run worker` to convert & auto-upload.")
- Error messages: say what happened + what to do. Never expose raw stack traces.
- Monospace: used for technical values (file paths, CLI commands, asset IDs, speed values)
- UPPERCASE: reserved for badge labels only (`text-[11px] uppercase tracking-[0.12em]`)

**Capitalization:**
- Page titles: Title Case ("Convert Audio", "Auto Cut")
- Card titles: Title Case
- Labels: Sentence case ("Safety mode", "Gain trim")
- Buttons: Title Case ("Start Converting", "Save Preset")
- Badges: UPPERCASE

---

## 8. Responsive Behavior Summary

| Component | Mobile (<640px) | Tablet (640–1023px) | Desktop (1024px+) |
|-----------|-----------------|---------------------|-------------------|
| Navigation | Horizontal scroll pills | Horizontal scroll pills | Fixed left sidebar |
| Convert layout | Stacked cards | Stacked cards | 2-column grid |
| Stats grid | 1 column | 2 columns | 4 columns |
| Filter bar | Stacked | 3-column grid | 3-column grid |
| Job card | Stacked info + waveform | Row layout | Row layout |
| History table | Horizontal scroll | Horizontal scroll | Full table |
| Settings cards | Stacked | Stacked | Stacked |
| Modals/dialogs | Full-width sheet | Centered dialog | Centered dialog |

---

## 9. Accessibility Notes

- All interactive elements have focus-visible ring (`ring-violet-400/70`)
- Color is never the only differentiator — status always paired with icon + text label
- Button text is descriptive, not icon-only (except `ActionIconButton` with tooltip)
- `prefers-reduced-motion`: spinner animations respect user preference
- Keyboard navigation works for select dropdowns, switches, sliders (Radix primitives)
- External links use `rel="noreferrer"`
- Monospace text for copyable values
- Toast notifications are screen-reader accessible (Sonner)

---

## 10. State Transitions Reference

### Job Status Flow

```
queued → downloading → probing → converting → converted → (uploading) → done
  ↓         ↓           ↓           ↓             ↓            ↓
cancelled  failed      failed      failed        failed      failed
```

### Upload Flow (when enabled)

```
converted → uploading → done (w/ assetId + operationId)
                 ↓
              failed
```

### Moderation Flow (post-upload)

```
none → reviewing → approved
  ↓        ↓           ↓
  ↓     failed      rejected
  ↓        ↓
  . → (retry check)
```

### Credential Validation States

```
unknown → validating... → valid / invalid / expired / disabled / missing_scope / wrong_creator_target
```

---

## 11. Design Decisions & Rationale

1. **Dark-only theme:** Tool runs on localhost, not consumer-facing. Dark theme reduces eye strain for long sessions and matches developer tooling aesthetic.

2. **Sidebar over top nav:** 6 sections is too many for top bar; sidebar allows icon+label and extra info panels.

3. **No multi-select on Queue page:** Queue is read-only monitor. Multi-select is reserved for History where bulk operations make sense.

4. **Rich job cards over dense table on Queue:** Queue is the "action center" — users need to see logs, copy codes, check status quickly. Table is for scanning/searching (History).

5. **Presets as first-class UI:** Toolbar at top of Convert page signals presets are the recommended workflow — set once, reuse.

6. **Auto-polling only when live:** TanStack Query polling at 2.5s only when jobs are in active states or moderation is pending. Saves resources.

7. **Gradient accents instead of solid colors:** Violet-cyan gradient is the brand; used on logo, progress bars, accent cards. Creates visual identity without being overpowering.

8. **Monospace for technical data:** All IDs, paths, values, and CLI commands use `font-mono` for scannability and copy-paste mental mapping.

9. **UPPERCASE badges:** Small badges with tracking create visual rhythm in dense cards — users scan statuses quickly.

10. **Footer in sidebar with "Live" indicator + waveform bars:** Reinforces "local system, always on" identity. The waveform bars are purely decorative but provide visual interest in an otherwise empty sidebar bottom.
