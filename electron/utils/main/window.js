const { BrowserWindow } = require('electron');
const path = require('path');
const { getUIPath, getAssetPath } = require('./path');

/**
 * Creates the main application window
 * @param {object} app - Electron app instance
 * @returns {BrowserWindow} The main window instance
 */
function createWindow(app) {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 900,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F5F1E8',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: getAssetPath('icon.icns'),
  });

  mainWindow.loadFile(getUIPath('index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    // Note: This doesn't clear the reference, caller should handle that
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

/**
 * Creates the setup window
 * @returns {BrowserWindow} The setup window instance
 */
function createSetupWindow() {
  const setupWindow = new BrowserWindow({
    width: 700,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: getAssetPath('icon.icns'),
  });

  setupWindow.loadFile(getUIPath('setup.html'));

  if (process.argv.includes('--dev')) {
    setupWindow.webContents.openDevTools();
  }

  setupWindow.on('closed', () => {
    // Note: This doesn't clear the reference, caller should handle that
  });

  return setupWindow;
}

module.exports = {
  createWindow,
  createSetupWindow,
};
