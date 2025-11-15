# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-11-15

### Added
- (feat): implement changelog generation script

## [1.0.0] - 2024-12-19

### Added
- 🎙️ Initial release of Aura Meeting Recorder
- 🎤 One-click recording with dual audio capture (microphone + system audio)
- 🗣️ High-quality transcription using OpenAI's Whisper
- 🤖 AI-powered meeting summaries using local Llama models
- 📝 Automatic saving to Obsidian vaults
- 🔒 100% private - all processing happens locally
- 🎯 Smart audio device detection (BlackHole, Soundflower, Loopback)
- 🌙 Dark/Light theme support
- 📊 Real-time audio visualization during recording
- ⚙️ Comprehensive setup wizard for first-time users
- 🎧 Enhanced headphone support with fallback audio capture strategies
- 📱 Participant management for meeting notes
- 📚 History viewer to access previous recordings
- 🔧 Dependency checker and installer for required tools

### Features
- **Audio Recording**: Captures both microphone and system audio when properly configured
- **Transcription**: Uses Whisper for accurate speech-to-text conversion
- **AI Summarization**: Generates structured meeting summaries with action items
- **Obsidian Integration**: Seamlessly saves notes to your Obsidian vault
- **Privacy-First**: No data leaves your machine - everything runs locally
- **Cross-Platform Audio**: Supports various audio interfaces and virtual devices

### System Requirements
- macOS 10.15 or later
- Apple Silicon (M1/M2) or Intel Mac
- Microphone access permission
- Screen recording permission (for system audio capture)

### Dependencies
- Node.js and npm
- Sox (for audio processing)
- FFmpeg (for audio conversion)
- OpenAI Whisper (for transcription)
- Ollama (for AI summarization)
- BlackHole (optional, for system audio capture)

### Installation
1. Download the DMG from GitHub Releases
2. Drag Aura to Applications folder
3. Launch and follow setup wizard
4. Grant necessary permissions when prompted

---

**Note**: This is the initial release. Future updates will include bug fixes, performance improvements, and new features based on user feedback.
