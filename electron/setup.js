const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// DOM Elements
const vaultPathInput = document.getElementById('vaultPath');
const browseButton = document.getElementById('browseButton');
const vaultStatus = document.getElementById('vaultStatus');
const createVaultButton = document.getElementById('createVaultButton');
const advancedToggle = document.getElementById('advancedToggle');
const advancedSettings = document.getElementById('advancedSettings');
const skipButton = document.getElementById('skipButton');
const completeButton = document.getElementById('completeButton');
const themeToggle = document.getElementById('themeToggle');

// Dependency elements
const dependencyStatus = document.getElementById('dependencyStatus');
const dependencyActions = document.getElementById('dependencyActions');
const checkDepsButton = document.getElementById('checkDepsButton');
const installDepsButton = document.getElementById('installDepsButton');
const overallProgress = document.getElementById('overallProgress');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');

// Advanced settings
const llamaModelInput = document.getElementById('llamaModel');
const whisperModelSelect = document.getElementById('whisperModel');
const llamaApiUrlInput = document.getElementById('llamaApiUrl');

let selectedPath = '';
let dependenciesChecked = false;
let allDependenciesInstalled = false;
let missingDependencies = [];

// Load theme
loadTheme();

// Initialize dependency checker on load
initializeDependencyChecker();

// Theme Management
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Dependency Management Functions
function initializeDependencyChecker() {
  // Show initial state
  dependencyStatus.innerHTML = `
    <div class="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
      <p class="text-sm text-gray-700 dark:text-gray-300">
        Click "Check Dependencies" to verify required system tools are installed.
      </p>
    </div>
  `;
  dependencyActions.classList.remove('hidden');
  
  // Auto-check on first load
  setTimeout(() => {
    checkDepsButton.click();
  }, 500);
}

function createDependencyItem(dep) {
  const statusIcon = dep.installed 
    ? '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
    : '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  
  const statusClass = dep.installed
    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';

  return `
    <div class="flex items-center gap-3 p-3 ${statusClass} border rounded-lg" id="dep-${dep.name.toLowerCase().replace(/\s+/g, '-')}">
      ${statusIcon}
      <div class="flex-1">
        <div class="font-medium text-gray-800 dark:text-gray-100">${dep.name}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">${dep.description}</div>
      </div>
      <span class="text-sm font-medium ${dep.installed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
        ${dep.installed ? 'Installed' : 'Missing'}
      </span>
    </div>
  `;
}

function updateDependencyItem(depName, status, message) {
  const depId = `dep-${depName.toLowerCase().replace(/\s+/g, '-')}`;
  const depElement = document.getElementById(depId);
  
  if (!depElement) return;

  let statusIcon, statusClass, statusText;
  
  if (status === 'installing') {
    statusIcon = '<svg class="w-5 h-5 text-blue-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>';
    statusClass = 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
    statusText = 'Installing...';
  } else if (status === 'success') {
    statusIcon = '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    statusClass = 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    statusText = 'Installed';
  } else if (status === 'error') {
    statusIcon = '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
    statusClass = 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    statusText = 'Failed';
  }

  depElement.className = `flex items-center gap-3 p-3 ${statusClass} border rounded-lg`;
  
  const statusSpan = depElement.querySelector('span');
  if (statusSpan) {
    statusSpan.textContent = statusText;
    statusSpan.className = `text-sm font-medium ${status === 'success' ? 'text-green-600 dark:text-green-400' : status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`;
  }

  const iconDiv = depElement.querySelector('svg').parentElement;
  iconDiv.innerHTML = statusIcon;
}

function updateProgress(percent, label) {
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${Math.round(percent)}%`;
  if (label) {
    progressLabel.textContent = label;
  }
}

async function checkDependencies() {
  try {
    checkDepsButton.disabled = true;
    checkDepsButton.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Checking...
    `;
    
    overallProgress.classList.remove('hidden');
    dependencyStatus.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400">Checking dependencies...</div>';
    
    const result = await ipcRenderer.invoke('check-dependencies');
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to check dependencies');
    }

    // Display results
    dependencyStatus.innerHTML = result.results.map(dep => createDependencyItem(dep)).join('');
    
    missingDependencies = result.missing;
    dependenciesChecked = true;
    allDependenciesInstalled = result.allInstalled;

    if (result.allInstalled) {
      overallProgress.classList.add('hidden');
      installDepsButton.classList.add('hidden');
      
      dependencyStatus.insertAdjacentHTML('beforeend', `
        <div class="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p class="text-sm text-green-800 dark:text-green-200 font-medium">
            ✅ All dependencies are installed!
          </p>
        </div>
      `);
    } else {
      installDepsButton.classList.remove('hidden');
      
      dependencyStatus.insertAdjacentHTML('beforeend', `
        <div class="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p class="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
            ⚠️ ${result.missing.length} dependencies are missing. Click "Install Missing Dependencies" to continue.
          </p>
        </div>
      `);
    }

    checkDepsButton.disabled = false;
    checkDepsButton.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Re-check Dependencies
    `;
    
    // Update complete button state based on vault and dependency status
    const vaultReady = selectedPath && fs.existsSync(selectedPath);
    updateCompleteButtonState(vaultReady);

  } catch (error) {
    console.error('Error checking dependencies:', error);
    dependencyStatus.innerHTML = `
      <div class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
        <p class="text-sm text-red-800 dark:text-red-200">
          ❌ Failed to check dependencies: ${error.message}
        </p>
      </div>
    `;
    checkDepsButton.disabled = false;
    overallProgress.classList.add('hidden');
  }
}

async function installDependencies() {
  try {
    installDepsButton.disabled = true;
    checkDepsButton.disabled = true;
    
    installDepsButton.innerHTML = `
      <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Installing...
    `;

    overallProgress.classList.remove('hidden');
    updateProgress(0, 'Starting installation...');

    const result = await ipcRenderer.invoke('install-dependencies', missingDependencies);

    if (!result.success) {
      throw new Error('Some dependencies failed to install');
    }

    // Re-check after installation
    updateProgress(100, 'Verifying installation...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await checkDependencies();
    
    installDepsButton.classList.add('hidden');
    overallProgress.classList.add('hidden');

  } catch (error) {
    console.error('Error installing dependencies:', error);
    
    dependencyStatus.insertAdjacentHTML('beforeend', `
      <div class="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
        <p class="text-sm text-red-800 dark:text-red-200">
          ❌ Installation failed: ${error.message}
        </p>
      </div>
    `);

    installDepsButton.disabled = false;
    checkDepsButton.disabled = false;
    installDepsButton.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
      </svg>
      Retry Installation
    `;
  }
}

// Listen for dependency progress updates
ipcRenderer.on('dependency-progress', (event, progress) => {
  if (progress.step === 'checking') {
    updateProgress(progress.progress || 0, `Checking ${progress.dependency}...`);
  } else if (progress.step === 'installing') {
    if (progress.status === 'in-progress' || progress.status === 'starting') {
      updateDependencyItem(progress.dependency, 'installing');
      updateProgress(progress.progress || 50, `Installing ${progress.dependency}...`);
    } else if (progress.status === 'success') {
      updateDependencyItem(progress.dependency, 'success');
    } else if (progress.status === 'error') {
      updateDependencyItem(progress.dependency, 'error', progress.error);
    }
  } else if (progress.phase) {
    updateProgress(50, progress.message);
  }
});

// Event listeners for dependency buttons
checkDepsButton.addEventListener('click', checkDependencies);
installDepsButton.addEventListener('click', installDependencies);

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
}

// Event listener for theme toggle
themeToggle.addEventListener('click', toggleTheme);

// Load existing configuration
ipcRenderer.invoke('get-config').then((config) => {
  // Set vault path from config or use default
  const configuredPath = config.obsidianVaultPath;
  const defaultPath = path.join(os.homedir(), 'Documents', 'ObsidianVault', 'Meetings');
  selectedPath = configuredPath || defaultPath;
  vaultPathInput.value = selectedPath;
  checkVaultPath(selectedPath);

  // Load other settings
  if (config.llamaModel) {
    llamaModelInput.value = config.llamaModel;
  }
  if (config.whisperModel) {
    whisperModelSelect.value = config.whisperModel;
  }
  if (config.llamaApiUrl) {
    llamaApiUrlInput.value = config.llamaApiUrl;
  }
  
  // Update button text based on whether this is initial setup or settings
  if (config.setupCompleted) {
    skipButton.textContent = 'Cancel';
    completeButton.textContent = 'Save Settings';
    document.querySelector('h1').textContent = 'Settings';
    document.querySelector('h1').nextElementSibling.textContent = 'Update your configuration';
  }
});

// Browse for folder
browseButton.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-folder');
  if (result) {
    selectedPath = result;
    vaultPathInput.value = result;
    checkVaultPath(result);
  }
});

// Check if vault exists
function checkVaultPath(path) {
  const exists = fs.existsSync(path);
  
  vaultStatus.classList.remove('hidden');
  
  if (exists) {
    vaultStatus.className = 'p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200';
    vaultStatus.textContent = '✓ Folder exists and is ready to use';
    createVaultButton.classList.add('hidden');
    updateCompleteButtonState(true);
  } else {
    vaultStatus.className = 'p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200';
    vaultStatus.textContent = '⚠️ Folder does not exist. You can create it below.';
    createVaultButton.classList.remove('hidden');
    updateCompleteButtonState(false);
  }
}

// Update the complete button state based on all requirements
function updateCompleteButtonState(vaultReady) {
  // Can complete if vault is ready AND either all dependencies are installed OR dependencies were checked
  const canComplete = vaultReady && (allDependenciesInstalled || dependenciesChecked);
  completeButton.disabled = !canComplete;
  
  if (!canComplete && !allDependenciesInstalled && dependenciesChecked) {
    completeButton.title = 'Please install all dependencies first';
  } else if (!canComplete && !vaultReady) {
    completeButton.title = 'Please select or create a vault folder first';
  } else {
    completeButton.title = '';
  }
}

// Create vault
createVaultButton.addEventListener('click', () => {
  try {
    // Create directory
    fs.mkdirSync(selectedPath, { recursive: true });
    
    // Create .obsidian folder
    const obsidianDir = path.join(selectedPath, '.obsidian');
    fs.mkdirSync(obsidianDir, { recursive: true });
    
    // Create basic config
    const appearanceConfig = {
      theme: 'obsidian',
      baseFontSize: 16
    };
    fs.writeFileSync(
      path.join(obsidianDir, 'appearance.json'),
      JSON.stringify(appearanceConfig, null, 2)
    );
    
    vaultStatus.className = 'p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200';
    vaultStatus.textContent = '✓ Vault created successfully!';
    createVaultButton.classList.add('hidden');
    updateCompleteButtonState(true);
  } catch (error) {
    vaultStatus.className = 'p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200';
    vaultStatus.textContent = `❌ Failed to create vault: ${error.message}`;
  }
});

// Toggle advanced settings
advancedToggle.addEventListener('click', () => {
  advancedSettings.classList.toggle('hidden');
  const icon = advancedToggle.querySelector('svg');
  const text = advancedToggle.childNodes[2];
  if (!advancedSettings.classList.contains('hidden')) {
    advancedToggle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m-9-9h6m6 0h6"/>
      </svg>
      Hide Advanced Settings
    `;
  } else {
    advancedToggle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6m0 6v6m-9-9h6m6 0h6"/>
      </svg>
      Advanced Settings (Optional)
    `;
  }
});

// Skip setup
skipButton.addEventListener('click', () => {
  // Check if we're in the initial setup or settings mode
  ipcRenderer.invoke('get-config').then((currentConfig) => {
    if (currentConfig.setupCompleted) {
      // Already set up, just go back
      window.location.href = 'index.html';
    } else {
      // First time setup, skip it
      ipcRenderer.send('setup-skip');
    }
  });
});

// Complete setup
completeButton.addEventListener('click', () => {
  const config = {
    obsidianVaultPath: selectedPath,
    llamaModel: llamaModelInput.value.trim() || 'llama3',
    whisperModel: whisperModelSelect.value,
    llamaApiUrl: llamaApiUrlInput.value.trim() || 'http://localhost:11434/api/generate',
    sampleRate: 16000,
    channels: 1,
    setupCompleted: true,
    dependenciesChecked: dependenciesChecked,
    dependenciesInstalled: allDependenciesInstalled
  };

  // Save config
  ipcRenderer.invoke('get-config').then((currentConfig) => {
    if (currentConfig.setupCompleted) {
      // Already set up, just save and go back
      ipcRenderer.send('save-config', config);
      window.location.href = 'index.html';
    } else {
      // First time setup
      ipcRenderer.send('setup-complete', config);
    }
  });
});

