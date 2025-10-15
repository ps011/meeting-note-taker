const path = require('path');
const fs = require('fs');
const os = require('os');
const { AudioCapture } = require('./audioCapture.js');
const { TranscriptionService } = require('./transcription.js');
const { LlamaSummarizer } = require('./summarizer.js');
const { ObsidianWriter } = require('./obsidianWriter.js');

/**
 * Main meeting note taker orchestrator
 */
class MeetingNoteTaker {
  constructor(config) {
    this.config = config;
    this.audioCapture = null;
    this.transcriptionService = new TranscriptionService(config.whisperModel || 'base');
    this.summarizer = new LlamaSummarizer(config.llamaApiUrl, config.llamaModel);
    this.obsidianWriter = new ObsidianWriter(config.obsidianVaultPath, config.notesFolder);
    this.currentMeetingTitle = null;
    this.currentAudioPath = null;
  }

  /**
   * Start recording a meeting
   * @param {string} meetingTitle - Optional title for the meeting
   */
  async startMeeting(meetingTitle = 'Meeting') {
    try {
      console.log('\n🚀 Starting Meeting Note Taker\n');
      
      this.currentMeetingTitle = meetingTitle;
      
      // Create temp directory for audio files
      const tempDir = path.join(os.tmpdir(), 'meeting-note-taker');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate audio file path
      const timestamp = Date.now();
      this.currentAudioPath = path.join(tempDir, `meeting-${timestamp}.wav`);

      // Initialize audio capture
      this.audioCapture = new AudioCapture(
        this.currentAudioPath,
        this.config.sampleRate || 16000,
        this.config.channels || 1
      );

      // Start recording
      await this.audioCapture.start();
      
      console.log('💡 Meeting is being recorded.');

      return {
        success: true,
        message: 'Meeting recording started',
        audioPath: this.currentAudioPath,
      };
    } catch (error) {
      console.error('\n❌ Failed to start meeting:', error.message);
      throw error;
    }
  }

  /**
   * Stop recording and process the meeting
   */
  async stopMeeting(callbacks = {}) {
    try {
      console.log('\n⏹️  Stopping Meeting Recording\n');

      // Stop recording
      if (this.audioCapture) {
        await this.audioCapture.stop();
      }

      // Wait a bit for file to be fully written
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if audio file exists and has content
      if (!fs.existsSync(this.currentAudioPath)) {
        throw new Error('Audio file was not created');
      }

      const stats = fs.statSync(this.currentAudioPath);
      if (stats.size < 1000) {
        throw new Error('Audio file is too small. Recording may have failed.');
      }

      console.log(`📊 Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

      // Process the recording
      console.log('🔄 Processing Meeting Recording\n');

      // Step 1: Transcribe
      console.log('Step 1/3: Transcribing audio...');
      const transcription = await this.transcriptionService.transcribe(this.currentAudioPath);
      
      if (!transcription || transcription.length < 10) {
        throw new Error('Transcription failed or produced no content');
      }

      console.log(`\n📄 Transcription preview:\n${transcription.substring(0, 200)}...\n`);
      
      if (callbacks.onTranscriptionComplete) {
        callbacks.onTranscriptionComplete();
      }

      // Step 2: Summarize
      console.log('Step 2/3: Generating summary with Llama...');
      const summary = await this.summarizer.summarize(transcription, this.currentMeetingTitle);
      
      if (callbacks.onSummarizationComplete) {
        callbacks.onSummarizationComplete();
      }

      // Step 3: Save to Obsidian
      console.log('\nStep 3/3: Saving to Obsidian vault...');
      const notePath = this.obsidianWriter.saveNote(
        summary,
        transcription,
        this.currentMeetingTitle
      );

      // Cleanup temp audio file (optional)
      this.cleanupTempFiles();

      console.log('\n✅ Meeting Processing Complete!\n');
      console.log(`📁 Note saved to: ${notePath}\n`);

      return {
        success: true,
        transcription,
        summary,
        notePath,
      };
    } catch (error) {
      console.error('\n❌ Failed to process meeting:', error.message);
      throw error;
    }
  }

  /**
   * Clean up temporary audio files
   */
  cleanupTempFiles() {
    try {
      if (this.currentAudioPath && fs.existsSync(this.currentAudioPath)) {
        fs.unlinkSync(this.currentAudioPath);
        console.log('🧹 Cleaned up temporary audio file');
      }

      // Also clean up the .txt file created by whisper
      const txtPath = this.currentAudioPath.replace(/\.[^/.]+$/, '.txt');
      if (fs.existsSync(txtPath)) {
        fs.unlinkSync(txtPath);
      }
    } catch (error) {
      console.warn('⚠️  Failed to cleanup temp files:', error.message);
    }
  }

  /**
   * Check if currently recording
   */
  isRecording() {
    return this.audioCapture && this.audioCapture.getIsRecording();
  }
}

module.exports = { MeetingNoteTaker };

