const { ipcRenderer } = require('electron');

// State
let recordings = [];

// DOM Elements
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const recordingsList = document.getElementById('recordingsList');
const startRecordingButton = document.getElementById('startRecordingButton');

function loadTheme() {
  if (window.Layout?.loadTheme) {
    window.Layout.loadTheme();
  } else {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

function setupButtonListeners() {
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = 'index.html';
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
      window.location.href = 'index.html';
    });
  }
}

async function init() {
  loadTheme();
  window.addEventListener('layoutLoaded', setupButtonListeners);
  
  if (document.readyState !== 'loading') {
    setTimeout(setupButtonListeners, 100);
  }
  
  await loadRecordings();
}

async function loadRecordings() {
  try {
    showLoading();
    
    const result = await ipcRenderer.invoke('get-all-recordings');
    
    if (result.success && result.recordings) {
      recordings = result.recordings;
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
        
        <div class="flex items-center gap-3">
          ${recording.status === 'failed' ? `
            <button 
              onclick="window.retryTranscription('${recording.id}')"
              class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
            >
              Retry Transcription
            </button>
          ` : ''}
          
          ${recording.notePath ? `
            <button 
              onclick="window.openNotex('${recording.notePath.replace(/'/g, "\\'")}')"
              class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
            >
              Open Note
            </button>
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
  
  try {
    const result = await ipcRenderer.invoke('retry-transcription', recordingId);
    
    if (result.success) {
      alert('Transcription completed successfully!');
      await loadRecordings();
    } else {
      alert(`Failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error retrying transcription:', error);
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

init();


