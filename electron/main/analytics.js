const { ipcMain, ipcRenderer } = require('electron');

class Analytics {
  constructor() {
    this.trackingId = 'G-80MG7FLW61';
    this.isEnabled = true;
    this.sessionId = this.generateSessionId();
    this.userId = this.generateUserId();
  }

  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  // Track page views
  trackPageView(pageName, pageTitle) {
    if (!this.isEnabled) return;

    const data = {
      page_title: pageTitle || pageName,
      page_location: `app://${pageName}`,
      page_path: `/${pageName}`,
      custom_map: {
        dimension1: this.userId,
        dimension2: this.sessionId,
      },
    };

    this.sendEvent('page_view', data);
  }

  // Track custom events
  trackEvent(eventName, parameters = {}) {
    if (!this.isEnabled) return;

    const data = {
      event_category: parameters.category || 'app_interaction',
      event_label: parameters.label || '',
      value: parameters.value || 0,
      custom_map: {
        dimension1: this.userId,
        dimension2: this.sessionId,
      },
      ...parameters,
    };

    this.sendEvent(eventName, data);
  }

  // Track app lifecycle events
  trackAppStart() {
    this.trackEvent('app_start', {
      category: 'app_lifecycle',
      label: 'application_started',
    });
  }

  trackAppClose() {
    this.trackEvent('app_close', {
      category: 'app_lifecycle',
      label: 'application_closed',
    });
  }

  // Track recording events
  trackRecordingStart(duration = 0) {
    this.trackEvent('recording_start', {
      category: 'recording',
      label: 'recording_started',
      value: duration,
    });
  }

  trackRecordingStop(duration = 0) {
    this.trackEvent('recording_stop', {
      category: 'recording',
      label: 'recording_stopped',
      value: duration,
    });
  }

  // Track transcription events
  trackTranscriptionStart() {
    this.trackEvent('transcription_start', {
      category: 'transcription',
      label: 'transcription_started',
    });
  }

  trackTranscriptionComplete(duration = 0, wordCount = 0) {
    this.trackEvent('transcription_complete', {
      category: 'transcription',
      label: 'transcription_completed',
      value: duration,
      custom_parameter_1: wordCount,
    });
  }

  // Track summarization events
  trackSummarizationStart() {
    this.trackEvent('summarization_start', {
      category: 'summarization',
      label: 'summarization_started',
    });
  }

  trackSummarizationComplete(duration = 0) {
    this.trackEvent('summarization_complete', {
      category: 'summarization',
      label: 'summarization_completed',
      value: duration,
    });
  }

  // Track settings changes
  trackSettingsChange(settingName, oldValue, newValue) {
    this.trackEvent('settings_change', {
      category: 'settings',
      label: settingName,
      custom_parameter_1: oldValue,
      custom_parameter_2: newValue,
    });
  }

  // Track errors
  trackError(errorType, errorMessage, errorContext = '') {
    this.trackEvent('error_occurred', {
      category: 'error',
      label: errorType,
      custom_parameter_1: errorMessage,
      custom_parameter_2: errorContext,
    });
  }

  // Send event to Google Analytics
  sendEvent(eventName, data) {
    if (!this.isEnabled) return;

    try {
      // In a real implementation, you would send this to Google Analytics
      // For now, we'll log it and potentially send via IPC to renderer

      // Send to renderer process if available
      if (typeof ipcRenderer !== 'undefined') {
        ipcRenderer.send('analytics-event', {
          eventName,
          data,
          trackingId: this.trackingId,
        });
      }
    } catch (error) {}
  }

  // Enable/disable analytics
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // Update tracking ID
  setTrackingId(trackingId) {
    this.trackingId = trackingId;
  }
}

// Create singleton instance
const analytics = new Analytics();

// IPC handlers for main process
if (typeof ipcMain !== 'undefined') {
  ipcMain.handle(
    'analytics-track-event',
    async (event, eventName, parameters) => {
      analytics.trackEvent(eventName, parameters);
    }
  );

  ipcMain.handle(
    'analytics-track-page-view',
    async (event, pageName, pageTitle) => {
      analytics.trackPageView(pageName, pageTitle);
    }
  );

  ipcMain.handle('analytics-set-enabled', async (event, enabled) => {
    analytics.setEnabled(enabled);
  });

  ipcMain.handle('analytics-set-tracking-id', async (event, trackingId) => {
    analytics.setTrackingId(trackingId);
  });
}

module.exports = analytics;
