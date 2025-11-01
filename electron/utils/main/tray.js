const { Menu, Tray } = require('electron');
const { loadBaseTrayIcon, createRecordingIcon } = require('./trayIcon');
const { getUIPath } = require('./path');
const Config = require('../../main/config');

/**
 * Creates the tray menu template
 * @param {boolean} isRecording - Whether recording is active
 * @param {BrowserWindow} mainWindow - Main window instance
 * @param {object} app - Electron app instance
 * @param {object} shell - Electron shell module
 * @returns {Menu} The context menu
 */
function buildTrayMenu(isRecording, mainWindow, app, shell) {
  const config = Config.getAll();
  
  return Menu.buildFromTemplate([
    {
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      click: () => {
        if (mainWindow && mainWindow.webContents) {
          if (isRecording) {
            // Stop recording - don't open window
            mainWindow.webContents.send('tray-stop-recording');
          } else {
            // Start recording - don't open window
            mainWindow.webContents.send('tray-start-recording');
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show Recordings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.loadFile(getUIPath('history.html'));
        }
      }
    },
    {
      label: 'Show Notes',
      click: () => {
        const notesPath = config?.notesPath;
        if (notesPath && notesPath.trim()) {
          shell.openPath(notesPath);
        } else {
          // If no notes path configured, show the window to settings
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.loadFile(getUIPath('index.html'));
            // Notify renderer to show settings or message
            if (mainWindow.webContents) {
              mainWindow.webContents.send('show-notes-not-configured');
            }
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

/**
 * Updates the tray icon based on recording state
 * @param {Tray} tray - Tray instance
 * @param {boolean} recording - Whether recording is active
 * @param {NativeImage} baseTrayIcon - Base tray icon (will be loaded if not provided)
 * @returns {NativeImage} The base tray icon (for caching)
 */
function updateTrayIcon(tray, recording, baseTrayIcon = null) {
  if (!tray) return baseTrayIcon;
  
  let currentBaseIcon = baseTrayIcon;
  
  if (recording) {
    // Show recording icon (red dot)
    if (!currentBaseIcon) {
      currentBaseIcon = loadBaseTrayIcon();
    }
    const recordingIcon = createRecordingIcon(currentBaseIcon);
    tray.setImage(recordingIcon);
    tray.setToolTip('Aura - Recording...');
  } else {
    // Show normal icon
    if (!currentBaseIcon) {
      currentBaseIcon = loadBaseTrayIcon();
    }
    tray.setImage(currentBaseIcon);
    tray.setToolTip('Aura - Meeting Recorder');
  }
  
  return currentBaseIcon;
}

/**
 * Updates the tray menu
 * @param {Tray} tray - Tray instance
 * @param {boolean} isRecording - Whether recording is active
 * @param {BrowserWindow} mainWindow - Main window instance
 * @param {object} app - Electron app instance
 * @param {object} shell - Electron shell module
 */
function updateTrayMenu(tray, isRecording, mainWindow, app, shell) {
  if (!tray) return;
  
  const contextMenu = buildTrayMenu(isRecording, mainWindow, app, shell);
  
  // When recording, don't set context menu to prevent it from showing on click
  // User can still right-click or use other methods to access menu if needed
  // When not recording, show the menu normally
  if (!isRecording) {
    tray.setContextMenu(contextMenu);
  } else {
    // When recording, clear context menu so click directly stops recording
    tray.setContextMenu(null);
  }
}

/**
 * Sets up tray click handlers
 * @param {Tray} tray - Tray instance
 * @param {Function} getIsRecording - Function that returns current recording state
 * @param {BrowserWindow} mainWindow - Main window instance
 * @param {Function} updateMenuFn - Function to update the menu
 */
function setupTrayClickHandlers(tray, getIsRecording, mainWindow, updateMenuFn) {
  tray.on('click', (event, bounds) => {
    const isRecording = getIsRecording();
    if (isRecording) {
      // If recording, stop recording on click without opening window
      // Context menu is already removed in updateTrayMenu when recording
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('tray-stop-recording');
      }
    }
    // When not recording, the context menu will show on click (macOS default behavior)
  });
  
  // On macOS, also handle right-click for menu when not recording
  if (process.platform === 'darwin') {
    tray.on('right-click', () => {
      // Right-click should also show menu when not recording
      if (!getIsRecording()) {
        updateMenuFn();
      }
    });
  }
}

module.exports = {
  updateTrayIcon,
  updateTrayMenu,
  buildTrayMenu,
  setupTrayClickHandlers
};

