# Aura — Meeting Note Taker

[![Deploy](https://github.com/ps011/meeting-note-taker/actions/workflows/deploy.yml/badge.svg)](https://github.com/ps011/meeting-note-taker/actions/workflows/deploy.yml)
[![Latest Release](https://img.shields.io/github/v/release/ps011/meeting-note-taker)](https://github.com/ps011/meeting-note-taker/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Record meetings, get a transcript, and generate AI summaries — all in the browser, all locally. No cloud, no installs, no macOS permission prompts.

**Live app:** https://ps011.github.io/meeting-note-taker/

## How it works

1. Open the app in Chrome or Edge
2. Enter a title, pick a template, add participants
3. Hit **Start Recording** — speak freely
4. Hit **Stop** — Ollama summarises your transcript
5. Download the note as `.md` or save it directly to your Obsidian vault

```
Microphone → Web Speech API → Ollama (local LLM) → Markdown note → Obsidian / download
```

Everything runs locally. Audio never leaves your machine.

## Requirements

- Chrome or Edge (Web Speech API)
- [Ollama](https://ollama.com) running locally with a model pulled:

```bash
ollama pull llama3.2
```

- If accessing from the hosted GitHub Pages URL, start Ollama with CORS enabled:

```bash
OLLAMA_ORIGINS=https://ps011.github.io ollama serve
```

If you run the app locally (`localhost`), no CORS flag is needed.

## Features

- Real-time transcription via the browser's Web Speech API
- AI summaries via local Ollama — no API keys, no cloud
- 7 meeting templates: general, 1-on-1, standup, brainstorm, client, retrospective, interview
- Save notes directly to an Obsidian vault (File System Access API)
- Download notes as `.md`
- Recording history with retry for failed summaries
- Browser notifications when processing completes in a background tab
- Dark mode (blue neobrutalism, matches system preference)

## Running locally

```bash
git clone https://github.com/ps011/meeting-note-taker.git
cd meeting-note-taker
yarn install
yarn dev
```

Open `http://localhost:3000` in Chrome or Edge.

## Settings

Configure in the **Settings** page:

| Setting | Default | Description |
|---|---|---|
| Ollama API URL | `http://localhost:11434` | Where Ollama is running |
| Model | `llama3.2` | Any model you have pulled |
| Default template | General | Template used for new recordings |
| Obsidian vault | — | Folder picker for vault writes |

Settings are saved to `localStorage`.

## Tech stack

- [Next.js 15](https://nextjs.org) (static export)
- TypeScript, Tailwind CSS
- Web Speech API — transcription
- [Ollama](https://ollama.com) — local LLM summarisation
- IndexedDB (`idb`) — recording history
- File System Access API — Obsidian vault writes
- Deployed to GitHub Pages via GitHub Actions

## Deployment

Pushes to `main` automatically build and deploy to GitHub Pages via `.github/workflows/deploy.yml`.

To cut a release (version bump + changelog + GitHub Release), run the **Release** workflow manually from the Actions tab.

## License

MIT
