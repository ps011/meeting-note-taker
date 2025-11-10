const { ipcRenderer } = require('electron');
const fs = require('fs');
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
    retryProgress[progress.recordingId] = progress;
    renderRecordings();
  });

  // Listen for convert progress updates
  ipcRenderer.on('convert-progress', (event, progress) => {
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
  } catch (error) {}
}

async function loadRecordings() {
  try {
    showLoading();

    const result = await ipcRenderer.invoke('get-all-recordings');

    if (result.success && result.recordings) {
      recordings = result.recordings;
      // Clear progress for recordings that are no longer in processing state
      recordings.forEach((recording) => {
        if (recording.status !== 'processing' && retryProgress[recording.id]) {
          delete retryProgress[recording.id];
        }
      });
      renderRecordings();
    } else {
      showError(result.error || 'Failed to load recordings');
    }
  } catch (error) {
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

/**
 * Parse frontmatter from a note file and extract meeting_type (template ID)
 * @param {string} notePath - Path to the note file
 * @returns {string|null} - The template ID or null if not found
 */
function getMeetingTypeFromNote(notePath) {
  try {
    if (!notePath || !fs.existsSync(notePath)) {
      return null;
    }

    const content = fs.readFileSync(notePath, 'utf-8');

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!frontmatterMatch) {
      return null;
    }

    const frontmatterText = frontmatterMatch[1];
    const lines = frontmatterText.split('\n');

    for (const line of lines) {
      // Try meeting_type first (new format), then template_id (backward compatibility)
      const meetingTypeMatch = line.match(/^meeting_type:\s*(.+)$/);
      if (meetingTypeMatch) {
        return meetingTypeMatch[1].trim();
      }
      const templateIdMatch = line.match(/^template_id:\s*(.+)$/);
      if (templateIdMatch) {
        return templateIdMatch[1].trim();
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get template name from template ID
 * @param {string} templateId - The template ID
 * @returns {string|null} - The template name or null if not found
 */
function getTemplateName(templateId) {
  if (!templateId) return null;
  const template = templates.find((t) => t.id === templateId);
  return template ? template.name : null;
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

  recordingsList.innerHTML = recordings
    .map((recording) => {
      const date = new Date(recording.timestamp);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();

      // Get meeting type (template ID) from note file if available
      const meetingTypeId = recording.notePath
        ? getMeetingTypeFromNote(recording.notePath)
        : recording.templateId || null;
      
      // Get template name for display
      const meetingTypeName = meetingTypeId ? getTemplateName(meetingTypeId) : null;

      const statusColor =
        {
          pending:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
          processing:
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          completed:
            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          failed:
            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        }[recording.status] || 'bg-gray-100 text-gray-800';

      const statusText =
        recording.status.charAt(0).toUpperCase() + recording.status.slice(1);

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
            ${
              meetingTypeName
                ? `<p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    <span class="inline-flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      ${meetingTypeName}
                    </span>
                  </p>`
                : ''
            }
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium ${statusColor}">
            ${statusText}
          </span>
        </div>
        
        ${
          recording.error
            ? `
          <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p class="text-sm text-red-800 dark:text-red-300">${recording.error}</p>
          </div>
        `
            : ''
        }
        
        <div class="mb-4 space-y-2">
          ${
            recording.audioPath
              ? `
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
          `
              : ''
          }
          ${
            recording.notePath
              ? `
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
          `
              : ''
          }
        </div>
        
        ${
          retryProgress[recording.id]
            ? `
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
            ${
              retryProgress[recording.id].step !== undefined &&
              retryProgress[recording.id].total
                ? `
              <div class="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div 
                  class="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style="width: ${Math.max(0, (retryProgress[recording.id].step / retryProgress[recording.id].total) * 100)}%"
                ></div>
              </div>
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Step ${retryProgress[recording.id].step} of ${retryProgress[recording.id].total}
              </p>
            `
                : ''
            }
          </div>
        `
            : ''
        }
        ${
          recording.notePath && convertProgress[recording.notePath]
            ? `
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
            ${
              convertProgress[recording.notePath].step !== undefined &&
              convertProgress[recording.notePath].total
                ? `
              <div class="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                <div 
                  class="bg-purple-600 dark:bg-purple-400 h-2 rounded-full transition-all duration-300"
                  style="width: ${Math.max(0, (convertProgress[recording.notePath].step / convertProgress[recording.notePath].total) * 100)}%"
                ></div>
              </div>
              <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Step ${convertProgress[recording.notePath].step} of ${convertProgress[recording.notePath].total}
              </p>
            `
                : ''
            }
          </div>
        `
            : ''
        }
        
        <div class="flex items-center gap-2">
          ${
            recording.status === 'failed' || recording.status === 'processing'
              ? `
            <button 
              id="retry-btn-${recording.id}"
              onclick="window.retryTranscription('${recording.id}')"
              class="btn-icon disabled:opacity-50 disabled:cursor-not-allowed"
              ${retryProgress[recording.id] ? 'disabled' : ''}
              title="Retry Transcription"
            >
              ${
                retryProgress[recording.id]
                  ? '<svg class="w-5 h-5 text-gray-700 dark:text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'
                  : '<svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'
              }
            </button>
          `
              : ''
          }
          
          ${
            recording.notePath
              ? `
            <button 
              onclick="window.openNote('${recording.notePath.replace(/'/g, "\\'")}')"
              class="btn-green"
            >
              Open Note
            </button>
            ${
              recording.status === 'completed'
                ? `
              <button 
                onclick="window.showConvertModal('${recording.notePath.replace(/'/g, "\\'")}', '${recording.templateId || 'general'}')"
                class="btn-icon disabled:opacity-50 disabled:cursor-not-allowed"
                ${convertProgress[recording.notePath] ? 'disabled' : ''}
                title="Convert Template"
              >
                ${
                  convertProgress[recording.notePath]
                    ? '<svg class="w-5 h-5 text-gray-700 dark:text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'
                    : '<svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>'
                }
              </button>
            `
                : ''
            }
          `
              : ''
          }
          
          <button 
            onclick="window.deleteRecording('${recording.id}')"
            class="btn-icon"
            title="Delete Recording"
          >
            <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    })
    .join('');
}

window.retryTranscription = async function (recordingId) {
  if (!confirm('Retry transcription for this recording?')) return;

  // Initialize progress tracking (will be updated by backend immediately)
  retryProgress[recordingId] = {
    step: 0,
    total: 3,
    message: 'Initializing...',
  };
  renderRecordings();

  try {
    // The backend will send progress updates via IPC
    const result = await ipcRenderer.invoke('retry-transcription', recordingId);

    // Clear progress on completion
    delete retryProgress[recordingId];

    if (result.success) {
      // Show success message briefly before reloading
      retryProgress[recordingId] = {
        step: 3,
        total: 3,
        message: 'Completed!',
        completed: true,
      };
      renderRecordings();

      setTimeout(async () => {
        delete retryProgress[recordingId];
        await loadRecordings();
      }, 1500);
    } else {
      retryProgress[recordingId] = {
        step: 0,
        total: 3,
        message: `Failed: ${result.error}`,
        error: true,
      };
      renderRecordings();

      setTimeout(() => {
        delete retryProgress[recordingId];
        renderRecordings();
      }, 3000);
    }
  } catch (error) {
    // Clear progress on error
    delete retryProgress[recordingId];
    renderRecordings();

    alert('Failed to retry transcription');
  }
};

window.deleteRecording = async function (recordingId) {
  if (!confirm('Delete this recording? This action cannot be undone.')) return;

  try {
    const result = await ipcRenderer.invoke('delete-recording', recordingId);

    if (result.success) {
      await loadRecordings();
    } else {
      alert(`Failed to delete: ${result.error}`);
    }
  } catch (error) {
    alert('Failed to delete recording');
  }
};

window.openNote = function (notePath) {
  const { shell } = require('electron');
  shell.showItemInFolder(notePath);
};

window.openFile = function (filePath) {
  const { shell } = require('electron');
  shell.showItemInFolder(filePath);
};

window.showConvertModal = function (notePath, currentTemplateId) {
  // Get meeting type (template ID) from note file, fallback to currentTemplateId parameter
  const currentMeetingTypeId = getMeetingTypeFromNote(notePath) || currentTemplateId || 'general';
  const currentMeetingTypeName = getTemplateName(currentMeetingTypeId);
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'convertModal';
  modal.className =
    'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
  modal.style.zIndex = 'var(--z-modal)';
  modal.innerHTML = `
    <div class="glass-card rounded-3xl p-8 max-w-md w-full mx-4">
      <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">Convert Note Template</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Select a new template to regenerate this note's summary. The transcription will remain the same.
      </p>
      
      ${
        currentMeetingTypeName
          ? `
      <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Meeting Type</p>
        <p class="text-sm font-medium text-gray-800 dark:text-white">${currentMeetingTypeName}</p>
      </div>
      `
          : ''
      }
      
      <div class="mb-6">
        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">New Template</label>
        <select 
          id="newTemplateSelect"
          class="select-theme"
        >
          ${templates
            .map(
              (t) => `
            <option value="${t.id}" ${t.id === currentMeetingTypeId ? 'disabled' : ''}>
              ${t.icon} ${t.name}${t.id === currentMeetingTypeId ? ' (current)' : ''}
            </option>
          `
            )
            .join('')}
        </select>
      </div>
      
      <div class="flex gap-3">
        <button 
          id="convertConfirmBtn"
          class="btn-action flex-1"
        >
          Convert
        </button>
        <button 
          id="convertCancelBtn"
          class="btn-secondary flex-1"
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
    if (newTemplateId === currentMeetingTypeId) {
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

window.convertNote = async function (notePath, newTemplateId) {
  // Initialize progress tracking
  convertProgress[notePath] = {
    step: 0,
    total: 3,
    message: 'Starting conversion...',
  };
  renderRecordings();

  try {
    const result = await ipcRenderer.invoke(
      'convert-note',
      notePath,
      newTemplateId
    );

    // Clear progress on completion
    delete convertProgress[notePath];

    if (result.success) {
      // Show success message briefly before reloading
      convertProgress[notePath] = {
        step: 3,
        total: 3,
        message: 'Completed!',
        completed: true,
      };
      renderRecordings();

      setTimeout(async () => {
        delete convertProgress[notePath];
        await loadRecordings();
      }, 1500);
    } else {
      convertProgress[notePath] = {
        step: 0,
        total: 3,
        message: `Failed: ${result.error}`,
        error: true,
      };
      renderRecordings();

      setTimeout(() => {
        delete convertProgress[notePath];
        renderRecordings();
      }, 3000);
    }
  } catch (error) {
    // Clear progress on error
    delete convertProgress[notePath];
    renderRecordings();

    alert('Failed to convert note: ' + error.message);
  }
};

init();
