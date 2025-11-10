const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');
const { trackEvent, trackPageView } = require('../utils/renderer/analytics');
// Use unique names to avoid conflicts with other renderer scripts
const rendererThemeUtils = require('../utils/renderer/theme');
const { showNotification } = require('../utils/renderer/notifications');
const {
  openNotesFolder,
  openRecordingsPage,
  openSettingsPage,
  openMainPage,
} = require('../utils/renderer/navigation');

let noteTaker = null;
let config = null;
let isRecording = false;
let startTime = null;
let timerInterval = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let audioContext = null;
let mergedStream = null;
let analyser = null;
let animationFrameId = null;
let participants = [];

// Helper function to get DOM elements safely
function getElement(id) {
  return document.getElementById(id);
}

// Store references to elements (will be updated when DOM is ready)
let recordButton,
  stopButton,
  stopButtonContent,
  meetingTitleInput,
  meetingTemplateSelect,
  statusDot,
  statusText;
let timer, timerDisplay, statusMessage, recordingVisual, vaultPath, modelName;
let actionLabel, permissionBanner, openPermissionsButton, checkPermissionButton;
let participantInput, participantTags, themeToggle, stopButtonInner;

// Function to refresh DOM element references
function refreshDOMElements() {
  recordButton = getElement('recordButton');
  stopButton = getElement('stopButton');
  stopButtonContent = getElement('stopButtonContent');
  meetingTitleInput = getElement('meetingTitle');
  meetingTemplateSelect = getElement('meetingTemplate');
  statusDot = getElement('statusDot');
  statusText = getElement('statusText');
  timer = getElement('timer');
  timerDisplay = getElement('timerDisplay');
  statusMessage = getElement('statusMessage');
  recordingVisual = getElement('recordingVisual');
  vaultPath = getElement('vaultPath');
  modelName = getElement('modelName');
  actionLabel = getElement('actionLabel');
  permissionBanner = getElement('permissionBanner');
  openPermissionsButton = getElement('openPermissionsButton');
  checkPermissionButton = getElement('checkPermissionButton');
  participantInput = getElement('participantInput');
  participantTags = getElement('participantTags');
  themeToggle = getElement('themeToggle');
  stopButtonInner = getElement('stopButtonInner');
}

async function checkPermissions() {
  try {
    const result = await ipcRenderer.invoke(
      'check-screen-recording-permission'
    );

    if (result.granted) {
      permissionBanner.classList.add('hidden');
    } else {
      permissionBanner.classList.remove('hidden');
      const isDev = process.env.NODE_ENV !== 'production';
      let message = 'Screen Recording Permission Required\n\n';

      if (isDev) {
        message +=
          'Grant permission to Terminal/Electron, then fully quit and relaunch.';
      } else {
        message +=
          'Grant permission to Meeting Note Taker in System Settings, then quit and relaunch the app.';
      }

      alert(message);
    }
  } catch (error) {
    alert('Error checking permissions: ' + error.message);
  }
}

async function openSystemPreferences() {
  try {
    await ipcRenderer.invoke('open-system-preferences');
    setTimeout(() => {
      alert(
        'System Settings Opening...\n\nGo to Privacy & Security → Screen Recording, enable the app, then fully quit and restart.'
      );
    }, 500);
  } catch (error) {}
}

// Theme functions are now imported from utils/renderer/theme.js

async function init() {
  // Refresh DOM elements before using them
  refreshDOMElements();

  trackPageView('main', 'Main App Window');
  // Use window.Layout.loadTheme if available (from layout.js), otherwise use utility directly
  if (window.Layout?.loadTheme) {
    window.Layout.loadTheme();
  } else if (rendererThemeUtils.loadTheme) {
    rendererThemeUtils.loadTheme();
  }
  ipcRenderer.send('get-config');

  ipcRenderer.on('config-data', (event, data) => {
    config = data;
    refreshDOMElements(); // Refresh in case elements weren't ready before
    if (vaultPath) vaultPath.textContent = config.notesPath || 'Not configured';
    if (modelName)
      modelName.textContent = config.llamaModel || 'Not configured';

    if (config.notesPath) {
      noteTaker = new MeetingNoteTaker(config);
      setStatus('ready', 'Ready');
    } else {
      setStatus('warning', 'Not configured');
    }
  });

  // Listen for tray start recording command
  ipcRenderer.on('tray-start-recording', () => {
    if (!isRecording && noteTaker) {
      startRecording();
    } else if (!noteTaker) {
      // Show notification instead of alert (won't open window)
      if (Notification.permission === 'granted') {
        new Notification('Aura - Meeting Recorder', {
          body: 'Please configure notes folder in Settings first. Open the app to configure.',
          silent: false,
        });
      } else {
      }
    } else if (isRecording) {
      // Already recording
      if (Notification.permission === 'granted') {
        new Notification('Aura - Meeting Recorder', {
          body: 'Recording is already in progress',
          silent: true,
        });
      }
    }
  });

  // Listen for tray stop recording command
  ipcRenderer.on('tray-stop-recording', () => {
    if (isRecording) {
      stopRecording();
    }
  });

  // Listen for show notes not configured message
  ipcRenderer.on('show-notes-not-configured', () => {
    if (Notification.permission === 'granted') {
      new Notification('Aura - Notes Folder Not Configured', {
        body: 'Please configure your notes folder in Settings first.',
        silent: false,
      });
    } else {
    }
  });

  setTimeout(checkPermissionsOnLoad, 1000);
}

async function checkPermissionsOnLoad() {
  try {
    const result = await ipcRenderer.invoke(
      'check-screen-recording-permission'
    );
    if (!result.granted) {
      permissionBanner.classList.remove('hidden');
    }
  } catch (error) {}
}

function addParticipant(name) {
  if (!name || participants.includes(name)) return;
  participants.push(name);
  renderParticipants();
  participantInput.value = '';
  // Update participants in noteTaker if recording
  if (isRecording && noteTaker) {
    noteTaker.updateMeetingParticipants(participants);
  }
}

function removeParticipant(name) {
  participants = participants.filter((p) => p !== name);
  renderParticipants();
  // Update participants in noteTaker if recording
  if (isRecording && noteTaker) {
    noteTaker.updateMeetingParticipants(participants);
  }
}

function renderParticipants() {
  participantTags.innerHTML = participants
    .map(
      (name) => `
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200/60 dark:bg-gray-600/60 rounded-lg text-sm text-gray-700 dark:text-gray-200">
      <span>${name}</span>
      <button onclick="window.removeParticipant('${name}')" class="hover:text-red-600 dark:hover:text-red-400 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `
    )
    .join('');
}

window.removeParticipant = removeParticipant;

function updateAudioBars() {
  if (
    !analyser ||
    !recordingVisual ||
    recordingVisual.classList.contains('hidden')
  ) {
    return;
  }

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  // Get the bars
  const bars = recordingVisual.querySelectorAll('.bar');

  if (bars.length === 0) {
    animationFrameId = requestAnimationFrame(updateAudioBars);
    return;
  }

  // Calculate average volume across different frequency ranges
  const barCount = bars.length;
  const samplesPerBar = Math.floor(bufferLength / barCount);

  bars.forEach((bar, index) => {
    // Get average amplitude for this bar's frequency range
    let sum = 0;
    const startIndex = index * samplesPerBar;
    const endIndex = startIndex + samplesPerBar;

    for (let i = startIndex; i < endIndex && i < bufferLength; i++) {
      sum += dataArray[i];
    }

    const average = sum / samplesPerBar;

    // Scale the height between 12px and 40px based on amplitude
    const minHeight = 12;
    const maxHeight = 40;
    const normalizedValue = average / 255; // Normalize to 0-1
    const height = minHeight + normalizedValue * (maxHeight - minHeight);

    // Apply the height with a smooth transition
    bar.style.height = `${height}px`;
  });

  // Continue the animation loop
  animationFrameId = requestAnimationFrame(updateAudioBars);
}

function stopAudioVisualization() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function openHistory() {
  if (!config?.notesPath) {
    alert('Please configure your notes folder in settings first.');
    openSettingsPage();
    return;
  }
  openNotesFolder(config.notesPath).catch((err) => {
    alert('Failed to open notes folder');
  });
}

function openRecordings() {
  if (!config?.notesPath) {
    alert('Please configure your notes folder in settings first.');
    openSettingsPage();
    return;
  }
  openRecordingsPage();
}

let mainButtonsSetup = false;

// Setup layout buttons (header buttons created by layout.js)
function setupLayoutButtons() {
  const openSettingsButton = document.getElementById('openSettings');
  if (openSettingsButton && !openSettingsButton.dataset.listenerAttached) {
    openSettingsButton.addEventListener('click', () => {
      openSettingsPage();
    });
    openSettingsButton.dataset.listenerAttached = 'true';
  }

  const recordingsButton = document.getElementById('recordingsButton');
  if (recordingsButton && !recordingsButton.dataset.listenerAttached) {
    recordingsButton.addEventListener('click', openRecordings);
    recordingsButton.dataset.listenerAttached = 'true';
  }

  const historyButton = document.getElementById('historyButton');
  if (historyButton && !historyButton.dataset.listenerAttached) {
    historyButton.addEventListener('click', openHistory);
    historyButton.dataset.listenerAttached = 'true';
  }
}

function setupButtonListeners() {
  // Refresh DOM element references
  refreshDOMElements();

  // Main recording buttons - only set up once
  if (!mainButtonsSetup) {
    mainButtonsSetup = true;

    if (recordButton) {
      recordButton.addEventListener('click', startRecording);
    }
    if (stopButtonInner) {
      stopButtonInner.addEventListener('click', stopRecording);
    }

    // Permission buttons
    if (checkPermissionButton) {
      checkPermissionButton.addEventListener('click', checkPermissions);
    }
    if (openPermissionsButton) {
      openPermissionsButton.addEventListener('click', openSystemPreferences);
    }

    // Participant input
    if (participantInput) {
      participantInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addParticipant(participantInput.value.trim());
        }
      });
    }

    // Add event listeners for updating metadata during recording
    if (meetingTitleInput && !meetingTitleInput.dataset.listenerAttached) {
      meetingTitleInput.addEventListener('input', () => {
        if (isRecording && noteTaker) {
          const newTitle = meetingTitleInput.value.trim() || 'Meeting';
          noteTaker.updateMeetingTitle(newTitle);
        }
      });
      meetingTitleInput.dataset.listenerAttached = 'true';
    }

    if (meetingTemplateSelect && !meetingTemplateSelect.dataset.listenerAttached) {
      meetingTemplateSelect.addEventListener('change', () => {
        if (isRecording && noteTaker) {
          const newTemplateId = meetingTemplateSelect.value || 'general';
          noteTaker.updateMeetingTemplate(newTemplateId);
        }
      });
      meetingTemplateSelect.dataset.listenerAttached = 'true';
    }
  }

  // Layout buttons can be set up multiple times (when layout reloads)
  setupLayoutButtons();
}

// Setup buttons when layout is loaded
window.addEventListener('layoutLoaded', () => {
  setupButtonListeners();
});

// Also try to set up immediately with a delay
if (document.readyState !== 'loading') {
  setTimeout(setupButtonListeners, 150);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupButtonListeners, 150);
  });
}

async function startRecording() {
  try {
    if (!noteTaker) {
      alert('Please configure notes folder in Settings first');
      return;
    }

    const title = meetingTitleInput.value.trim() || 'Meeting';
    const templateId = meetingTemplateSelect
      ? meetingTemplateSelect.value
      : 'general';

    setStatus('recording', 'Recording');
    recordButton.classList.add('hidden');
    stopButton.classList.remove('hidden');
    stopButton.classList.add('flex');
    // Keep fields enabled during recording so they can be edited
    // meetingTitleInput.disabled = true;
    // if (meetingTemplateSelect) meetingTemplateSelect.disabled = true;

    await startMicrophoneRecording();
    updateAudioBars();
    await noteTaker.startMeeting(title, templateId, participants);

    isRecording = true;
    startTime = Date.now();
    startTimer();

    // Notify main process that recording started
    ipcRenderer.send('recording-started');

    // Show notification that recording has started
    if (Notification.permission === 'granted') {
      new Notification('Aura - Recording Started', {
        body: `Recording "${title}" has started`,
        silent: false,
      });
    }
  } catch (error) {
    stopAudioVisualization();

    let errorMessage = 'Failed to start recording.\n\n';

    if (
      error.name === 'NotAllowedError' ||
      error.name === 'PermissionDeniedError'
    ) {
      errorMessage += 'Microphone Permission Required\n\n';
      errorMessage +=
        'Go to System Settings → Privacy & Security → Microphone, enable this app, then restart.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'No microphone found\n\n';
      errorMessage +=
        'Check that your microphone is connected and selected in System Settings → Sound → Input';
    } else {
      errorMessage += error.message;
    }

    // Show notification instead of alert when triggered from tray
    if (Notification.permission === 'granted') {
      new Notification('Aura - Recording Failed', {
        body: errorMessage.split('\n')[0], // First line of error
        silent: false,
      });
    } else {
    }

    setStatus('ready', 'Ready');
    // Don't send recording-stopped since recording never started
    isRecording = false;
    stopAudioVisualization();
    recordButton.classList.remove('hidden');
    stopButton.classList.add('hidden');
    stopButton.classList.remove('flex');
    meetingTitleInput.disabled = false;
    if (stopButtonInner) {
      stopButtonInner.disabled = false;
    }
  }
}

async function startMicrophoneRecording() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(
      (device) => device.kind === 'audioinput'
    );

    const virtualDevices = audioInputs.filter((device) => {
      const label = device.label.toLowerCase();
      return (
        label.includes('blackhole') ||
        label.includes('soundflower') ||
        label.includes('virtual') ||
        label.includes('loopback') ||
        label.includes('aggregate') ||
        label.includes('multi-output')
      );
    });

    const headphoneDevices = audioInputs.filter((device) => {
      const label = device.label.toLowerCase();
      return (
        label.includes('headphone') ||
        label.includes('airpods') ||
        label.includes('bluetooth') ||
        label.includes('usb audio') ||
        label.includes('audio interface') ||
        label.includes('focusrite') ||
        label.includes('scarlett') ||
        label.includes('apollo') ||
        label.includes('rme') ||
        label.includes('motu')
      );
    });

    let systemAudioStream = null;
    let systemAudioSource = 'none';

    for (const virtualDevice of virtualDevices) {
      try {
        systemAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: virtualDevice.deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        systemAudioSource = virtualDevice.label;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!systemAudioStream && headphoneDevices.length > 0) {
      for (const headphoneDevice of headphoneDevices) {
        try {
          systemAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: headphoneDevice.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
            video: false,
          });
          systemAudioSource = headphoneDevice.label;
          break;
        } catch (error) {
          continue;
        }
      }
    }

    if (!systemAudioStream) {
      try {
        systemAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        systemAudioSource = 'browser-selected';
      } catch (error) {
        // No system audio available, will record mic only
      }
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    if (systemAudioStream) {
      audioContext = new AudioContext();
      const systemAudioSourceNode =
        audioContext.createMediaStreamSource(systemAudioStream);
      const micSourceNode = audioContext.createMediaStreamSource(micStream);
      const destination = audioContext.createMediaStreamDestination();

      systemAudioSourceNode.connect(destination);
      micSourceNode.connect(destination);

      mergedStream = destination.stream;
      recordingStream = {
        systemAudioStream,
        micStream,
        getTracks: () => [
          ...systemAudioStream.getTracks(),
          ...micStream.getTracks(),
        ],
      };
    } else {
      audioContext = new AudioContext();
      mergedStream = micStream;
      recordingStream = {
        micStream,
        getTracks: () => [...micStream.getTracks()],
      };
    }

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const visualizationSource =
      audioContext.createMediaStreamSource(mergedStream);
    visualizationSource.connect(analyser);

    audioChunks = [];
    mediaRecorder = new MediaRecorder(mergedStream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {};

    mediaRecorder.start(1000);
  } catch (error) {
    throw error;
  }
}

async function stopRecording() {
  try {
    if (!isRecording) return;

    // Show notification that recording is stopping
    if (Notification.permission === 'granted') {
      new Notification('Aura - Stopping Recording', {
        body: 'Processing and saving your meeting...',
        silent: true,
      });
    }

    setStatus('processing', 'Processing');
    stopAudioVisualization();
    stopTimer();

    if (stopButtonInner) {
      stopButtonInner.disabled = true;
      stopButtonInner.classList.remove('recording-pulse');
    }

    if (stopButtonContent) {
      stopButtonContent.className = '';
      stopButtonContent.innerHTML = `
        <svg class="w-14 h-14 spinner" fill="none" viewBox="0 0 24 24" style="color: #EF4444;">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
    }

    updateProgress(1, 'active', 'Saving audio...');
    const audioPath = await stopMicrophoneRecording();

    updateProgress(2, 'active', 'Transcribing audio...');

    if (noteTaker.currentAudioPath && audioPath && fs.existsSync(audioPath)) {
      const destPath = noteTaker.currentAudioPath;
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(audioPath, destPath);
    }

    // Get current metadata values before stopping
    const finalTitle = meetingTitleInput.value.trim() || 'Meeting';
    const finalTemplateId = meetingTemplateSelect
      ? meetingTemplateSelect.value
      : 'general';
    
    // Update noteTaker with final values
    if (noteTaker) {
      noteTaker.updateMeetingTitle(finalTitle);
      noteTaker.updateMeetingTemplate(finalTemplateId);
      noteTaker.updateMeetingParticipants(participants);
    }

    const result = await noteTaker.stopMeeting({
      onTranscriptionComplete: () => {
        updateProgress(3, 'active', 'Generating summary...');
      },
      onSummarizationComplete: () => {
        updateProgress(4, 'active', 'Saving to vault...');
      },
    });

    updateProgress(5, 'completed', '✓ Saved successfully!');
    setStatus('ready', 'Ready');

    if (
      result.recordingId &&
      noteTaker.currentAudioPath &&
      fs.existsSync(noteTaker.currentAudioPath)
    ) {
      try {
        await ipcRenderer.invoke('update-recording', result.recordingId, {
          audioPath: noteTaker.currentAudioPath,
        });
      } catch (error) {}
    }

    // Show notification that recording stopped and notes were saved
    setTimeout(() => {
      const notification = new Notification('Aura - Recording Stopped', {
        body: 'Meeting notes have been saved successfully!',
        silent: false,
      });

      notification.onclick = () => {
        shell.showItemInFolder(result.notePath);
      };
    }, 500);

    setTimeout(() => {
      resetUI();
    }, 2000);
  } catch (error) {
    let errorMsg = error.message;
    if (errorMsg.includes('Transcription failed')) {
      updateProgress(0, 'error', 'Transcription failed');
    } else if (errorMsg.includes('no content')) {
      updateProgress(0, 'error', 'No audio content captured');
    } else {
      updateProgress(0, 'error', errorMsg.substring(0, 50));
    }

    // Show notification that recording stopped with error
    if (Notification.permission === 'granted') {
      new Notification('Aura - Recording Stopped', {
        body: `Recording stopped. ${errorMsg.split('\n')[0]}`,
        silent: false,
      });
    }

    setStatus('ready', 'Ready');
    // resetUI will be called which sends recording-stopped, but ensure state is reset
    setTimeout(resetUI, 5000);
  }
}

async function stopMicrophoneRecording() {
  return new Promise((resolve, reject) => {
    try {
      if (!mediaRecorder) {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

          if (audioBlob.size === 0) {
          }

          const tempDir = path.join(os.tmpdir(), 'meeting-note-taker');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }

          const timestamp = Date.now();
          const audioPath = path.join(tempDir, `recording-${timestamp}.webm`);

          const buffer = Buffer.from(await audioBlob.arrayBuffer());
          fs.writeFileSync(audioPath, buffer);

          if (recordingStream) {
            recordingStream.getTracks().forEach((track) => track.stop());
          }

          if (audioContext) {
            await audioContext.close();
            audioContext = null;
          }

          mediaRecorder = null;
          audioChunks = [];
          recordingStream = null;
          mergedStream = null;
          analyser = null;

          resolve(audioPath);
        } catch (error) {
          reject(error);
        }
      };

      mediaRecorder.stop();
    } catch (error) {
      reject(error);
    }
  });
}

function startTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function setStatus(type, text) {
  if (statusText) statusText.textContent = text;

  // Update status dot color if it exists
  if (statusDot) {
    statusDot.className = 'w-2 h-2 rounded-full';
    if (type === 'ready') {
      statusDot.classList.add('bg-green-500');
    } else if (type === 'recording') {
      statusDot.classList.add('bg-red-500', 'recording-pulse');
    } else if (type === 'processing') {
      statusDot.classList.add('bg-yellow-500');
    } else if (type === 'warning') {
      statusDot.classList.add('bg-yellow-500');
    }
  }
}

function updateProgress(step, state, message) {
  // Show the message in the timer area with animation
  if (timerDisplay && statusMessage && timer) {
    // Make sure timer container is visible
    timer.classList.remove('hidden');

    // If this is the first message, hide timer and show status message
    if (timerDisplay.classList.contains('hidden') === false) {
      // First time: hide timer, show message
      timerDisplay.classList.add('hidden');
      statusMessage.classList.remove('hidden');
      statusMessage.textContent = message;
      statusMessage.classList.add('fade-in');

      // Add special color for success
      if (message.includes('✓') || state === 'completed') {
        statusMessage.style.color = '#10b981'; // green
      } else if (message.includes('❌') || state === 'error') {
        statusMessage.style.color = '#ef4444'; // red
      } else {
        // Check if dark mode is active
        const isDark = document.documentElement.classList.contains('dark');
        statusMessage.style.color = isDark ? '#d1d5db' : '#374151'; // gray-300 in dark, gray-700 in light
      }
    } else {
      // Subsequent messages: animate transition
      // Fade out current message
      statusMessage.classList.remove('fade-in', 'success-pulse', 'error-shake');
      statusMessage.classList.add('fade-out');

      // After fade out, change text and fade in
      setTimeout(() => {
        statusMessage.textContent = message;
        statusMessage.classList.remove('fade-out');
        statusMessage.classList.add('fade-in');

        // Add special animations and colors for success/error
        if (message.includes('✓') || state === 'completed') {
          statusMessage.style.color = '#10b981'; // green (same in both modes)
          statusMessage.classList.add('success-pulse');
        } else if (message.includes('❌') || state === 'error') {
          statusMessage.style.color = '#ef4444'; // red (same in both modes)
          statusMessage.classList.add('error-shake');
        } else {
          // Check if dark mode is active
          const isDark = document.documentElement.classList.contains('dark');
          statusMessage.style.color = isDark ? '#d1d5db' : '#374151'; // gray-300 in dark, gray-700 in light
        }
      }, 300); // Match fade-out duration
    }
  }
}

function resetUI() {
  const wasRecording = isRecording;
  isRecording = false;

  // Notify main process that recording stopped
  if (wasRecording) {
    ipcRenderer.send('recording-stopped');
  }
  stopAudioVisualization();
  recordButton.classList.remove('hidden');
  stopButton.classList.add('hidden');
  stopButton.classList.remove('flex');

  if (stopButtonInner) {
    stopButtonInner.classList.add('recording-pulse');
    stopButtonInner.disabled = false;
  }

  timerDisplay.textContent = '00:00';
  timerDisplay.classList.remove('hidden');
  statusMessage.classList.add('hidden');
  statusMessage.classList.remove(
    'fade-in',
    'fade-out',
    'success-pulse',
    'error-shake'
  );
  statusMessage.style.color = '';
  statusMessage.textContent = '';
  meetingTitleInput.disabled = false;
  if (meetingTemplateSelect) meetingTemplateSelect.disabled = false;

  // Reset stop button content to square
  if (stopButtonContent) {
    stopButtonContent.innerHTML = '';
    stopButtonContent.className = 'w-8 h-8 bg-primary rounded-lg';
  }

  // Reset audio bars to initial state
  if (recordingVisual) {
    const bars = recordingVisual.querySelectorAll('.bar');
    bars.forEach((bar) => {
      bar.style.height = '12px';
    });
  }
}

if (Notification.permission === 'default') {
  Notification.requestPermission();
}

init();
