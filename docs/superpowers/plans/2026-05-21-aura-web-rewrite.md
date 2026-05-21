# Aura Web Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Electron macOS app with a Next.js web app that records meetings via Web Speech API, summarises via local Ollama, and saves notes as Markdown to an Obsidian vault.

**Architecture:** Browser handles recording (Web Speech API), history (IndexedDB), and vault writes (File System Access API). A single Next.js API route proxies summarisation requests to Ollama to avoid CORS. All data stays local.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS (neobrutalism tokens from portfolio), Radix UI, framer-motion, lucide-react, idb, vitest, fake-indexeddb.

---

## File Map

```
app/
  layout.tsx                   — root layout with nav
  page.tsx                     — recording page
  history/page.tsx             — past sessions
  settings/page.tsx            — ollama config, vault picker, defaults
  api/summarize/route.ts       — Ollama proxy

components/
  ui/
    button.tsx                 — neobrutalism button (copied from portfolio)
    card.tsx                   — neobrutalism card
    badge.tsx                  — neobrutalism badge
  MeetingSetup.tsx             — title, template picker, participants
  RecordingButton.tsx          — start/stop, elapsed timer, states
  LiveTranscript.tsx           — real-time scrolling speech text
  ProcessingProgress.tsx       — 3-step progress stepper
  NoteResult.tsx               — summary view + save/download actions
  HistoryCard.tsx              — single session card with actions
  HistoryFilter.tsx            — filter bar (all/completed/failed)

lib/
  utils.ts                     — cn() helper
  templates.ts                 — 7 meeting templates (ported from src/templates.js)
  noteFormatter.ts             — Markdown note generation (ported from src/noteWriter.js)
  speech.ts                    — Web Speech API wrapper
  history.ts                   — IndexedDB CRUD via idb
  vault.ts                     — File System Access API (folder grant + write)
  notifications.ts             — Web Notifications API (request, fire, fallback)
  ollama.ts                    — fetch wrapper for /api/summarize
  session-context.tsx          — React context + useReducer for session state

styles/
  globals.css                  — Tailwind base + neobrutalism CSS vars + markdown-body

package.json                   — Next.js project (replaces Electron)
next.config.js
tailwind.config.js             — tokens from portfolio
tsconfig.json
postcss.config.js

tests/
  lib/templates.test.ts
  lib/noteFormatter.test.ts
  lib/history.test.ts
  vitest.config.ts
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Replace: `package.json`
- Create: `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `vitest.config.ts`, `styles/globals.css`, `lib/utils.ts`

- [ ] **Step 1.1: Replace package.json**

```json
{
  "name": "aura-web",
  "version": "2.0.0",
  "description": "Meeting recorder and note-taker — web edition",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.0.0",
    "idb": "^8.0.0",
    "lucide-react": "^0.460.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.0",
    "uuid": "^10.0.0",
    "@radix-ui/react-slot": "^1.1.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "fake-indexeddb": "^6.0.0",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 1.2: Create next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
```

- [ ] **Step 1.3: Create tailwind.config.js** (copy tokens from portfolio)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      borderRadius: { base: '5px' },
      borderWidth: { '3': '3px' },
      boxShadow: {
        shadow: '4px 4px 0px 0px #000000',
        'shadow-sm': '2px 2px 0px 0px #000000',
      },
      translate: {
        boxShadowX: '4px',
        boxShadowY: '4px',
        reverseBoxShadowX: '-4px',
        reverseBoxShadowY: '-4px',
      },
      colors: {
        main: 'var(--main)',
        'main-foreground': 'var(--main-foreground)',
        border: 'var(--border)',
        foreground: 'var(--foreground)',
        background: 'var(--background)',
        'secondary-background': 'var(--secondary-background)',
        ring: 'var(--ring)',
        'muted-foreground': 'var(--muted-foreground)',
      },
      fontWeight: { base: '500', heading: '700' },
      fontFamily: { sans: ['var(--font-sans)'] },
    },
  },
  plugins: [],
}
```

- [ ] **Step 1.4: Create postcss.config.js**

```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

- [ ] **Step 1.5: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.6: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 1.7: Create styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-sans: 'DM Sans', sans-serif;
    --background: #eff6ff;
    --foreground: #000000;
    --main: #3b82f6;
    --main-foreground: #ffffff;
    --border: #000000;
    --secondary-background: #ffffff;
    --ring: #000000;
    --muted-foreground: #333333;
  }
  html, body {
    margin: 0;
    padding: 0;
    font-family: var(--font-sans);
    background: var(--background);
    color: var(--foreground);
  }
  h1, h2, h3, h4, h5, h6 { font-weight: 700; }
}

@layer components {
  .markdown-body { color: var(--foreground); font-size: 1.0625rem; line-height: 1.75; }
  .markdown-body > *:first-child { margin-top: 0; }
  .markdown-body > *:last-child { margin-bottom: 0; }
  .markdown-body h1 { font-size: 2.25rem; font-weight: 700; margin: 3rem 0 1.25rem; }
  .markdown-body h2 { font-size: 1.75rem; font-weight: 700; margin: 2.5rem 0 1rem; padding-bottom: 0.375rem; border-bottom: 2px solid var(--border); }
  .markdown-body h3 { font-size: 1.375rem; font-weight: 700; margin: 2rem 0 0.75rem; }
  .markdown-body p { margin: 0 0 1.25rem; }
  .markdown-body strong { font-weight: 700; }
  .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; margin: 0 0 1.25rem; }
  .markdown-body ul { list-style: disc; }
  .markdown-body ol { list-style: decimal; }
  .markdown-body li { margin-bottom: 0.375rem; }
  .markdown-body li::marker { color: var(--main); }
  .markdown-body blockquote { border-left: 5px solid var(--main); background: var(--secondary-background); padding: 0.875rem 1.25rem; margin: 1.5rem 0; border-radius: 5px; }
  .markdown-body code { font-family: ui-monospace, monospace; background: var(--secondary-background); padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.9em; border: 1px solid var(--border); }
  .markdown-body pre { background: var(--secondary-background); padding: 1rem 1.25rem; border: 3px solid var(--border); border-radius: 5px; box-shadow: 4px 4px 0px 0px var(--border); margin: 1.5rem 0; overflow-x: auto; }
  .markdown-body pre code { background: transparent; border: none; padding: 0; }
  .markdown-body hr { border: 0; border-top: 3px solid var(--border); margin: 2.5rem 0; }
}
```

- [ ] **Step 1.8: Create lib/utils.ts**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 1.9: Install dependencies**

```bash
npm install
```

Expected: node_modules populated, no errors.

- [ ] **Step 1.10: Verify Next.js starts**

```bash
npm run dev
```

Expected: server starts on localhost:3000 (will 404 since no pages yet — that's fine).

- [ ] **Step 1.11: Commit**

```bash
git add package.json next.config.js tailwind.config.js postcss.config.js tsconfig.json vitest.config.ts styles/globals.css lib/utils.ts
git commit -m "feat: scaffold Next.js project with neobrutalism design tokens"
```

---

## Task 2: Port templates and note formatter

**Files:**
- Create: `lib/templates.ts`
- Create: `lib/noteFormatter.ts`

- [ ] **Step 2.1: Create lib/templates.ts**

```ts
export type TemplateId = 'general' | 'sales' | 'interview' | 'standup' | 'oneOnOne' | 'retrospective' | 'planning'

export type Template = {
  id: TemplateId
  name: string
  description: string
  icon: string
  prompt: string
}

const TEMPLATES: Record<TemplateId, Template> = {
  general: {
    id: 'general',
    name: 'General Meeting',
    description: 'Standard meeting notes for any type of meeting',
    icon: '📋',
    prompt: `You are an expert meeting note-taker. Analyze the following meeting transcription and create a comprehensive summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

Please create a well-structured summary with the following sections:

## Meeting Overview
Provide a brief overview including meeting purpose, key participants, and context.

## Key Discussion Points
List and elaborate on the main topics discussed with specific details and data points.

## Decisions Made
Document all decisions and agreements reached with rationale.

## Action Items
List all tasks with responsible party, due date, and dependencies.

## Next Steps
Outline follow-up actions, future meetings, and milestones.

## Additional Notes
Include questions raised, concerns, risks, and resources mentioned.

Format your response in clean markdown. Be thorough and include specific details from the transcription.`,
  },
  sales: {
    id: 'sales',
    name: 'Sales Call',
    description: 'For sales calls, demos, and client meetings',
    icon: '💼',
    prompt: `You are an expert sales meeting note-taker. Analyze the following sales call transcription and create a comprehensive summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Meeting Overview
Client/Prospect name, meeting type, sales stage, key participants.

## Client Information
Company background, pain points, budget, timeline, decision-making process.

## Product/Demo Discussion
Features discussed, client questions, objections and responses, competitive mentions.

## Pricing & Terms
Pricing discussed, payment terms, discounts, decision timeline.

## Next Steps & Follow-up
Action items with owners, materials to send, next meeting, decision date.

## Key Quotes & Insights
Important client quotes revealing pain points, budget signals, decision criteria.

Format in clean markdown with specific details, numbers, and quotes from the transcription.`,
  },
  interview: {
    id: 'interview',
    name: 'Job Interview',
    description: 'For candidate interviews and hiring discussions',
    icon: '👤',
    prompt: `You are an expert interview note-taker. Analyze the following job interview transcription and create a comprehensive summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Interview Overview
Candidate name, position, interview type, interviewers, duration.

## Candidate Background
Current role, years of experience, education, relevant skills.

## Technical Assessment
Technical questions and answers, strengths, gaps, specific examples.

## Behavioral Assessment
Past experience examples, leadership, teamwork, cultural fit.

## Candidate Questions
Questions asked, topics of interest, concerns raised.

## Overall Assessment
Strengths, concerns, recommendation, comparison to requirements, next steps.

Format in clean markdown with specific examples and quotes.`,
  },
  standup: {
    id: 'standup',
    name: 'Standup / Daily Sync',
    description: 'For daily standups and team syncs',
    icon: '🔄',
    prompt: `You are an expert standup meeting note-taker. Analyze the following standup transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Standup Overview
Date, team members present, duration.

## Individual Updates
For each team member: what they completed, what they're working on today, blockers, help needed.

## Team Metrics & Progress
Sprint progress, velocity, key metrics, deadlines.

## Blockers & Dependencies
All blockers, who is blocked, dependencies, escalations.

## Action Items
Follow-up tasks, blockers to resolve, next steps.

Format in clean markdown. Be concise but include specific task names and ticket numbers.`,
  },
  oneOnOne: {
    id: 'oneOnOne',
    name: '1-on-1 Meeting',
    description: 'For manager-employee 1-on-1s',
    icon: '🤝',
    prompt: `You are an expert 1-on-1 meeting note-taker. Analyze the following 1-on-1 transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Meeting Overview
Participants, date, duration, format.

## Updates & Progress
Work updates, current projects, goal progress, wins.

## Challenges & Concerns
Obstacles, support needed, concerns, workload issues.

## Career Development
Career goals, growth opportunities, skills to develop, training needs.

## Feedback
Manager feedback, employee feedback, areas of improvement, recognition.

## Action Items
Commitments, follow-up items, resources to provide, next steps.

Format in clean markdown. Be thorough and maintain confidentiality.`,
  },
  retrospective: {
    id: 'retrospective',
    name: 'Retrospective',
    description: 'For sprint retros and team retrospectives',
    icon: '🔁',
    prompt: `You are an expert retrospective note-taker. Analyze the following retrospective transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Retrospective Overview
Sprint/period reviewed, team members, retrospective format.

## What Went Well
Successes, positive feedback, processes that worked, specific examples.

## What Didn't Go Well
Challenges, process issues, communication breakdowns, specific examples.

## Action Items
Improvements to implement, process changes, owners, timelines, success metrics.

## Experiments & Changes
New approaches, experiments to run, team agreements.

## Team Health
Morale, workload, burnout indicators, support needed.

Format in clean markdown with specific examples and actionable items.`,
  },
  planning: {
    id: 'planning',
    name: 'Planning Meeting',
    description: 'For sprint planning, project planning, and roadmap sessions',
    icon: '📅',
    prompt: `You are an expert planning meeting note-taker. Analyze the following planning meeting transcription and create a summary in markdown format.

Meeting Title: {meetingTitle}

Transcription:
{transcription}

## Planning Overview
Planning period, participants, goals, timeline.

## Scope & Priorities
Features planned, priority order, must-have vs nice-to-have, dependencies.

## Estimates & Capacity
Effort estimates, team capacity, velocity expectations, risk factors.

## Timeline & Milestones
Key dates, milestones, sprint boundaries, critical path.

## Risks & Dependencies
Identified risks, external dependencies, blockers, assumptions.

## Action Items & Decisions
Tasks assigned, decisions made, technical decisions, resource allocations.

Format in clean markdown with specific details, numbers, dates, and actionable items.`,
  },
}

export function getTemplate(id: TemplateId | string): Template {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.general
}

export function getAllTemplates(): Template[] {
  return Object.values(TEMPLATES)
}

export function buildPrompt(template: Template, transcription: string, meetingTitle: string): string {
  return template.prompt
    .replace(/{meetingTitle}/g, meetingTitle)
    .replace(/{transcription}/g, transcription)
}
```

- [ ] **Step 2.2: Create lib/noteFormatter.ts**

```ts
import { getTemplate, type TemplateId } from './templates'

export type NoteData = {
  summary: string
  transcription: string
  title: string
  templateId: TemplateId | string
  participants: string[]
  createdAt: Date
}

export function formatNote(data: NoteData): string {
  const { summary, transcription, title, templateId, participants, createdAt } = data
  const template = getTemplate(templateId)
  const date = formatDate(createdAt)
  const time = formatTime(createdAt)
  const datetime = formatDatetime(createdAt)
  const participantsStr = participants.length > 0
    ? participants.map(p => `"${p}"`).join(', ')
    : ''

  return `---
title: ${title}
date: ${date}
time: ${time}
datetime: ${datetime}
template: ${template.name}
meeting_type: ${templateId}
participants: [${participantsStr}]
tags: [meeting, notes, auto-generated, ${templateId}]
---

# ${title}

**Date:** ${date}
**Time:** ${time}
**Template:** ${template.name}${participants.length > 0 ? `\n**Participants:** ${participants.join(', ')}` : ''}

---

## Summary

${summary}

---

## Full Transcription

<details>
<summary>Click to expand full transcription</summary>

\`\`\`
${transcription}
\`\`\`

</details>

---

*This meeting summary was automatically generated by Aura on ${datetime}.*
`
}

export function generateFilename(title: string, date: Date): string {
  const sanitized = title.replace(/[<>:"/\\|?*]/g, '').trim()
  const datePart = formatFilenameDate(date)
  return `${sanitized} - ${datePart}.md`
}

function formatDate(d: Date): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDatetime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatFilenameDate(d: Date): string {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
```

- [ ] **Step 2.3: Commit**

```bash
git add lib/templates.ts lib/noteFormatter.ts
git commit -m "feat: port templates and note formatter to TypeScript"
```

---

## Task 3: Tests for templates and noteFormatter

**Files:**
- Create: `tests/lib/templates.test.ts`
- Create: `tests/lib/noteFormatter.test.ts`

- [ ] **Step 3.1: Create tests/lib/templates.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { getTemplate, getAllTemplates, buildPrompt } from '@/lib/templates'

describe('getTemplate', () => {
  it('returns general template by default for unknown id', () => {
    const t = getTemplate('nonexistent')
    expect(t.id).toBe('general')
  })

  it('returns correct template for known id', () => {
    const t = getTemplate('standup')
    expect(t.id).toBe('standup')
    expect(t.name).toBe('Standup / Daily Sync')
  })
})

describe('getAllTemplates', () => {
  it('returns 7 templates', () => {
    expect(getAllTemplates()).toHaveLength(7)
  })

  it('all templates have required fields', () => {
    for (const t of getAllTemplates()) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.prompt).toBeTruthy()
    }
  })
})

describe('buildPrompt', () => {
  it('interpolates meetingTitle and transcription', () => {
    const t = getTemplate('general')
    const prompt = buildPrompt(t, 'hello world', 'My Meeting')
    expect(prompt).toContain('My Meeting')
    expect(prompt).toContain('hello world')
    expect(prompt).not.toContain('{meetingTitle}')
    expect(prompt).not.toContain('{transcription}')
  })
})
```

- [ ] **Step 3.2: Create tests/lib/noteFormatter.test.ts**

```ts
import { describe, it, expect } from 'vitest'
import { formatNote, generateFilename } from '@/lib/noteFormatter'

const baseData = {
  summary: '## Key Points\n- Point one\n- Point two',
  transcription: 'Hello, this is the meeting.',
  title: 'Q3 Planning',
  templateId: 'planning' as const,
  participants: ['Alice', 'Bob'],
  createdAt: new Date('2026-05-21T10:30:00'),
}

describe('formatNote', () => {
  it('includes YAML frontmatter', () => {
    const note = formatNote(baseData)
    expect(note).toMatch(/^---/)
    expect(note).toContain('title: Q3 Planning')
    expect(note).toContain('meeting_type: planning')
  })

  it('includes summary section', () => {
    const note = formatNote(baseData)
    expect(note).toContain('## Summary')
    expect(note).toContain('## Key Points')
  })

  it('includes transcription in details block', () => {
    const note = formatNote(baseData)
    expect(note).toContain('<details>')
    expect(note).toContain('Hello, this is the meeting.')
  })

  it('includes participants when provided', () => {
    const note = formatNote(baseData)
    expect(note).toContain('Alice')
    expect(note).toContain('Bob')
  })

  it('omits participants line when empty', () => {
    const note = formatNote({ ...baseData, participants: [] })
    expect(note).not.toContain('**Participants:**')
  })
})

describe('generateFilename', () => {
  it('produces .md filename with title and date', () => {
    const name = generateFilename('Q3 Planning', new Date('2026-05-21T10:30:00'))
    expect(name).toMatch(/^Q3 Planning - /)
    expect(name).toEndWith('.md')
  })

  it('strips invalid filename characters', () => {
    const name = generateFilename('Meeting: Q3/2026', new Date('2026-05-21T10:30:00'))
    expect(name).not.toContain(':')
    expect(name).not.toContain('/')
  })
})
```

- [ ] **Step 3.3: Run tests — verify they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3.4: Commit**

```bash
git add tests/
git commit -m "test: add tests for templates and noteFormatter"
```

---

## Task 4: Browser API wrappers

**Files:**
- Create: `lib/history.ts`
- Create: `lib/speech.ts`
- Create: `lib/vault.ts`
- Create: `lib/notifications.ts`
- Create: `lib/ollama.ts`

- [ ] **Step 4.1: Create lib/history.ts**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { v4 as uuidv4 } from 'uuid'

export type RecordingStatus = 'processing' | 'completed' | 'failed'

export type RecordingRecord = {
  id: string
  title: string
  templateId: string
  participants: string[]
  transcript: string
  summary: string | null
  status: RecordingStatus
  error: string | null
  createdAt: number
}

interface AuraDB extends DBSchema {
  recordings: {
    key: string
    value: RecordingRecord
    indexes: { by_createdAt: number }
  }
  vault: {
    key: 'handle'
    value: FileSystemDirectoryHandle
  }
}

let dbPromise: Promise<IDBPDatabase<AuraDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AuraDB>('aura', 1, {
      upgrade(db) {
        const store = db.createObjectStore('recordings', { keyPath: 'id' })
        store.createIndex('by_createdAt', 'createdAt')
        db.createObjectStore('vault')
      },
    })
  }
  return dbPromise
}

export async function createRecording(data: Omit<RecordingRecord, 'id' | 'createdAt'>): Promise<RecordingRecord> {
  const db = await getDB()
  const record: RecordingRecord = { ...data, id: uuidv4(), createdAt: Date.now() }
  await db.put('recordings', record)
  return record
}

export async function updateRecording(id: string, updates: Partial<RecordingRecord>): Promise<void> {
  const db = await getDB()
  const existing = await db.get('recordings', id)
  if (!existing) throw new Error(`Recording ${id} not found`)
  await db.put('recordings', { ...existing, ...updates })
}

export async function getAllRecordings(): Promise<RecordingRecord[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('recordings', 'by_createdAt')
  return all.reverse()
}

export async function getRecording(id: string): Promise<RecordingRecord | undefined> {
  const db = await getDB()
  return db.get('recordings', id)
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('recordings', id)
}

export async function saveVaultHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await getDB()
  await db.put('vault', handle, 'handle')
}

export async function getVaultHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const db = await getDB()
  return db.get('vault', 'handle')
}
```

- [ ] **Step 4.2: Create lib/speech.ts**

```ts
export type SpeechCallbacks = {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  onError: (error: string) => void
  onEnd: () => void
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
}

export class SpeechRecorder {
  private recognition: SpeechRecognition | null = null
  private callbacks: SpeechCallbacks
  private running = false

  constructor(callbacks: SpeechCallbacks) {
    this.callbacks = callbacks
  }

  start() {
    if (!isSpeechSupported()) {
      this.callbacks.onError('Speech recognition is not supported in this browser. Use Chrome or Edge.')
      return
    }

    const SR = (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition) as typeof SpeechRecognition
    this.recognition = new SR()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          this.callbacks.onFinal(transcript)
        } else {
          interim += transcript
        }
      }
      this.callbacks.onInterim(interim)
    }

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        this.callbacks.onError(`Speech recognition error: ${event.error}`)
      }
    }

    this.recognition.onend = () => {
      if (this.running) {
        this.recognition?.start()
      } else {
        this.callbacks.onEnd()
      }
    }

    this.running = true
    this.recognition.start()
  }

  stop() {
    this.running = false
    this.recognition?.stop()
    this.recognition = null
  }
}
```

- [ ] **Step 4.3: Create lib/vault.ts**

```ts
import { saveVaultHandle, getVaultHandle } from './history'
import { generateFilename } from './noteFormatter'

export async function pickVaultFolder(): Promise<string> {
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  await saveVaultHandle(handle)
  return handle.name
}

export async function saveToVault(content: string, title: string, date: Date): Promise<string> {
  const handle = await getVaultHandle()
  if (!handle) throw new Error('No vault folder selected. Please pick a folder in Settings.')

  const permission = await handle.queryPermission({ mode: 'readwrite' })
  if (permission !== 'granted') {
    const request = await handle.requestPermission({ mode: 'readwrite' })
    if (request !== 'granted') throw new Error('Vault folder permission denied.')
  }

  const filename = generateFilename(title, date)
  const fileHandle = await handle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
  return filename
}

export function downloadNote(content: string, title: string, date: Date): void {
  const filename = generateFilename(title, date)
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4.4: Create lib/notifications.ts**

```ts
export function isNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationsSupported()) return 'denied'
  return Notification.permission
}

export function notifyComplete(title: string, onClick?: () => void): void {
  if (getNotificationPermission() !== 'granted') return
  const n = new Notification('Aura — Notes ready', {
    body: title,
    icon: '/favicon.ico',
  })
  if (onClick) n.onclick = () => { window.focus(); onClick() }
}

export function notifyError(onClick?: () => void): void {
  if (getNotificationPermission() !== 'granted') return
  const n = new Notification('Aura — Something went wrong', {
    body: 'Open to retry.',
    icon: '/favicon.ico',
  })
  if (onClick) n.onclick = () => { window.focus(); onClick() }
}
```

- [ ] **Step 4.5: Create lib/ollama.ts**

```ts
export type SummarizeRequest = {
  transcript: string
  title: string
  templateId: string
}

export type SummarizeResponse = {
  summary: string
}

export async function summarize(req: SummarizeRequest): Promise<string> {
  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Summarize failed with status ${res.status}`)
  }

  const data: SummarizeResponse = await res.json()
  return data.summary
}
```

- [ ] **Step 4.6: Create tests/lib/history.test.ts**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { createRecording, updateRecording, getAllRecordings, deleteRecording } from '@/lib/history'

beforeEach(() => {
  // fake-indexeddb/auto resets between test files but not between tests
  // Use unique titles to avoid cross-test interference
})

describe('createRecording', () => {
  it('creates a record with generated id and timestamp', async () => {
    const record = await createRecording({
      title: 'Test Meeting',
      templateId: 'general',
      participants: [],
      transcript: 'Hello world',
      summary: null,
      status: 'processing',
      error: null,
    })
    expect(record.id).toBeTruthy()
    expect(record.createdAt).toBeGreaterThan(0)
    expect(record.title).toBe('Test Meeting')
  })
})

describe('updateRecording', () => {
  it('updates status and summary', async () => {
    const record = await createRecording({
      title: 'Update Test',
      templateId: 'general',
      participants: [],
      transcript: 'Hello',
      summary: null,
      status: 'processing',
      error: null,
    })
    await updateRecording(record.id, { status: 'completed', summary: 'Great meeting' })
    const all = await getAllRecordings()
    const updated = all.find(r => r.id === record.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.summary).toBe('Great meeting')
  })
})

describe('deleteRecording', () => {
  it('removes the record', async () => {
    const record = await createRecording({
      title: 'Delete Test',
      templateId: 'general',
      participants: [],
      transcript: 'Hello',
      summary: null,
      status: 'completed',
      error: null,
    })
    await deleteRecording(record.id)
    const all = await getAllRecordings()
    expect(all.find(r => r.id === record.id)).toBeUndefined()
  })
})
```

- [ ] **Step 4.7: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4.8: Commit**

```bash
git add lib/history.ts lib/speech.ts lib/vault.ts lib/notifications.ts lib/ollama.ts tests/lib/history.test.ts
git commit -m "feat: add browser API wrappers (speech, history, vault, notifications, ollama)"
```

---

## Task 5: Session context

**Files:**
- Create: `lib/session-context.tsx`

- [ ] **Step 5.1: Create lib/session-context.tsx**

```tsx
'use client'

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

export type SessionStatus = 'idle' | 'recording' | 'processing' | 'completed' | 'error'

export type SessionState = {
  status: SessionStatus
  title: string
  templateId: string
  participants: string[]
  finalTranscript: string
  interimTranscript: string
  summary: string | null
  savedFilename: string | null
  error: string | null
  elapsedSeconds: number
  recordingId: string | null
}

type Action =
  | { type: 'START_RECORDING'; title: string; templateId: string; participants: string[]; recordingId: string }
  | { type: 'APPEND_FINAL'; text: string }
  | { type: 'SET_INTERIM'; text: string }
  | { type: 'TICK' }
  | { type: 'START_PROCESSING' }
  | { type: 'SET_COMPLETE'; summary: string }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SET_SAVED_FILENAME'; filename: string }
  | { type: 'RESET' }
  | { type: 'UPDATE_TITLE'; title: string }
  | { type: 'UPDATE_TEMPLATE'; templateId: string }
  | { type: 'UPDATE_PARTICIPANTS'; participants: string[] }

const initial: SessionState = {
  status: 'idle',
  title: 'Meeting',
  templateId: 'general',
  participants: [],
  finalTranscript: '',
  interimTranscript: '',
  summary: null,
  savedFilename: null,
  error: null,
  elapsedSeconds: 0,
  recordingId: null,
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'START_RECORDING':
      return { ...initial, status: 'recording', title: action.title, templateId: action.templateId, participants: action.participants, recordingId: action.recordingId }
    case 'APPEND_FINAL':
      return { ...state, finalTranscript: state.finalTranscript + ' ' + action.text, interimTranscript: '' }
    case 'SET_INTERIM':
      return { ...state, interimTranscript: action.text }
    case 'TICK':
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 }
    case 'START_PROCESSING':
      return { ...state, status: 'processing', interimTranscript: '' }
    case 'SET_COMPLETE':
      return { ...state, status: 'completed', summary: action.summary }
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error }
    case 'SET_SAVED_FILENAME':
      return { ...state, savedFilename: action.filename }
    case 'RESET':
      return initial
    case 'UPDATE_TITLE':
      return { ...state, title: action.title }
    case 'UPDATE_TEMPLATE':
      return { ...state, templateId: action.templateId }
    case 'UPDATE_PARTICIPANTS':
      return { ...state, participants: action.participants }
    default:
      return state
  }
}

type SessionContextValue = {
  state: SessionState
  dispatch: React.Dispatch<Action>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  return <SessionContext.Provider value={{ state, dispatch }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
```

- [ ] **Step 5.2: Commit**

```bash
git add lib/session-context.tsx
git commit -m "feat: add session context and reducer"
```

---

## Task 6: UI components

**Files:**
- Create: `components/ui/button.tsx`
- Create: `components/ui/card.tsx`
- Create: `components/ui/badge.tsx`

- [ ] **Step 6.1: Create components/ui/button.tsx**

```tsx
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-base border-solid font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-3 border-border bg-main text-main-foreground shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
        neutral: 'border-3 border-border bg-background text-foreground shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
        reverse: 'border-3 border-border bg-main text-main-foreground hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow',
        destructive: 'border-3 border-border bg-red-500 text-white shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
      },
      size: {
        default: 'h-11 px-6 py-3 text-base',
        sm: 'h-9 px-4 py-2 text-sm',
        lg: 'h-12 px-8 py-3 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button, buttonVariants }
```

- [ ] **Step 6.2: Create components/ui/card.tsx**

```tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-base border-3 border-border bg-secondary-background shadow-shadow', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-heading text-lg font-bold leading-none', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent, CardFooter }
```

- [ ] **Step 6.3: Create components/ui/badge.tsx**

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-base border-2 border-border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-main text-main-foreground',
        neutral: 'bg-secondary-background text-foreground',
        success: 'bg-green-500 text-white',
        destructive: 'bg-red-500 text-white',
        warning: 'bg-yellow-400 text-black',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 6.4: Commit**

```bash
git add components/ui/
git commit -m "feat: add neobrutalism UI components (Button, Card, Badge)"
```

---

## Task 7: API route

**Files:**
- Create: `app/api/summarize/route.ts`

- [ ] **Step 7.1: Create app/api/summarize/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getTemplate, buildPrompt } from '@/lib/templates'

export async function POST(req: NextRequest) {
  let body: { transcript?: string; title?: string; templateId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { transcript, title = 'Meeting', templateId = 'general' } = body

  if (!transcript || transcript.trim().length < 10) {
    return NextResponse.json({ error: 'Transcript is too short or missing' }, { status: 400 })
  }

  const ollamaUrl = process.env.OLLAMA_URL ?? 'http://localhost:11434'
  const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3.2'

  const template = getTemplate(templateId)
  const prompt = buildPrompt(template, transcript, title)

  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false, options: { temperature: 0.7, top_p: 0.9 } }),
      signal: AbortSignal.timeout(300_000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Ollama error: ${text}` }, { status: 502 })
    }

    const data = await res.json()
    const summary: string = data.response ?? data.text

    if (!summary) {
      return NextResponse.json({ error: 'Ollama returned an empty response' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch (err: any) {
    if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: `Could not reach Ollama at ${ollamaUrl} — is it running?` },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Unexpected error contacting Ollama' }, { status: 500 })
  }
}
```

- [ ] **Step 7.2: Commit**

```bash
git add app/api/summarize/route.ts
git commit -m "feat: add Ollama proxy API route"
```

---

## Task 8: App layout and nav

**Files:**
- Create: `app/layout.tsx`

- [ ] **Step 8.1: Create app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { DM_Sans } from 'next/font/google'
import { SessionProvider } from '@/lib/session-context'
import '@/styles/globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Aura — Meeting Recorder',
  description: 'Record, transcribe, and summarise your meetings',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} min-h-screen bg-background font-sans`}>
        <SessionProvider>
          <header className="border-b-3 border-border bg-secondary-background">
            <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-xl font-bold tracking-tight">
                AURA
              </Link>
              <div className="flex gap-2">
                {[
                  { href: '/', label: 'Record' },
                  { href: '/history', label: 'History' },
                  { href: '/settings', label: 'Settings' },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-base border-2 border-border px-3 py-1.5 text-sm font-semibold transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none shadow-shadow-sm bg-background"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 8.2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add root layout with nav"
```

---

## Task 9: Recording page components

**Files:**
- Create: `components/MeetingSetup.tsx`
- Create: `components/RecordingButton.tsx`
- Create: `components/LiveTranscript.tsx`
- Create: `components/ProcessingProgress.tsx`
- Create: `components/NoteResult.tsx`

- [ ] **Step 9.1: Create components/MeetingSetup.tsx**

```tsx
'use client'

import { getAllTemplates } from '@/lib/templates'
import { useSession } from '@/lib/session-context'

export function MeetingSetup() {
  const { state, dispatch } = useSession()
  const templates = getAllTemplates()

  if (state.status !== 'idle') return null

  return (
    <div className="rounded-base border-3 border-border bg-secondary-background p-4 shadow-shadow space-y-3">
      <div>
        <label className="block text-sm font-semibold mb-1">Meeting Title</label>
        <input
          type="text"
          value={state.title}
          onChange={e => dispatch({ type: 'UPDATE_TITLE', title: e.target.value })}
          placeholder="e.g. Q3 Planning"
          className="w-full rounded-base border-3 border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Template</label>
        <select
          value={state.templateId}
          onChange={e => dispatch({ type: 'UPDATE_TEMPLATE', templateId: e.target.value })}
          className="w-full rounded-base border-3 border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        >
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Participants (comma separated)</label>
        <input
          type="text"
          placeholder="e.g. Alice, Bob, Carol"
          onChange={e => dispatch({
            type: 'UPDATE_PARTICIPANTS',
            participants: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
          })}
          className="w-full rounded-base border-3 border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Create components/RecordingButton.tsx**

```tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session-context'
import { SpeechRecorder, isSpeechSupported } from '@/lib/speech'
import { summarize } from '@/lib/ollama'
import { createRecording, updateRecording } from '@/lib/history'
import { notifyComplete, notifyError } from '@/lib/notifications'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function RecordingButton() {
  const { state, dispatch } = useSession()
  const recorderRef = useRef<SpeechRecorder | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (state.status === 'recording') {
      tickRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [state.status, dispatch])

  const handleStart = useCallback(async () => {
    if (!isSpeechSupported()) {
      dispatch({ type: 'SET_ERROR', error: 'Speech recognition requires Chrome or Edge.' })
      return
    }
    const record = await createRecording({
      title: state.title,
      templateId: state.templateId,
      participants: state.participants,
      transcript: '',
      summary: null,
      status: 'processing',
      error: null,
    })
    dispatch({ type: 'START_RECORDING', title: state.title, templateId: state.templateId, participants: state.participants, recordingId: record.id })
    const recorder = new SpeechRecorder({
      onFinal: (text) => dispatch({ type: 'APPEND_FINAL', text }),
      onInterim: (text) => dispatch({ type: 'SET_INTERIM', text }),
      onError: (err) => dispatch({ type: 'SET_ERROR', error: err }),
      onEnd: () => {},
    })
    recorderRef.current = recorder
    recorder.start()
  }, [state.title, state.templateId, state.participants, dispatch])

  const handleStop = useCallback(async () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    dispatch({ type: 'START_PROCESSING' })

    const transcript = state.finalTranscript.trim()
    const recordingId = state.recordingId!

    try {
      await updateRecording(recordingId, { transcript, status: 'processing' })
      const summary = await summarize({ transcript, title: state.title, templateId: state.templateId })
      await updateRecording(recordingId, { summary, status: 'completed' })
      dispatch({ type: 'SET_COMPLETE', summary })
      notifyComplete(state.title)
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error'
      await updateRecording(recordingId, { status: 'failed', error: msg })
      dispatch({ type: 'SET_ERROR', error: msg })
      notifyError()
    }
  }, [state.finalTranscript, state.recordingId, state.title, state.templateId, dispatch])

  if (!isSpeechSupported() && state.status === 'idle') {
    return (
      <div className="rounded-base border-3 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        Speech recognition requires Chrome or Edge. Firefox is not supported.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {state.status === 'idle' && (
        <Button onClick={handleStart} size="lg" className="w-64 text-lg">
          <Mic className="size-5" /> Start Recording
        </Button>
      )}
      {state.status === 'recording' && (
        <>
          <Button onClick={handleStop} variant="destructive" size="lg" className="w-64 text-lg animate-pulse">
            <Square className="size-5" /> Stop Recording
          </Button>
          <span className="font-mono text-lg font-bold">{formatTime(state.elapsedSeconds)}</span>
        </>
      )}
      {state.status === 'processing' && (
        <Button disabled size="lg" className="w-64 text-lg">
          <Loader2 className="size-5 animate-spin" /> Processing…
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 9.3: Create components/LiveTranscript.tsx**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useSession } from '@/lib/session-context'

export function LiveTranscript() {
  const { state } = useSession()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.finalTranscript, state.interimTranscript])

  if (state.status === 'idle' && !state.finalTranscript) return null

  return (
    <div className="rounded-base border-3 border-border bg-secondary-background p-4 shadow-shadow h-48 overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Live Transcript</p>
      <p className="text-sm leading-relaxed">
        <span>{state.finalTranscript}</span>
        {state.interimTranscript && (
          <span className="text-muted-foreground italic"> {state.interimTranscript}</span>
        )}
      </p>
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 9.4: Create components/ProcessingProgress.tsx**

```tsx
'use client'

import { useSession } from '@/lib/session-context'

const STEPS = ['Transcribing', 'Summarising', 'Saving']

export function ProcessingProgress() {
  const { state } = useSession()
  if (state.status !== 'processing') return null

  return (
    <div className="rounded-base border-3 border-border bg-secondary-background p-6 shadow-shadow">
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 flex-col items-center gap-2">
            <div className={`size-8 rounded-full border-3 border-border flex items-center justify-center text-sm font-bold
              ${i === 1 ? 'bg-main text-main-foreground animate-pulse' : 'bg-secondary-background'}`}>
              {i + 1}
            </div>
            <span className={`text-xs font-semibold ${i === 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{step}</span>
            {i < STEPS.length - 1 && <div className="absolute" />}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 9.5: Create components/NoteResult.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Download, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session-context'
import { formatNote } from '@/lib/noteFormatter'
import { saveToVault, downloadNote, pickVaultFolder } from '@/lib/vault'

export function NoteResult() {
  const { state, dispatch } = useSession()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (state.status !== 'completed' && state.status !== 'error') return null

  if (state.status === 'error') {
    return (
      <div className="rounded-base border-3 border-red-500 bg-red-50 p-4 shadow-shadow space-y-2">
        <p className="font-bold text-red-700">Something went wrong</p>
        <p className="text-sm text-red-600">{state.error}</p>
        <Button variant="neutral" size="sm" onClick={() => dispatch({ type: 'RESET' })}>
          <RefreshCw className="size-4" /> Try Again
        </Button>
      </div>
    )
  }

  const noteContent = formatNote({
    summary: state.summary!,
    transcription: state.finalTranscript,
    title: state.title,
    templateId: state.templateId,
    participants: state.participants,
    createdAt: new Date(),
  })

  const handleSaveToVault = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const filename = await saveToVault(noteContent, state.title, new Date())
      dispatch({ type: 'SET_SAVED_FILENAME', filename })
    } catch (err: any) {
      if (err.message?.includes('No vault folder')) {
        try {
          await pickVaultFolder()
          const filename = await saveToVault(noteContent, state.title, new Date())
          dispatch({ type: 'SET_SAVED_FILENAME', filename })
        } catch (e: any) {
          setSaveError(e.message)
        }
      } else {
        setSaveError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-base border-3 border-border bg-secondary-background p-6 shadow-shadow">
        <div className="prose max-w-none markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(state.summary!) }} />
      </div>

      <details className="rounded-base border-3 border-border bg-secondary-background shadow-shadow">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-sm select-none">Full Transcript</summary>
        <pre className="px-4 pb-4 text-xs whitespace-pre-wrap text-muted-foreground">{state.finalTranscript}</pre>
      </details>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={handleSaveToVault} disabled={saving} variant="default">
          <FolderOpen className="size-4" />
          {saving ? 'Saving…' : state.savedFilename ? 'Saved to Vault ✓' : 'Save to Vault'}
        </Button>
        <Button onClick={() => downloadNote(noteContent, state.title, new Date())} variant="neutral">
          <Download className="size-4" /> Download .md
        </Button>
        <Button onClick={() => dispatch({ type: 'RESET' })} variant="neutral">
          New Meeting
        </Button>
      </div>

      {saveError && <p className="text-sm text-red-600 font-semibold">{saveError}</p>}
      {state.savedFilename && <p className="text-sm text-green-700 font-semibold">Saved as: {state.savedFilename}</p>}
    </div>
  )
}

function renderMarkdown(text: string): string {
  // Basic markdown rendering for display - headings, bold, lists
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
}
```

- [ ] **Step 9.6: Commit**

```bash
git add components/MeetingSetup.tsx components/RecordingButton.tsx components/LiveTranscript.tsx components/ProcessingProgress.tsx components/NoteResult.tsx
git commit -m "feat: add recording page components"
```

---

## Task 10: Recording page

**Files:**
- Create: `app/page.tsx`

- [ ] **Step 10.1: Create app/page.tsx**

```tsx
import { MeetingSetup } from '@/components/MeetingSetup'
import { RecordingButton } from '@/components/RecordingButton'
import { LiveTranscript } from '@/components/LiveTranscript'
import { ProcessingProgress } from '@/components/ProcessingProgress'
import { NoteResult } from '@/components/NoteResult'

export default function RecordingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Meeting</h1>
      <MeetingSetup />
      <div className="flex justify-center">
        <RecordingButton />
      </div>
      <LiveTranscript />
      <ProcessingProgress />
      <NoteResult />
    </div>
  )
}
```

- [ ] **Step 10.2: Run dev server and manually test the recording page**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Title/template/participants inputs render
- Start Recording button is visible
- Clicking start triggers browser microphone permission
- Speech appears in live transcript
- Stop sends to Ollama (or shows error if Ollama is not running)

- [ ] **Step 10.3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add recording page"
```

---

## Task 11: History page

**Files:**
- Create: `components/HistoryCard.tsx`
- Create: `components/HistoryFilter.tsx`
- Create: `app/history/page.tsx`

- [ ] **Step 11.1: Create components/HistoryCard.tsx**

```tsx
'use client'

import { Trash2, RefreshCw, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { type RecordingRecord, deleteRecording } from '@/lib/history'
import { getTemplate } from '@/lib/templates'

type Props = {
  record: RecordingRecord
  onDelete: (id: string) => void
  onRetry: (record: RecordingRecord) => void
  onView: (record: RecordingRecord) => void
}

const statusVariant: Record<string, 'success' | 'destructive' | 'warning'> = {
  completed: 'success',
  failed: 'destructive',
  processing: 'warning',
}

export function HistoryCard({ record, onDelete, onRetry, onView }: Props) {
  const template = getTemplate(record.templateId)
  const date = new Date(record.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const handleDelete = async () => {
    await deleteRecording(record.id)
    onDelete(record.id)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{record.title}</CardTitle>
          <Badge variant={statusVariant[record.status] ?? 'neutral'} className="shrink-0">
            {record.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{date}</p>
      </CardHeader>
      <CardContent>
        <Badge variant="neutral">{template.icon} {template.name}</Badge>
        {record.participants.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">{record.participants.join(', ')}</p>
        )}
        {record.error && (
          <p className="mt-2 text-xs text-red-600">{record.error}</p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {record.status === 'completed' && (
          <Button size="sm" variant="neutral" onClick={() => onView(record)}>
            <FileText className="size-4" /> View
          </Button>
        )}
        {record.status === 'failed' && (
          <Button size="sm" variant="default" onClick={() => onRetry(record)}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={handleDelete}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 11.2: Create components/HistoryFilter.tsx**

```tsx
'use client'

import { type RecordingStatus } from '@/lib/history'
import { Button } from '@/components/ui/button'

type Filter = 'all' | RecordingStatus

type Props = {
  active: Filter
  onChange: (f: Filter) => void
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'processing', label: 'Processing' },
]

export function HistoryFilter({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {FILTERS.map(f => (
        <Button
          key={f.value}
          size="sm"
          variant={active === f.value ? 'default' : 'neutral'}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 11.3: Create app/history/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HistoryCard } from '@/components/HistoryCard'
import { HistoryFilter } from '@/components/HistoryFilter'
import { getAllRecordings, updateRecording, type RecordingRecord, type RecordingStatus } from '@/lib/history'
import { summarize } from '@/lib/ollama'

type Filter = 'all' | RecordingStatus

export default function HistoryPage() {
  const [records, setRecords] = useState<RecordingRecord[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [retrying, setRetrying] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    getAllRecordings().then(setRecords)
  }, [])

  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter)

  const handleDelete = (id: string) => setRecords(prev => prev.filter(r => r.id !== id))

  const handleRetry = async (record: RecordingRecord) => {
    setRetrying(record.id)
    try {
      await updateRecording(record.id, { status: 'processing', error: null })
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'processing', error: null } : r))
      const summary = await summarize({ transcript: record.transcript, title: record.title, templateId: record.templateId })
      await updateRecording(record.id, { summary, status: 'completed' })
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, summary, status: 'completed' } : r))
    } catch (err: any) {
      await updateRecording(record.id, { status: 'failed', error: err.message })
      setRecords(prev => prev.map(r => r.id === record.id ? { ...r, status: 'failed', error: err.message } : r))
    } finally {
      setRetrying(null)
    }
  }

  const handleView = (record: RecordingRecord) => {
    sessionStorage.setItem('view-record', JSON.stringify(record))
    router.push(`/history/${record.id}`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">History</h1>
      <HistoryFilter active={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No recordings found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(record => (
            <HistoryCard
              key={record.id}
              record={retrying === record.id ? { ...record, status: 'processing' } : record}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onView={handleView}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 11.4: Create app/history/[id]/page.tsx** (note view)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRecording, type RecordingRecord } from '@/lib/history'
import { formatNote } from '@/lib/noteFormatter'
import { downloadNote } from '@/lib/vault'

export default function NoteViewPage() {
  const params = useParams()
  const router = useRouter()
  const [record, setRecord] = useState<RecordingRecord | null>(null)

  useEffect(() => {
    getRecording(params.id as string).then(r => setRecord(r ?? null))
  }, [params.id])

  if (!record) return <p className="text-muted-foreground">Loading…</p>

  const noteContent = formatNote({
    summary: record.summary ?? '',
    transcription: record.transcript,
    title: record.title,
    templateId: record.templateId,
    participants: record.participants,
    createdAt: new Date(record.createdAt),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{record.title}</h1>
        <div className="flex gap-2">
          <Button variant="neutral" size="sm" onClick={() => router.back()}>Back</Button>
          <Button variant="neutral" size="sm" onClick={() => downloadNote(noteContent, record.title, new Date(record.createdAt))}>
            <Download className="size-4" /> Download
          </Button>
        </div>
      </div>
      <div className="rounded-base border-3 border-border bg-secondary-background p-6 shadow-shadow">
        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(record.summary ?? '') }} />
      </div>
      <details className="rounded-base border-3 border-border bg-secondary-background shadow-shadow">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-sm select-none">Full Transcript</summary>
        <pre className="px-4 pb-4 text-xs whitespace-pre-wrap text-muted-foreground">{record.transcript}</pre>
      </details>
    </div>
  )
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
}
```

- [ ] **Step 11.5: Commit**

```bash
git add components/HistoryCard.tsx components/HistoryFilter.tsx app/history/
git commit -m "feat: add history page with filter, retry, and note view"
```

---

## Task 12: Settings page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 12.1: Create app/settings/page.tsx**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getAllTemplates } from '@/lib/templates'
import { pickVaultFolder, getVaultHandle } from '@/lib/vault'
import { requestNotificationPermission, getNotificationPermission, isNotificationsSupported } from '@/lib/notifications'

const OLLAMA_URL_KEY = 'aura:ollamaUrl'
const OLLAMA_MODEL_KEY = 'aura:ollamaModel'
const DEFAULT_TEMPLATE_KEY = 'aura:defaultTemplate'

export default function SettingsPage() {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [defaultTemplate, setDefaultTemplate] = useState('general')
  const [vaultName, setVaultName] = useState<string | null>(null)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [saved, setSaved] = useState(false)
  const templates = getAllTemplates()

  useEffect(() => {
    setOllamaUrl(localStorage.getItem(OLLAMA_URL_KEY) ?? 'http://localhost:11434')
    setOllamaModel(localStorage.getItem(OLLAMA_MODEL_KEY) ?? 'llama3.2')
    setDefaultTemplate(localStorage.getItem(DEFAULT_TEMPLATE_KEY) ?? 'general')
    setNotifPermission(getNotificationPermission())
    getVaultHandle().then(h => { if (h) setVaultName(h.name) })
  }, [])

  const handleSave = () => {
    localStorage.setItem(OLLAMA_URL_KEY, ollamaUrl)
    localStorage.setItem(OLLAMA_MODEL_KEY, ollamaModel)
    localStorage.setItem(DEFAULT_TEMPLATE_KEY, defaultTemplate)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handlePickVault = async () => {
    const name = await pickVaultFolder()
    setVaultName(name)
  }

  const handleRequestNotifications = async () => {
    const perm = await requestNotificationPermission()
    setNotifPermission(perm)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Ollama</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">API URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              className="w-full rounded-base border-3 border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Model</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={e => setOllamaModel(e.target.value)}
              className="w-full rounded-base border-3 border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Obsidian Vault</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {vaultName ? (
            <p className="text-sm font-semibold">Selected: <span className="text-main">{vaultName}</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">No vault folder selected.</p>
          )}
          <Button variant="neutral" onClick={handlePickVault}>
            {vaultName ? 'Change Vault Folder' : 'Select Vault Folder'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-1">Default Template</label>
            <select
              value={defaultTemplate}
              onChange={e => setDefaultTemplate(e.target.value)}
              className="w-full rounded-base border-3 border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent>
          {!isNotificationsSupported() ? (
            <p className="text-sm text-muted-foreground">Notifications not supported in this browser.</p>
          ) : notifPermission === 'granted' ? (
            <p className="text-sm font-semibold text-green-700">Notifications enabled ✓</p>
          ) : notifPermission === 'denied' ? (
            <p className="text-sm text-red-600">Notifications blocked. Enable in browser settings.</p>
          ) : (
            <Button variant="neutral" onClick={handleRequestNotifications}>Enable Notifications</Button>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave}>
        {saved ? 'Saved ✓' : 'Save Settings'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 12.2: Wire Ollama settings into the API route via env or headers**

The settings page saves to `localStorage`. The API route reads `process.env.OLLAMA_URL` and `process.env.OLLAMA_MODEL`. To pass user settings to the API route, update `lib/ollama.ts` to send them in the request body:

Update `lib/ollama.ts`:

```ts
export async function summarize(req: SummarizeRequest): Promise<string> {
  const ollamaUrl = localStorage.getItem('aura:ollamaUrl') ?? 'http://localhost:11434'
  const ollamaModel = localStorage.getItem('aura:ollamaModel') ?? 'llama3.2'

  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, ollamaUrl, ollamaModel }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Summarize failed with status ${res.status}`)
  }

  const data: SummarizeResponse = await res.json()
  return data.summary
}
```

Update `app/api/summarize/route.ts` to read `ollamaUrl` and `ollamaModel` from the request body (already accounted for — update the destructuring):

```ts
const { transcript, title = 'Meeting', templateId = 'general', ollamaUrl: reqUrl, ollamaModel: reqModel } = body
const ollamaUrl = reqUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
const ollamaModel = reqModel ?? process.env.OLLAMA_MODEL ?? 'llama3.2'
```

- [ ] **Step 12.3: Commit**

```bash
git add app/settings/page.tsx lib/ollama.ts app/api/summarize/route.ts
git commit -m "feat: add settings page with Ollama config, vault picker, and notifications"
```

---

## Task 13: Run all tests and manual verification

- [ ] **Step 13.1: Run test suite**

```bash
npm test
```

Expected: all tests pass (templates, noteFormatter, history).

- [ ] **Step 13.2: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 13.3: Manual verification checklist**

Start the dev server (`npm run dev`) and verify each item:

- [ ] Recording page renders with title/template/participants inputs
- [ ] Start Recording triggers microphone permission in Chrome/Edge
- [ ] Live transcript updates with spoken words
- [ ] Stop sends transcript to Ollama; summary appears
- [ ] Save to Vault opens folder picker on first use, writes file
- [ ] Download .md downloads a valid Markdown file
- [ ] History page shows session with correct status
- [ ] Retry on a failed session works
- [ ] Settings page saves Ollama URL/model; change takes effect on next summarise
- [ ] Browser notification fires when tab is backgrounded during processing

- [ ] **Step 13.4: Final commit**

```bash
git add -A
git commit -m "feat: complete Aura web app — Next.js rewrite of Electron meeting recorder"
```
