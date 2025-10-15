# 🎙️ Meeting Note Taker

A macOS desktop app that records meetings, transcribes them with Whisper, and generates summaries using local Llama models.

![Meeting Note Taker](assets/icon.png)

## ✨ Features

- 🎤 One-click recording with dual audio (microphone + system audio)
- 🗣️ High-quality transcription using OpenAI's Whisper
- 🤖 AI-powered summaries with local Llama models
- 📝 Auto-save to Obsidian vault
- 🔒 100% private - everything runs locally
- 🎯 Smart audio device detection (BlackHole, Soundflower)

## 🚀 Quick Start

### 1. Install Prerequisites

```bash
# Install dependencies
brew install sox ffmpeg blackhole-2ch
pip install openai-whisper
curl -fsSL https://ollama.com/install.sh | sh

# Pull an AI model
ollama pull llama3
```

### 2. Run the App

```bash
npm install
npm start
```

### 3. First Launch Setup

The setup wizard will guide you through:
1. Select your Obsidian vault (or create new)
2. Verify prerequisites
3. Done! Start recording 🎉

## 📖 Usage

1. **Start Recording** → Enter meeting title (optional)
2. **Speak** into your microphone
3. **Stop** → Watch it process (transcribe → summarize → save)
4. **Find notes** in your Obsidian vault!

## 🔊 System Audio Setup (Optional)

To capture **both** your voice AND other participants in video calls:

1. **Install BlackHole** (already done if you followed Quick Start)
2. **Create Multi-Output Device**:
   - Open Audio MIDI Setup
   - Click **+** → Create Multi-Output Device
   - Check both: Built-in Output + BlackHole 2ch
   - Set as system output
3. **Restart the app** - it will auto-detect BlackHole!

**Without BlackHole**: App still works, records microphone only.

## 🛠️ Troubleshooting

### Microphone Permission
Go to **System Settings** → **Privacy & Security** → **Microphone** → Enable the app

### No System Audio
- Install BlackHole: `brew install blackhole-2ch`
- Create Multi-Output Device (see above)
- Check console: Should see "✅ Found virtual audio device"

### Ollama Not Running
```bash
ollama serve
```

### Empty Recording (0 bytes)
- Ensure microphone is selected in System Settings → Sound → Input
- Speak during recording (app records YOUR voice)
- Check input level meter moves when you speak

## ⚙️ Configuration

Click **Settings** button to change:
- Obsidian vault path
- Whisper model (tiny/base/small/medium/large)
- Llama model (llama3/llama2/mistral)
- Notes folder name

## 📦 Build

```bash
# Fast build for testing
npm run build:mac:fast

# Production DMG
npm run build:mac:dmg
```

Built app appears in `dist/` folder.

## 📁 How It Works

```
Your Voice → Microphone → Whisper (transcribe) → Llama (summarize) → Obsidian Note
```

**Processing Pipeline:**
1. Records audio from microphone (+ system audio if BlackHole installed)
2. Whisper converts speech to text
3. Llama generates structured summary with action items
4. Saves formatted note to Obsidian with full transcript

## 📝 License

MIT

---

**Privacy Note**: This tool is for personal use. Always get consent when recording meetings.

**Made with ❤️ for productive note-taking**
