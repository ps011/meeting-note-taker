# Aura Web — Design Spec

**Date:** 2026-05-21  
**Status:** Approved  
**Replaces:** Electron/macOS app (aura-meeting-recorder)

---

## Overview

Rewrite the Aura meeting recorder from an Electron macOS app to a Next.js web app. The primary motivation is eliminating macOS permission friction (screen recording, microphone entitlements, hardened runtime). The web version is a personal localhost tool — opened in a browser tab during meetings — with all processing remaining local and private.

---

## Architecture

```
Browser (client components)
├── Web Speech API        → real-time live transcript
├── IndexedDB             → recording history + session persistence
├── File System Access API → write .md files directly to Obsidian vault
├── Web Notifications API  → background completion/failure alerts
└── fetch → POST /api/summarize

Next.js server (localhost)
└── /api/summarize        → proxies to Ollama HTTP API (avoids browser CORS)
```

### Data flow for a meeting session

1. User configures title, template, participants → hits **Record**
2. `SpeechRecognition` starts in continuous mode; final + interim results stream into the live transcript panel
3. User hits **Stop** → accumulated final transcript sent to `POST /api/summarize`
4. API route calls Ollama (`http://localhost:11434/api/generate`), returns summary
5. Client formats note as Markdown (same frontmatter + sections as today)
6. Browser notification fires (if tab is backgrounded)
7. User saves to Obsidian vault via File System Access API and/or downloads `.md`
8. Session written to IndexedDB with status `completed`

### What stays from the current app

- All 7 meeting templates and their prompts (`templates.js` → `lib/templates.ts`)
- Markdown note format (YAML frontmatter + Summary + Full Transcription sections)
- Recording history concept with retry support
- Ollama/Llama summarisation (same API contract)

### What changes

| Current (Electron) | Web version |
|---|---|
| Whisper CLI binary (shell exec) | Web Speech API (real-time, in-browser) |
| `desktopCapturer` system audio | Microphone via `SpeechRecognition` |
| `electron-store` settings | `localStorage` |
| `fs.writeFileSync` to vault | File System Access API |
| Electron IPC | Standard `fetch` |
| macOS entitlements | Browser permission prompts |

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS — tokens copied verbatim from `personal/portfolio`
- **UI components:** Neobrutalism component set copied from `personal/portfolio/components/ui/`
- **Animations:** framer-motion
- **Icons:** lucide-react / @tabler/icons-react
- **Radix UI:** primitives as needed (same as portfolio)
- **Testing:** Vitest + fake-indexeddb

---

## Design System

Copied directly from `personal/portfolio` — no new tokens invented.

**Key tokens:**
- `border-3 border-border` — 3px solid black borders on all interactive elements
- `shadow-shadow` = `4px 4px 0px 0px #000000` — hard offset shadow
- Hover press: `hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none`
- `rounded-base: 5px`
- `--main: #3b82f6`, `--background: #eff6ff`, `--border: #000000`
- Font: DM Sans

**Button variants:** `default` (blue fill), `neutral` (background fill), `reverse` — all with 3px border + hard shadow.

---

## Pages

### `/` — Recording page

The primary view, opened during meetings.

```
┌─────────────────────────────────────────────────┐
│  AURA  [nav: Record | History | Settings]       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──── Meeting Setup ─────────────────────────┐ │
│  │ Title: [___________________]               │ │
│  │ Template: [General ▾]  Participants: [+]   │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│         ┌─────────────────────┐                 │
│         │  ● START RECORDING  │                 │
│         └─────────────────────┘                 │
│              00:00 elapsed                      │
│                                                 │
│  ┌──── Live Transcript ──────────────────────┐  │
│  │  "...discussing the Q3 roadmap and the    │  │
│  │   timeline for the mobile release..."     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Recording button states:**
- Idle: blue fill, `● START RECORDING`
- Recording: red fill, pulsing border, elapsed timer, `■ STOP`
- Processing: disabled, spinner

**After stop:** transcript panel transitions to 3-step progress (Summarising → Formatting → Saving), then reveals note result inline.

**Note result view:**
- Summary rendered as markdown (`markdown-body` class, same as portfolio blog)
- Expandable raw transcript
- Two action buttons: **Save to Vault** + **Download .md**

### `/history` — Past sessions

Grid of Cards: title, date, template Badge, status chip (completed / failed / processing).  
Inline actions: View Note, Retry (failed only), Delete.

### `/settings` — Configuration

Three Card sections:
1. **Ollama** — URL (default `http://localhost:11434`), model name
2. **Obsidian Vault** — folder picker button (File System Access API), shows selected path
3. **Defaults** — default template for new meetings, notification permission toggle

---

## Component Tree

```
app/
├── layout.tsx              — nav bar (Record / History / Settings links)
├── page.tsx                — RecordingPage
├── history/page.tsx        — HistoryPage
├── settings/page.tsx       — SettingsPage
└── api/summarize/route.ts  — Ollama proxy

components/
├── ui/                     — copied from portfolio (Button, Card, Badge, etc.)
├── MeetingSetup.tsx        — title, template picker, participants
├── RecordingButton.tsx     — start/stop, elapsed timer
├── LiveTranscript.tsx      — scrolling real-time speech text
├── ProcessingProgress.tsx  — 3-step stepper
├── NoteResult.tsx          — summary + transcript + save/download actions
├── HistoryCard.tsx         — single session card
└── HistoryFilter.tsx       — filter by status

lib/
├── speech.ts               — Web Speech API wrapper (continuous, interim results)
├── ollama.ts               — fetch wrapper for /api/summarize
├── templates.ts            — ported from src/templates.js (all 7 templates)
├── noteFormatter.ts        — Markdown generation (ported from src/noteWriter.js)
├── history.ts              — IndexedDB CRUD for recording sessions
├── vault.ts                — File System Access API (folder grant, write file)
└── notifications.ts        — Web Notifications API (request, fire, fallback)
```

---

## Session State

Managed via React context + `useReducer`:

```ts
type SessionStatus = 'idle' | 'recording' | 'processing' | 'completed' | 'error'

type SessionState = {
  status: SessionStatus
  title: string
  templateId: string
  participants: string[]
  liveTranscript: string      // appended by Web Speech final results
  interimTranscript: string   // replaced by interim results (shown lighter)
  summary: string | null
  notePath: string | null
  error: string | null
  elapsedSeconds: number
}
```

---

## API Route

### `POST /api/summarize`

**Request:**
```json
{ "transcript": "...", "title": "Q3 Planning", "templateId": "planning" }
```

**Response:**
```json
{ "summary": "..." }
```

**Error responses:**
- `503` — Ollama unreachable (`ECONNREFUSED`): `{ "error": "Could not reach Ollama at localhost:11434 — is it running?" }`
- `400` — Missing transcript
- `500` — Unexpected Ollama error

---

## Web Speech API

- `SpeechRecognition` in continuous mode, `interimResults: true`, `lang: 'en-US'`
- Final results appended to `liveTranscript`; interim results replace `interimTranscript`
- Interim text shown in muted colour in the transcript panel
- On unsupported browser: banner — *"Speech recognition requires Chrome or Edge."* Recording button disabled.
- `speech.ts` wraps the API with start/stop/event callbacks; no direct browser API calls outside this module

---

## File System Access API (Vault)

- First "Save to Vault" → `showDirectoryPicker()` → store handle in IndexedDB (handles survive page reload)
- Subsequent saves use stored handle directly — no prompt
- If permission lost (browser restarted): re-prompt gracefully on next save attempt
- Vault path displayed in Settings for confirmation
- **Download .md** always available as a fallback regardless of vault state

---

## Web Notifications

- Permission requested once, prompted from Settings page (not automatically on load)
- Notification on completion: *"Aura — Notes ready: [title]"* — clicking focuses tab, scrolls to result
- Notification on failure: *"Aura — Something went wrong. Open to retry."*
- If permission denied: silent fallback to in-app state, no re-prompting

---

## IndexedDB Schema

```ts
type RecordingRecord = {
  id: string               // uuid
  title: string
  templateId: string
  participants: string[]
  transcript: string
  summary: string | null
  notePath: string | null  // filename used, not a filesystem path
  status: 'completed' | 'failed' | 'processing'
  error: string | null
  createdAt: number        // timestamp
}
```

Store name: `recordings`. Indexed by `createdAt` (desc) for history list.

---

## Error Handling

| Scenario | Surface |
|---|---|
| Browser doesn't support Speech Recognition | Inline banner, record button disabled |
| Ollama unreachable | Inline error card with actionable message |
| Vault permission lost | Re-prompt on next save attempt |
| Vault write fails | Toast notification, Download fallback offered |
| Summarisation produces empty result | Error card, session marked failed, Retry available |
| Notification permission denied | Silent fallback, no re-prompt |

All errors recorded in IndexedDB. No silent failures.

---

## Testing

**Unit tests (Vitest):**
- `noteFormatter.ts` — Markdown output matches expected structure per template
- `history.ts` — IndexedDB CRUD (using `fake-indexeddb`)
- `templates.ts` — prompt interpolation (title + transcript substitution)

**Not unit tested** (browser-only APIs, tested manually):
- Web Speech API
- File System Access API
- Ollama proxy route

**Manual verification checklist:**
- [ ] Start/stop recording captures speech in Chrome/Edge
- [ ] Live transcript updates in real time (interim + final)
- [ ] Summary appears after Ollama processing
- [ ] Save to vault writes correct `.md` to Obsidian folder
- [ ] Download produces valid Markdown with correct frontmatter
- [ ] History page shows session with correct status and metadata
- [ ] Retry on failed session regenerates summary from stored transcript
- [ ] Browser notification fires when tab is backgrounded during processing
- [ ] Unsupported browser (Firefox) shows clear fallback banner
- [ ] Settings Ollama URL change takes effect on next recording

---

## Out of Scope

- Multi-user / authentication
- Cloud sync or remote database
- System audio capture (microphone only via Web Speech)
- Mobile support (desktop browser only)
- Whisper API fallback (Web Speech is the transcription layer)
