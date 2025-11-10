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
    this.transcriptionService = new TranscriptionService(
      config.whisperModel || 'base'
    );
    this.summarizer = new LlamaSummarizer(
      config.llamaApiUrl,
      config.llamaModel
    );
    this.noteWriter = new NoteWriter(config.notesPath, config.notesFolder);
    this.recordingHistory = new RecordingHistory();
    this.currentRecording = null;
    this.currentMeetingTitle = null;
    this.currentTemplateId = 'general';
    this.currentParticipants = [];
    this.currentAudioPath = null;
  }

  /**
   * Start recording a meeting
   * @param {string} meetingTitle - Optional title for the meeting
   * @param {string} templateId - Optional template ID for note generation
   */
  async startMeeting(meetingTitle = 'Meeting', templateId = 'general', participants = []) {
    try {
      this.currentMeetingTitle = meetingTitle;
      this.currentTemplateId = templateId || 'general';
      this.currentParticipants = participants || [];

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
        timestamp: timestamp,
        templateId: templateId || 'general',
      });

      // Initialize audio capture
      this.audioCapture = new AudioCapture(
        this.currentAudioPath,
        this.config.sampleRate || 16000,
        this.config.channels || 1
      );

      // Start recording
      await this.audioCapture.start();

      return {
        success: true,
        message: 'Meeting recording started',
        audioPath: this.currentAudioPath,
        recordingId: this.currentRecording.id,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stop recording and process the meeting
   */
  async stopMeeting(callbacks = {}) {
    try {
      // Update status to processing
      if (this.currentRecording) {
        this.recordingHistory.updateRecording(this.currentRecording.id, {
          status: 'processing',
        });
      }

      // Stop recording
      if (this.audioCapture) {
        await this.audioCapture.stop();
      }

      // Wait a bit for file to be fully written
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if audio file exists and has content
      if (!fs.existsSync(this.currentAudioPath)) {
        throw new Error('Audio file was not created');
      }

      const stats = fs.statSync(this.currentAudioPath);
      if (stats.size < 1000) {
        throw new Error('Audio file is too small. Recording may have failed.');
      }

      // Process the recording

      // Step 1: Transcribe
      const transcription = await this.transcriptionService.transcribe(
        this.currentAudioPath
      );

      if (!transcription || transcription.length < 10) {
        if (this.currentRecording) {
          this.recordingHistory.updateRecording(this.currentRecording.id, {
            status: 'failed',
            error: 'Transcription failed or produced no content',
          });
        }
        throw new Error('Transcription failed or produced no content');
      }

      if (callbacks.onTranscriptionComplete) {
        callbacks.onTranscriptionComplete();
      }

      // Step 2: Summarize
      const summary = await this.summarizer.summarize(
        transcription,
        this.currentMeetingTitle,
        this.currentTemplateId
      );

      if (callbacks.onSummarizationComplete) {
        callbacks.onSummarizationComplete();
      }

      // Step 3: Save notes
      const notePath = this.noteWriter.saveNote(
        summary,
        transcription,
        this.currentMeetingTitle,
        this.currentTemplateId,
        this.currentParticipants || []
      );

      // Update recording with successful results
      if (this.currentRecording) {
        this.recordingHistory.updateRecording(this.currentRecording.id, {
          status: 'completed',
          notePath: notePath,
          error: null,
        });
      }

      // DON'T cleanup temp audio file - keep it for history
      // this.cleanupTempFiles();

      return {
        success: true,
        transcription,
        summary,
        notePath,
        recordingId: this.currentRecording?.id,
      };
    } catch (error) {
      // Update recording status to failed
      if (this.currentRecording) {
        this.recordingHistory.updateRecording(this.currentRecording.id, {
          status: 'failed',
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Retry transcription for a failed recording
   * @param {string} recordingId - The ID of the recording to retry
   * @param {Object} callbacks - Progress callbacks for UI updates
   */
  async retryTranscription(recordingId, callbacks = {}) {
    try {
      const recording = this.recordingHistory.getRecording(recordingId);

      if (!recording) {
        throw new Error('Recording not found');
      }

      if (!recording.audioPath || !fs.existsSync(recording.audioPath)) {
        throw new Error('Audio file not found');
      }

      // Update status to processing
      this.recordingHistory.updateRecording(recordingId, {
        status: 'processing',
        error: null,
      });

      // Send initial progress update
      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 0,
          total: 3,
          message: 'Preparing to retry...',
        });
      }

      // Step 1: Transcribe
      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 1,
          total: 3,
          message: 'Transcribing audio...',
        });
      }
      const transcription = await this.transcriptionService.transcribe(
        recording.audioPath
      );

      if (!transcription || transcription.length < 10) {
        throw new Error('Transcription failed or produced no content');
      }

      if (callbacks.onTranscriptionComplete) {
        callbacks.onTranscriptionComplete();
      }

      // Step 2: Summarize
      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 2,
          total: 3,
          message: 'Generating summary...',
        });
      }
      const templateId = recording.templateId || 'general';
      const summary = await this.summarizer.summarize(
        transcription,
        recording.title,
        templateId
      );

      if (callbacks.onSummarizationComplete) {
        callbacks.onSummarizationComplete();
      }

      // Step 3: Save notes
      if (callbacks.onProgress) {
        callbacks.onProgress({ step: 3, total: 3, message: 'Saving notes...' });
      }
      const notePath = this.noteWriter.saveNote(
        summary,
        transcription,
        recording.title,
        templateId,
        [] // Participants can be added later if needed
      );

      // Update recording with successful results
      this.recordingHistory.updateRecording(recordingId, {
        status: 'completed',
        notePath: notePath,
        error: null,
      });

      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 3,
          total: 3,
          message: 'Completed!',
          completed: true,
        });
      }

      return {
        success: true,
        transcription,
        summary,
        notePath,
      };
    } catch (error) {
      // Update recording status to failed
      this.recordingHistory.updateRecording(recordingId, {
        status: 'failed',
        error: error.message,
      });

      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 0,
          total: 3,
          message: 'Failed: ' + error.message,
          error: true,
        });
      }

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
      }

      // Clean up the .txt file created by whisper
      if (this.currentAudioPath) {
        const txtPath = this.currentAudioPath.replace(/\.[^/.]+$/, '.txt');
        if (fs.existsSync(txtPath)) {
          fs.unlinkSync(txtPath);
        }
      }
    } catch (error) {}
  }

  /**
   * Check if currently recording
   */
  isRecording() {
    return this.audioCapture && this.audioCapture.getIsRecording();
  }

  /**
   * Update meeting title during recording
   */
  updateMeetingTitle(title) {
    this.currentMeetingTitle = title || 'Meeting';
    if (this.currentRecording) {
      this.recordingHistory.updateRecording(this.currentRecording.id, {
        title: this.currentMeetingTitle,
      });
    }
  }

  /**
   * Update meeting template during recording
   */
  updateMeetingTemplate(templateId) {
    this.currentTemplateId = templateId || 'general';
    if (this.currentRecording) {
      this.recordingHistory.updateRecording(this.currentRecording.id, {
        templateId: this.currentTemplateId,
      });
    }
  }

  /**
   * Update meeting participants during recording
   */
  updateMeetingParticipants(participants) {
    this.currentParticipants = participants || [];
  }

  /**
   * Convert an existing note to a different template
   * @param {string} notePath - Path to the existing note file
   * @param {string} newTemplateId - Template ID to convert to
   * @param {Object} callbacks - Progress callbacks
   */
  async convertNote(notePath, newTemplateId, callbacks = {}) {
    try {
      // Parse the existing note
      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 1,
          total: 3,
          message: 'Parsing existing note...',
        });
      }

      const parsed = this.noteWriter.parseNote(notePath);

      if (!parsed.transcription || parsed.transcription.length < 10) {
        throw new Error('No transcription found in note file. Cannot convert.');
      }

      // Generate new summary with the new template
      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 2,
          total: 3,
          message: 'Generating new summary...',
        });
      }

      const newSummary = await this.summarizer.summarize(
        parsed.transcription,
        parsed.title,
        newTemplateId
      );

      if (callbacks.onProgress) {
        callbacks.onProgress({
          step: 3,
          total: 3,
          message: 'Updating note file...',
        });
      }

      // Update the note file
      const updatedPath = this.noteWriter.updateNote(
        notePath,
        newSummary,
        newTemplateId
      );

      return {
        success: true,
        notePath: updatedPath,
        newTemplateId,
        summary: newSummary,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { MeetingNoteTaker };
