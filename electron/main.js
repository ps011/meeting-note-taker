const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog, shell, systemPreferences } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Config = require('./config');
const DependencyChecker = require('./dependencyChecker');

let mainWindow;
let setupWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 900,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F5F1E8',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, '../assets/icon.icns')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Create a simple tray icon (you can replace with a proper icon)
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/icon.icns')
  ).resize({ width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
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

  tray.setToolTip('Aura - Meeting Recorder');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 700,
    height: 800,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../assets/icon.icns')
  });

  setupWindow.loadFile(path.join(__dirname, 'setup.html'));

  if (process.argv.includes('--dev')) {
    setupWindow.webContents.openDevTools();
  }

  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

app.whenReady().then(() => {
  // Check if setup is completed
  if (Config.isSetupCompleted()) {
    createWindow();
    createTray();
  } else {
    createSetupWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (Config.isSetupCompleted()) {
        createWindow();
      } else {
        createSetupWindow();
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

// Setup wizard handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Obsidian Vault Folder',
    buttonLabel: 'Select Folder'
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
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'webm', 'm4a', 'ogg', 'flac', 'aac'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return {
      filePath: result.filePaths[0],
      fileName: path.basename(result.filePaths[0])
    };
  }
  return null;
});

ipcMain.on('setup-complete', (event, config) => {
  // Save configuration
  Config.save(config);
  
  // Ensure vault exists
  if (config.obsidianVaultPath) {
    const fs = require('fs');
    if (!fs.existsSync(config.obsidianVaultPath)) {
      fs.mkdirSync(config.obsidianVaultPath, { recursive: true });
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
});

ipcMain.on('save-config', (event, config) => {
  // Save configuration without changing windows
  Config.save(config);
  
  // Ensure vault exists
  if (config.obsidianVaultPath) {
    const fs = require('fs');
    if (!fs.existsSync(config.obsidianVaultPath)) {
      fs.mkdirSync(config.obsidianVaultPath, { recursive: true });
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
        thumbnailSize: { width: 0, height: 0 }
      });
      
      // If we got sources, permission is truly granted
      const granted = sources && sources.length > 0;
      
      return {
        granted: granted,
        status: granted ? 'granted' : 'denied',
        sourceCount: sources ? sources.length : 0
      };
    } catch (error) {
      console.error('Error checking screen recording permission:', error);
      return {
        granted: false,
        status: 'error',
        error: error.message
      };
    }
  }
  return { granted: true, status: 'not-applicable' };
});

ipcMain.handle('open-system-preferences', async (event, pane) => {
  if (process.platform === 'darwin') {
    // Try to open System Settings to Privacy & Security
    // Note: We can't directly open Screen Recording, but we can get close
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"', (error) => {
      if (error) {
        // Fallback to just opening System Settings
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security');
      }
    });
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
    console.error('Error getting desktop sources:', error);
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
    }
  });
  
  return result;
});

