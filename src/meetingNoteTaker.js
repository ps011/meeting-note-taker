const path = require('path');
const fs = require('fs');
const os = require('os');
const { AudioCapture } = require('./audioCapture.js');
const { TranscriptionService } = require('./transcription.js');
const { LlamaSummarizer } = require('./summarizer.js');
const { NoteWriter } = require('./noteWriter.js');
const { RecordingHistory } = require('./recordingHistory.js');

/**
 * Main meeting note taker orchestrator
 */
class MeetingNoteTaker {
  constructor(config) {
    this.config = config;
    this.audioCapture = null;
    this.transcriptionService = new TranscriptionService(config.whisperModel || 'base');
    this.summarizer = new LlamaSummarizer(config.llamaApiUrl, config.llamaModel);
    this.noteWriter = new NoteWriter(config.notesPath, config.notesFolder);
    this.recordingHistory = new RecordingHistory();
    this.currentRecording = null;
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
      this.currentAudioPath = path.join(tempDir, `meeting-${timestamp}.webm`);

      // Add to recording history
      this.currentRecording = this.recordingHistory.addRecording({
        title: meetingTitle,
        audioPath: this.currentAudioPath,
        timestamp: timestamp
      });

      console.log(`📝 Recording ID: ${this.currentRecording.id}`);

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
        recordingId: this.currentRecording.id
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

      // Update status to processing
      if (this.currentRecording) {
        this.recordingHistory.updateRecording(this.currentRecording.id, { status: 'processing' });
      }

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
        if (this.currentRecording) {
          this.recordingHistory.updateRecording(this.currentRecording.id, { 
            status: 'failed',
            error: 'Transcription failed or produced no content'
          });
        }
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

      // Step 3: Save notes
      console.log('\nStep 3/3: Saving notes...');
      const notePath = this.noteWriter.saveNote(
        summary,
        transcription,
        this.currentMeetingTitle
      );

      // Update recording with successful results
      if (this.currentRecording) {
        this.recordingHistory.updateRecording(this.currentRecording.id, {
          status: 'completed',
          notePath: notePath,
          error: null
        });
      }

      // DON'T cleanup temp audio file - keep it for history
      // this.cleanupTempFiles();

      console.log('\n✅ Meeting Processing Complete!\n');
      console.log(`📁 Note saved to: ${notePath}\n`);

      return {
        success: true,
        transcription,
        summary,
        notePath,
        recordingId: this.currentRecording?.id
      };
    } catch (error) {
      console.error('\n❌ Failed to process meeting:', error.message);
      
      // Update recording status to failed
      if (this.currentRecording) {
        this.recordingHistory.updateRecording(this.currentRecording.id, {
          status: 'failed',
          error: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Retry transcription for a failed recording
   * @param {string} recordingId - The ID of the recording to retry
   */
  async retryTranscription(recordingId) {
    try {
      const recording = this.recordingHistory.getRecording(recordingId);
      
      if (!recording) {
        throw new Error('Recording not found');
      }

      if (!recording.audioPath || !fs.existsSync(recording.audioPath)) {
        throw new Error('Audio file not found');
      }

      console.log(`\n🔄 Retrying transcription for recording: ${recordingId}\n`);

      // Update status to processing
      this.recordingHistory.updateRecording(recordingId, { 
        status: 'processing',
        error: null 
      });

      // Transcribe
      const transcription = await this.transcriptionService.transcribe(recording.audioPath);
      
      if (!transcription || transcription.length < 10) {
        throw new Error('Transcription failed or produced no content');
      }

      // Summarize
      const summary = await this.summarizer.summarize(transcription, recording.title);

      // Save notes
      const notePath = this.noteWriter.saveNote(
        summary,
        transcription,
        recording.title
      );

      // Update recording with successful results
      this.recordingHistory.updateRecording(recordingId, {
        status: 'completed',
        notePath: notePath,
        error: null
      });

      console.log('\n✅ Retry completed successfully!\n');

      return {
        success: true,
        transcription,
        summary,
        notePath
      };
    } catch (error) {
      console.error('\n❌ Failed to retry transcription:', error.message);
      
      // Update recording status to failed
      this.recordingHistory.updateRecording(recordingId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Get all recordings
   */
  getAllRecordings() {
    return this.recordingHistory.getAllRecordings();
  }

  /**
   * Get a specific recording
   */
  getRecording(recordingId) {
    return this.recordingHistory.getRecording(recordingId);
  }

  /**
   * Delete a recording
   */
  deleteRecording(recordingId) {
    return this.recordingHistory.deleteRecording(recordingId);
  }

  /**
   * Update a recording's path or other properties
   */
  updateRecordingPath(recordingId, updates) {
    return this.recordingHistory.updateRecording(recordingId, updates);
  }

  /**
   * Clean up temporary audio files
   */
  cleanupTempFiles() {
    try {
      // Keep audio files in temp folder for history
      if (this.currentAudioPath && fs.existsSync(this.currentAudioPath)) {
        console.log('📦 Keeping audio file for history:', this.currentAudioPath);
      }

      // Clean up the .txt file created by whisper
      if (this.currentAudioPath) {
        const txtPath = this.currentAudioPath.replace(/\.[^/.]+$/, '.txt');
        if (fs.existsSync(txtPath)) {
          fs.unlinkSync(txtPath);
          console.log('🧹 Cleaned up temporary transcript file');
        }
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
