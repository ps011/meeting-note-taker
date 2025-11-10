const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  dialog,
  shell,
  systemPreferences,
} = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Config = require('./config');
const DependencyChecker = require('./dependencyChecker');
const analytics = require('./analytics');
const {
  createWindow: createMainWindow,
  createSetupWindow: createSetupWindowUtil,
} = require('../utils/main/window');
const {
  updateTrayIcon,
  updateTrayMenu,
  setupTrayClickHandlers,
} = require('../utils/main/tray');
const { loadBaseTrayIcon } = require('../utils/main/trayIcon');

let mainWindow;
let setupWindow;
let tray;
let isRecording = false;
let baseTrayIcon = null;

function createWindow() {
  mainWindow = createMainWindow(app);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function updateTrayIconLocal(recording) {
  isRecording = recording;
  if (tray) {
    baseTrayIcon = updateTrayIcon(tray, recording, baseTrayIcon);
  }
}

function updateTrayMenuLocal() {
  if (tray) {
    updateTrayMenu(tray, isRecording, mainWindow, app, shell);
  }
}

function createTray() {
  // Load base icon
  baseTrayIcon = loadBaseTrayIcon();

  tray = new Tray(baseTrayIcon);

  // Set initial menu
  updateTrayMenuLocal();

  tray.setToolTip('Aura - Meeting Recorder');

  // Setup click handlers
  setupTrayClickHandlers(
    tray,
    () => isRecording,
    mainWindow,
    updateTrayMenuLocal
  );
}

function createSetupWindow() {
  setupWindow = createSetupWindowUtil();
  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

app.whenReady().then(() => {
  // Track app start
  analytics.trackAppStart();

  // Check if setup is completed
  if (Config.isSetupCompleted()) {
    createWindow();
    createTray();
    analytics.trackPageView('main', 'Main App Window');
  } else {
    createSetupWindow();
    analytics.trackPageView('setup', 'Setup Wizard');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (Config.isSetupCompleted()) {
        createWindow();
        analytics.trackPageView('main', 'Main App Window');
      } else {
        createSetupWindow();
        analytics.trackPageView('setup', 'Setup Wizard');
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  analytics.trackAppClose();
});

// IPC Handlers for communication with renderer process
ipcMain.on('get-config', (event) => {
  event.reply('config-data', Config.getAll());
});

ipcMain.handle('get-config', async () => {
  return Config.getAll();
});

ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Recording state change handlers
ipcMain.on('recording-started', () => {
  updateTrayIconLocal(true);
  updateTrayMenuLocal();
});

ipcMain.on('recording-stopped', () => {
  updateTrayIconLocal(false);
  updateTrayMenuLocal();
});

// Setup wizard handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Notes Folder',
    buttonLabel: 'Select Folder',
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-audio-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: 'Select Audio File',
    buttonLabel: 'Select File',
    filters: [
      {
        name: 'Audio Files',
        extensions: ['mp3', 'wav', 'webm', 'm4a', 'ogg', 'flac', 'aac'],
      },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return {
      filePath: result.filePaths[0],
      fileName: path.basename(result.filePaths[0]),
    };
  }
  return null;
});

ipcMain.on('setup-complete', (event, config) => {
  // Save configuration
  Config.save(config);

  // Track setup completion
  analytics.trackEvent('setup_complete', {
    category: 'setup',
    label: 'setup_wizard_completed',
    custom_parameter_1: config.notesPath
      ? 'notes_path_configured'
      : 'no_notes_path',
    custom_parameter_2: config.llamaModel || 'default_model',
  });

  // Ensure notes folder exists
  if (config.notesPath) {
    const fs = require('fs');
    if (!fs.existsSync(config.notesPath)) {
      fs.mkdirSync(config.notesPath, { recursive: true });
    }
  }

  // Close setup window
  if (setupWindow) {
    setupWindow.close();
    setupWindow = null;
  }

  // Create main window
  createWindow();
  createTray();
  analytics.trackPageView('main', 'Main App Window');
});

ipcMain.on('save-config', (event, config) => {
  // Save configuration without changing windows
  Config.save(config);

  // Ensure notes folder exists
  if (config.notesPath) {
    const fs = require('fs');
    if (!fs.existsSync(config.notesPath)) {
      fs.mkdirSync(config.notesPath, { recursive: true });
    }
  }
});

ipcMain.on('setup-skip', () => {
  // User skipped setup, still create main window but with warnings
  Config.save({ setupCompleted: false });

  if (setupWindow) {
    setupWindow.close();
    setupWindow = null;
  }

  createWindow();
  createTray();
});

// Permission handlers
ipcMain.handle('check-screen-recording-permission', async () => {
  if (process.platform === 'darwin') {
    try {
      // Try to actually get screen sources - this is the real test
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });

      // If we got sources, permission is truly granted
      const granted = sources && sources.length > 0;

      return {
        granted: granted,
        status: granted ? 'granted' : 'denied',
        sourceCount: sources ? sources.length : 0,
      };
    } catch (error) {
      return {
        granted: false,
        status: 'error',
        error: error.message,
      };
    }
  }
  return { granted: true, status: 'not-applicable' };
});

ipcMain.handle('open-system-preferences', async (event, pane) => {
  if (process.platform === 'darwin') {
    // Try to open System Settings to Privacy & Security
    // Note: We can't directly open Screen Recording, but we can get close
    exec(
      'open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"',
      (error) => {
        if (error) {
          // Fallback to just opening System Settings
          shell.openExternal(
            'x-apple.systempreferences:com.apple.preference.security'
          );
        }
      }
    );
    return true;
  }
  return false;
});

ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    try {
      const status = await systemPreferences.askForMediaAccess('microphone');
      return { granted: status };
    } catch (error) {
      return { granted: false, error: error.message };
    }
  }
  return { granted: true };
});

// Get desktop sources for screen recording
ipcMain.handle('get-desktop-sources', async (event, options) => {
  try {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources(options);
    return { success: true, sources: sources };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Dependency management handlers
ipcMain.handle('check-dependencies', async (event) => {
  const checker = new DependencyChecker();

  // Check all dependencies and send progress updates
  const result = await checker.checkAll((progress) => {
    event.sender.send('dependency-progress', progress);
  });

  return result;
});

ipcMain.handle('debug-environment', async (event) => {
  const checker = new DependencyChecker();
  await checker.debugEnvironment();
  return { success: true };
});

ipcMain.handle('install-dependencies', async (event, missingDeps) => {
  const checker = new DependencyChecker();

  // Install missing dependencies with progress updates
  const result = await checker.installMissing(missingDeps, (progress) => {
    event.sender.send('dependency-progress', progress);
  });

  return result;
});

ipcMain.handle('check-ollama-running', async (event) => {
  const checker = new DependencyChecker();
  return await checker.checkOllamaRunning();
});

ipcMain.handle('start-ollama', async (event) => {
  const checker = new DependencyChecker();

  const result = await checker.startOllama((progress) => {
    event.sender.send('dependency-progress', progress);
  });

  return result;
});

ipcMain.handle('pull-ollama-model', async (event, modelName) => {
  const checker = new DependencyChecker();

  const result = await checker.pullOllamaModel(modelName, (progress) => {
    event.sender.send('dependency-progress', progress);
  });

  return result;
});

ipcMain.handle('run-full-dependency-setup', async (event, options) => {
  const checker = new DependencyChecker();

  const result = await checker.runFullSetup({
    ...options,
    progressCallback: (progress) => {
      event.sender.send('dependency-progress', progress);
    },
  });

  return result;
});

// Recording history handlers
ipcMain.handle('get-all-recordings', async (event) => {
  try {
    const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
    const config = Config.getAll();

    if (!config || !config.notesPath) {
      return { success: false, error: 'Not configured' };
    }

    const noteTaker = new MeetingNoteTaker(config);
    const recordings = noteTaker.getAllRecordings();

    return { success: true, recordings: recordings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-recording', async (event, recordingId) => {
  try {
    const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
    const config = Config.getAll();

    if (!config || !config.notesPath) {
      return { success: false, error: 'Not configured' };
    }

    const noteTaker = new MeetingNoteTaker(config);
    const recording = noteTaker.getRecording(recordingId);

    if (!recording) {
      return { success: false, error: 'Recording not found' };
    }

    return { success: true, recording: recording };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('retry-transcription', async (event, recordingId) => {
  try {
    const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
    const config = Config.getAll();

    if (!config || !config.notesPath) {
      return { success: false, error: 'Not configured' };
    }

    const noteTaker = new MeetingNoteTaker(config);

    // Send initial progress update immediately (before any async operations)
    try {
      event.sender.send('retry-progress', {
        recordingId,
        step: 0,
        total: 3,
        message: 'Starting retry...',
      });
    } catch (error) {}

    const result = await noteTaker.retryTranscription(recordingId, {
      onProgress: (progress) => {
        try {
          event.sender.send('retry-progress', { recordingId, ...progress });
        } catch (error) {}
      },
      onTranscriptionComplete: () => {
        event.sender.send('retry-progress', {
          recordingId,
          step: 1,
          total: 3,
          message: 'Transcription complete',
          transcriptionComplete: true,
        });
      },
      onSummarizationComplete: () => {
        event.sender.send('retry-progress', {
          recordingId,
          step: 2,
          total: 3,
          message: 'Summary complete',
          summarizationComplete: true,
        });
      },
    });

    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-recording', async (event, recordingId) => {
  try {
    const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
    const config = Config.getAll();

    if (!config || !config.notesPath) {
      return { success: false, error: 'Not configured' };
    }

    const noteTaker = new MeetingNoteTaker(config);
    const success = noteTaker.deleteRecording(recordingId);

    return { success: success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-recording', async (event, recordingId, updates) => {
  try {
    const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
    const config = Config.getAll();

    if (!config || !config.notesPath) {
      return { success: false, error: 'Not configured' };
    }

    const noteTaker = new MeetingNoteTaker(config);
    const success = noteTaker.updateRecordingPath(recordingId, updates);

    return { success: success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('convert-note', async (event, notePath, newTemplateId) => {
  try {
    const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
    const config = Config.getAll();

    if (!config || !config.notesPath) {
      return { success: false, error: 'Not configured' };
    }

    const noteTaker = new MeetingNoteTaker(config);

    // Send initial progress update
    try {
      event.sender.send('convert-progress', {
        notePath,
        step: 0,
        total: 3,
        message: 'Starting conversion...',
      });
    } catch (error) {}

    const result = await noteTaker.convertNote(notePath, newTemplateId, {
      onProgress: (progress) => {
        try {
          event.sender.send('convert-progress', { notePath, ...progress });
        } catch (error) {}
      },
    });

    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-templates', async () => {
  try {
    const { getAllTemplates } = require('../../src/templates.js');
    const templates = getAllTemplates();
    return { success: true, templates };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
