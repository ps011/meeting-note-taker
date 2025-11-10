const { ipcRenderer } = require('electron');
const historyThemeUtils = require('../utils/renderer/theme');
const { openMainPage } = require('../utils/renderer/navigation');

// State
let recordings = [];
let retryProgress = {}; // Track retry progress by recordingId
let convertProgress = {}; // Track conversion progress by notePath
let templates = []; // Available templates

// DOM Elements
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const recordingsList = document.getElementById('recordingsList');
const startRecordingButton = document.getElementById('startRecordingButton');

// Use utility function - it already checks for window.Layout

function setupButtonListeners() {
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', () => {
      openMainPage();
    });
  }
  
  const refreshButton = document.getElementById('refreshButton');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadRecordings();
    });
  }
  
  if (startRecordingButton) {
    startRecordingButton.addEventListener('click', () => {
      openMainPage();
    });
  }
}

async function init() {
  // Use window.Layout.loadTheme if available, otherwise use utility
  if (window.Layout?.loadTheme) {
    window.Layout.loadTheme();
  } else {
    historyThemeUtils.loadTheme();
  }
  window.addEventListener('layoutLoaded', setupButtonListeners);
  
  if (document.readyState !== 'loading') {
    setTimeout(setupButtonListeners, 100);
  }
  
  // Listen for retry progress updates
  ipcRenderer.on('retry-progress', (event, progress) => {
    console.log('Received retry progress:', progress);
    retryProgress[progress.recordingId] = progress;
    renderRecordings();
  });
  
  // Listen for convert progress updates
  ipcRenderer.on('convert-progress', (event, progress) => {
    console.log('Received convert progress:', progress);
    convertProgress[progress.notePath] = progress;
    renderRecordings();
  });
  
  // Load templates
  await loadTemplates();
  await loadRecordings();
}

async function loadTemplates() {
  try {
    const result = await ipcRenderer.invoke('get-all-templates');
    if (result.success && result.templates) {
      templates = result.templates;
    }
  } catch (error) {
    console.error('Error loading templates:', error);
  }
}

async function loadRecordings() {
  try {
    showLoading();
    
    const result = await ipcRenderer.invoke('get-all-recordings');
    
    if (result.success && result.recordings) {
      recordings = result.recordings;
      // Clear progress for recordings that are no longer in processing state
      recordings.forEach(recording => {
        if (recording.status !== 'processing' && retryProgress[recording.id]) {
          delete retryProgress[recording.id];
        }
      });
      renderRecordings();
    } else {
      showError(result.error || 'Failed to load recordings');
    }
  } catch (error) {
    console.error('Error loading recordings:', error);
    showError('Failed to load recordings');
  }
}

function showLoading() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  recordingsList.classList.add('hidden');
}

function showError(message) {
  loadingState.classList.add('hidden');
  emptyState.classList.add('hidden');
  recordingsList.classList.remove('hidden');
  recordingsList.innerHTML = `
    <div class="glass-card rounded-3xl p-8 text-center">
      <p class="text-red-600">${message}</p>
    </div>
  `;
}

function renderRecordings() {
  loadingState.classList.add('hidden');
  
  if (recordings.length === 0) {
    emptyState.classList.remove('hidden');
    recordingsList.classList.add('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  recordingsList.classList.remove('hidden');
  
  recordingsList.innerHTML = recordings.map(recording => {
    const date = new Date(recording.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    
    const statusColor = {
      'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'processing': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'failed': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    }[recording.status] || 'bg-gray-100 text-gray-800';
    
    const statusText = recording.status.charAt(0).toUpperCase() + recording.status.slice(1);
    
    return `
      <div class="glass-card rounded-3xl p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              ${recording.title}
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              ${dateStr} at ${timeStr}
            </p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium ${statusColor}">
            ${statusText}
          </span>
        </div>
        
        ${recording.error ? `
          <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p class="text-sm text-red-800 dark:text-red-300">${recording.error}</p>
          </div>
        ` : ''}
        
        <div class="mb-4 space-y-2">
          ${recording.audioPath ? `
            <div class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
              <span class="text-gray-600 dark:text-gray-400 font-medium">Audio:</span>
              <button 
                onclick="window.openFile('${recording.audioPath.replace(/'/g, "\\'")}')"
                class="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1 text-left"
                title="${recording.audioPath}"
              >
                ${recording.audioPath.split(/[/\\]/).pop()}
              </button>
            </div>
          ` : ''}
          ${recording.notePath ? `
            <div class="flex items-center gap-2 text-sm">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span class="text-gray-600 dark:text-gray-400 font-medium">Notes:</span>
              <button 
                onclick="window.openFile('${recording.notePath.replace(/'/g, "\\'")}')"
                class="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1 text-left"
                title="${recording.notePath}"
              >
                ${recording.notePath.split(/[/\\]/).pop()}
              </button>
            </div>
          ` : ''}
        </div>
        
        ${retryProgress[recording.id] ? `
          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-sm text-blue-800 dark:text-blue-300 font-medium">
                ${retryProgress[recording.id].message || 'Processing...'}
              </p>
            </div>
            ${retryProgress[recording.id].step !== undefined && retryProgress[recording.id].total ? `
              <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div 
                  class="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style="width: ${Math.max(0, (retryProgress[recording.id].step / retryProgress[recording.id].total) * 100)}%"
                ></div>
              </div>
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Step ${retryProgress[recording.id].step} of ${retryProgress[recording.id].total}
              </p>
            ` : ''}
          </div>
        ` : ''}
        ${recording.notePath && convertProgress[recording.notePath] ? `
          <div class="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-sm text-purple-800 dark:text-purple-300 font-medium">
                ${convertProgress[recording.notePath].message || 'Converting...'}
              </p>
            </div>
            ${convertProgress[recording.notePath].step !== undefined && convertProgress[recording.notePath].total ? `
              <div class="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                <div 
                  class="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                  style="width: ${Math.max(0, (convertProgress[recording.notePath].step / convertProgress[recording.notePath].total) * 100)}%"
                ></div>
              </div>
              <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Step ${convertProgress[recording.notePath].step} of ${convertProgress[recording.notePath].total}
              </p>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="flex items-center gap-3">
          ${recording.status === 'failed' || recording.status === 'processing' ? `
            <button 
              id="retry-btn-${recording.id}"
              onclick="window.retryTranscription('${recording.id}')"
              class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              ${retryProgress[recording.id] ? 'disabled' : ''}
            >
              ${retryProgress[recording.id] 
                ? '<span class="flex items-center gap-2"><svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Retrying...</span>'
                : 'Retry Transcription'}
            </button>
          ` : ''}
          
          ${recording.notePath ? `
            <button 
              onclick="window.openNote('${recording.notePath.replace(/'/g, "\\'")}')"
              class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              Open Note
            </button>
            ${recording.status === 'completed' ? `
              <button 
                onclick="window.showConvertModal('${recording.notePath.replace(/'/g, "\\'")}', '${recording.templateId || 'general'}')"
                class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium ${convertProgress[recording.notePath] ? 'opacity-50 cursor-not-allowed' : ''}"
                ${convertProgress[recording.notePath] ? 'disabled' : ''}
              >
                ${convertProgress[recording.notePath] ? 'Converting...' : 'Convert Template'}
              </button>
            ` : ''}
          ` : ''}
          
          <button 
            onclick="window.deleteRecording('${recording.id}')"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.retryTranscription = async function(recordingId) {
  if (!confirm('Retry transcription for this recording?')) return;
  
  // Initialize progress tracking (will be updated by backend immediately)
  retryProgress[recordingId] = { step: 0, total: 3, message: 'Initializing...' };
  renderRecordings();
  
  try {
    // The backend will send progress updates via IPC
    const result = await ipcRenderer.invoke('retry-transcription', recordingId);
    
    // Clear progress on completion
    delete retryProgress[recordingId];
    
    if (result.success) {
      // Show success message briefly before reloading
      retryProgress[recordingId] = { step: 3, total: 3, message: 'Completed!', completed: true };
      renderRecordings();
      
      setTimeout(async () => {
        delete retryProgress[recordingId];
        await loadRecordings();
      }, 1500);
    } else {
      retryProgress[recordingId] = { step: 0, total: 3, message: `Failed: ${result.error}`, error: true };
      renderRecordings();
      
      setTimeout(() => {
        delete retryProgress[recordingId];
        renderRecordings();
      }, 3000);
    }
  } catch (error) {
    console.error('Error retrying transcription:', error);
    
    // Clear progress on error
    delete retryProgress[recordingId];
    renderRecordings();
    
    alert('Failed to retry transcription');
  }
};

window.deleteRecording = async function(recordingId) {
  if (!confirm('Delete this recording? This action cannot be undone.')) return;
  
  try {
    const result = await ipcRenderer.invoke('delete-recording', recordingId);
    
    if (result.success) {
      await loadRecordings();
    } else {
      alert(`Failed to delete: ${result.error}`);
    }
  } catch (error) {
    console.error('Error deleting recording:', error);
    alert('Failed to delete recording');
  }
};

window.openNote = function(notePath) {
  const { shell } = require('electron');
  shell.showItemInFolder(notePath);
};

window.openFile = function(filePath) {
  const { shell } = require('electron');
  shell.showItemInFolder(filePath);
};

window.showConvertModal = function(notePath, currentTemplateId) {
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'convertModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="glass-card rounded-3xl p-8 max-w-md w-full mx-4">
      <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">Convert Note Template</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Select a new template to regenerate this note's summary. The transcription will remain the same.
      </p>
      
      <div class="mb-6">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">New Template</label>
        <select 
          id="newTemplateSelect"
          class="w-full px-4 py-3 bg-white/60 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
        >
          ${templates.map(t => `
            <option value="${t.id}" ${t.id === currentTemplateId ? 'disabled' : ''}>
              ${t.icon} ${t.name}${t.id === currentTemplateId ? ' (current)' : ''}
            </option>
          `).join('')}
        </select>
      </div>
      
      <div class="flex gap-3">
        <button 
          id="convertConfirmBtn"
          class="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
        >
          Convert
        </button>
        <button 
          id="convertCancelBtn"
          class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Setup event listeners
  const confirmBtn = modal.querySelector('#convertConfirmBtn');
  const cancelBtn = modal.querySelector('#convertCancelBtn');
  const select = modal.querySelector('#newTemplateSelect');
  
  confirmBtn.addEventListener('click', () => {
    const newTemplateId = select.value;
    if (newTemplateId === currentTemplateId) {
      alert('Please select a different template.');
      return;
    }
    modal.remove();
    window.convertNote(notePath, newTemplateId);
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
};

window.convertNote = async function(notePath, newTemplateId) {
  // Initialize progress tracking
  convertProgress[notePath] = { step: 0, total: 3, message: 'Starting conversion...' };
  renderRecordings();
  
  try {
    const result = await ipcRenderer.invoke('convert-note', notePath, newTemplateId);
    
    // Clear progress on completion
    delete convertProgress[notePath];
    
    if (result.success) {
      // Show success message briefly before reloading
      convertProgress[notePath] = { step: 3, total: 3, message: 'Completed!', completed: true };
      renderRecordings();
      
      setTimeout(async () => {
        delete convertProgress[notePath];
        await loadRecordings();
      }, 1500);
    } else {
      convertProgress[notePath] = { step: 0, total: 3, message: `Failed: ${result.error}`, error: true };
      renderRecordings();
      
      setTimeout(() => {
        delete convertProgress[notePath];
        renderRecordings();
      }, 3000);
    }
  } catch (error) {
    console.error('Error converting note:', error);
    
    // Clear progress on error
    delete convertProgress[notePath];
    renderRecordings();
    
    alert('Failed to convert note: ' + error.message);
  }
};

init();


