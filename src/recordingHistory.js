const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Recording history manager
 * Tracks all recordings and their status
 */
class RecordingHistory {
  constructor() {
    this.historyFilePath = path.join(os.homedir(), '.meeting-note-taker', 'recordings.json');
    this.recordingsDir = path.join(os.homedir(), '.meeting-note-taker', 'recordings');
    
    this._ensureDirectories();
    this._loadHistory();
  }

  /**
   * Ensure necessary directories exist
   */
  _ensureDirectories() {
    const dir = path.dirname(this.historyFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * Load history from disk
   */
  _loadHistory() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const data = fs.readFileSync(this.historyFilePath, 'utf-8');
        this.recordings = JSON.parse(data);
      } else {
        this.recordings = [];
      }
    } catch (error) {
      console.error('Failed to load recording history:', error);
      this.recordings = [];
    }
  }

  /**
   * Save history to disk
   */
  _saveHistory() {
    try {
      fs.writeFileSync(this.historyFilePath, JSON.stringify(this.recordings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save recording history:', error);
    }
  }

  /**
   * Get a unique recording ID
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get the path for a recording's audio file
   */
  getRecordingPath(recordingId) {
    return path.join(this.recordingsDir, `${recordingId}.webm`);
  }

  /**
   * Move a temporary audio file to the recordings directory
   */
  saveRecordingFile(tempPath, recordingId) {
    const targetPath = this.getRecordingPath(recordingId);
    
    if (fs.existsSync(tempPath)) {
      fs.renameSync(tempPath, targetPath);
      return targetPath;
    }
    
    return null;
  }

  /**
   * Add a new recording to history
   */
  addRecording({ title, audioPath, timestamp, templateId }) {
    const recordingId = this._generateId();
    
    const recording = {
      id: recordingId,
      title: title || 'Untitled Meeting',
      timestamp: timestamp || Date.now(),
      status: 'pending', // pending, processing, completed, failed
      audioPath: audioPath,
      transcriptPath: null,
      notePath: null,
      error: null,
      templateId: templateId || 'general'
    };

    this.recordings.push(recording);
    this._saveHistory();

    return recording;
  }

  /**
   * Update recording status
   */
  updateRecording(recordingId, updates) {
    const recording = this.recordings.find(r => r.id === recordingId);
    
    if (recording) {
      Object.assign(recording, updates);
      this._saveHistory();
      return true;
    }
    
    return false;
  }

  /**
   * Get a recording by ID
   */
  getRecording(recordingId) {
    return this.recordings.find(r => r.id === recordingId);
  }

  /**
   * Get all recordings, sorted by timestamp (newest first)
   */
  getAllRecordings() {
    return [...this.recordings].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get recordings by status
   */
  getRecordingsByStatus(status) {
    return this.recordings.filter(r => r.status === status);
  }

  /**
   * Delete a recording and its associated files
   */
  deleteRecording(recordingId) {
    const index = this.recordings.findIndex(r => r.id === recordingId);
    
    if (index === -1) {
      return false;
    }

    const recording = this.recordings[index];

    // Delete audio file
    if (recording.audioPath && fs.existsSync(recording.audioPath)) {
      try {
        fs.unlinkSync(recording.audioPath);
      } catch (error) {
        console.error('Failed to delete audio file:', error);
      }
    }

    // Delete transcript file if exists
    if (recording.transcriptPath && fs.existsSync(recording.transcriptPath)) {
      try {
        fs.unlinkSync(recording.transcriptPath);
      } catch (error) {
        console.error('Failed to delete transcript file:', error);
      }
    }

    // Delete note file if exists
    if (recording.notePath && fs.existsSync(recording.notePath)) {
      try {
        fs.unlinkSync(recording.notePath);
      } catch (error) {
        console.error('Failed to delete note file:', error);
      }
    }

    // Remove from history
    this.recordings.splice(index, 1);
    this._saveHistory();

    return true;
  }

  /**
   * Get recording statistics
   */
  getStats() {
    const total = this.recordings.length;
    const completed = this.recordings.filter(r => r.status === 'completed').length;
    const failed = this.recordings.filter(r => r.status === 'failed').length;
    const processing = this.recordings.filter(r => r.status === 'processing').length;
    const pending = this.recordings.filter(r => r.status === 'pending').length;

    // Calculate total size
    let totalSize = 0;
    this.recordings.forEach(recording => {
      if (recording.audioPath && fs.existsSync(recording.audioPath)) {
        try {
          const stats = fs.statSync(recording.audioPath);
          totalSize += stats.size;
        } catch (error) {
          // Ignore errors
        }
      }
    });

    return {
      total,
      completed,
      failed,
      processing,
      pending,
      totalSize
    };
  }
}

module.exports = { RecordingHistory };


