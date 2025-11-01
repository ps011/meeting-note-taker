const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { MeetingNoteTaker } = require('../../src/meetingNoteTaker.js');

function trackEvent(eventName, parameters = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, parameters);
  }
  ipcRenderer.send('analytics-track-event', eventName, parameters);
}

function trackPageView(pageName, pageTitle) {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'page_view', {
      page_title: pageTitle,
      page_location: `app://${pageName}`,
      page_path: `/${pageName}`
    });
  }
  ipcRenderer.send('analytics-track-page-view', pageName, pageTitle);
}

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
const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const stopButtonContent = document.getElementById('stopButtonContent');
const meetingTitleInput = document.getElementById('meetingTitle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const timer = document.getElementById('timer');
const timerDisplay = document.getElementById('timerDisplay');
const statusMessage = document.getElementById('statusMessage');
const recordingVisual = document.getElementById('recordingVisual');
const vaultPath = document.getElementById('vaultPath');
const modelName = document.getElementById('modelName');
const openSettingsButton = document.getElementById('openSettings');
const actionLabel = document.getElementById('actionLabel');
const permissionBanner = document.getElementById('permissionBanner');
const openPermissionsButton = document.getElementById('openPermissionsButton');
const checkPermissionButton = document.getElementById('checkPermissionButton');

const participantInput = document.getElementById('participantInput');
const participantTags = document.getElementById('participantTags');
const themeToggle = document.getElementById('themeToggle');
const stopButtonInner = document.getElementById('stopButtonInner');

async function checkPermissions() {
  try {
    const result = await ipcRenderer.invoke('check-screen-recording-permission');
    
    if (result.granted) {
      permissionBanner.classList.add('hidden');
    } else {
      permissionBanner.classList.remove('hidden');
      const isDev = process.env.NODE_ENV !== 'production';
      let message = 'Screen Recording Permission Required\n\n';
      
      if (isDev) {
        message += 'Grant permission to Terminal/Electron, then fully quit and relaunch.';
      } else {
        message += 'Grant permission to Meeting Note Taker in System Settings, then quit and relaunch the app.';
      }
      
      alert(message);
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    alert('Error checking permissions: ' + error.message);
  }
}

async function openSystemPreferences() {
  try {
    await ipcRenderer.invoke('open-system-preferences');
    setTimeout(() => {
      alert('System Settings Opening...\n\nGo to Privacy & Security → Screen Recording, enable the app, then fully quit and restart.');
    }, 500);
  } catch (error) {
    console.error('Error opening System Settings:', error);
  }
}

function loadTheme() {
  if (window.Layout?.loadTheme) {
    window.Layout.loadTheme();
  } else {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

function toggleTheme() {
  if (window.Layout?.toggleTheme) {
    window.Layout.toggleTheme();
  } else {
    const isDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', !isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
  }
}

async function init() {
  trackPageView('main', 'Main App Window');
  loadTheme();
  ipcRenderer.send('get-config');
  
  ipcRenderer.on('config-data', (event, data) => {
    config = data;
    if (vaultPath) vaultPath.textContent = config.notesPath || 'Not configured';
    if (modelName) modelName.textContent = config.llamaModel || 'Not configured';
    
    if (config.notesPath) {
      noteTaker = new MeetingNoteTaker(config);
      setStatus('ready', 'Ready');
    } else {
      setStatus('warning', 'Not configured');
    }
  });
  
  setTimeout(checkPermissionsOnLoad, 1000);
}

async function checkPermissionsOnLoad() {
  try {
    const result = await ipcRenderer.invoke('check-screen-recording-permission');
    if (!result.granted) {
      permissionBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
  }
}

function addParticipant(name) {
  if (!name || participants.includes(name)) return;
  participants.push(name);
  renderParticipants();
  participantInput.value = '';
}

function removeParticipant(name) {
  participants = participants.filter(p => p !== name);
  renderParticipants();
}

function renderParticipants() {
  participantTags.innerHTML = participants.map(name => `
    <div class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200/60 dark:bg-gray-600/60 rounded-lg text-sm text-gray-700 dark:text-gray-200">
      <span>${name}</span>
      <button onclick="window.removeParticipant('${name}')" class="hover:text-red-600 dark:hover:text-red-400 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
}

window.removeParticipant = removeParticipant;

function updateAudioBars() {
  if (!analyser || !recordingVisual || recordingVisual.classList.contains('hidden')) {
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
    const height = minHeight + (normalizedValue * (maxHeight - minHeight));
    
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
    window.location.href = 'setup.html';
    return;
  }
  shell.openPath(config.notesPath);
}

function openRecordings() {
  if (!config?.notesPath) {
    alert('Please configure your notes folder in settings first.');
    window.location.href = 'setup.html';
    return;
  }
  window.location.href = 'history.html';
}

recordButton.addEventListener('click', startRecording);
if (stopButtonInner) stopButtonInner.addEventListener('click', stopRecording);
if (checkPermissionButton) checkPermissionButton.addEventListener('click', checkPermissions);
if (openPermissionsButton) openPermissionsButton.addEventListener('click', openSystemPreferences);

function setupLayoutButtonListeners() {
  const openSettingsButton = document.getElementById('openSettings');
  if (openSettingsButton) {
    openSettingsButton.addEventListener('click', () => {
      window.location.href = 'setup.html';
    });
  }
  
  const recordingsButton = document.getElementById('recordingsButton');
  if (recordingsButton) {
    recordingsButton.addEventListener('click', openRecordings);
  }
  
  const historyButton = document.getElementById('historyButton');
  if (historyButton) {
    historyButton.addEventListener('click', openHistory);
  }
}

window.addEventListener('layoutLoaded', setupLayoutButtonListeners);
if (document.readyState !== 'loading') {
  setTimeout(setupLayoutButtonListeners, 100);
}

if (participantInput) {
  participantInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addParticipant(participantInput.value.trim());
    }
  });
}

async function startRecording() {
  try {
    if (!noteTaker) {
      alert('Please configure notes folder in Settings first');
      return;
    }
    
    const title = meetingTitleInput.value.trim() || 'Meeting';
    
    setStatus('recording', 'Recording');
    recordButton.classList.add('hidden');
    stopButton.classList.remove('hidden');
    stopButton.classList.add('flex');
    meetingTitleInput.disabled = true;
    
    await startMicrophoneRecording();
    updateAudioBars();
    await noteTaker.startMeeting(title);
    
    isRecording = true;
    startTime = Date.now();
    startTimer();
  } catch (error) {
    console.error('Recording error:', error);
    stopAudioVisualization();
    
    let errorMessage = 'Failed to start recording.\n\n';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage += 'Microphone Permission Required\n\n';
      errorMessage += 'Go to System Settings → Privacy & Security → Microphone, enable this app, then restart.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'No microphone found\n\n';
      errorMessage += 'Check that your microphone is connected and selected in System Settings → Sound → Input';
    } else {
      errorMessage += error.message;
    }
    
    alert(errorMessage);
    setStatus('ready', 'Ready');
    resetUI();
  }
}

async function startMicrophoneRecording() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    const virtualDevices = audioInputs.filter(device => {
      const label = device.label.toLowerCase();
      return label.includes('blackhole') || label.includes('soundflower') || 
             label.includes('virtual') || label.includes('loopback') ||
             label.includes('aggregate') || label.includes('multi-output');
    });
    
    const headphoneDevices = audioInputs.filter(device => {
      const label = device.label.toLowerCase();
      return label.includes('headphone') || label.includes('airpods') ||
             label.includes('bluetooth') || label.includes('usb audio') ||
             label.includes('audio interface') || label.includes('focusrite') ||
             label.includes('scarlett') || label.includes('apollo') ||
             label.includes('rme') || label.includes('motu');
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
            autoGainControl: false
          },
          video: false
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
              autoGainControl: false
            },
            video: false
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
            autoGainControl: false
          },
          video: false
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
        autoGainControl: true
      },
      video: false
    });
    
    if (systemAudioStream) {
      audioContext = new AudioContext();
      const systemAudioSourceNode = audioContext.createMediaStreamSource(systemAudioStream);
      const micSourceNode = audioContext.createMediaStreamSource(micStream);
      const destination = audioContext.createMediaStreamDestination();
      
      systemAudioSourceNode.connect(destination);
      micSourceNode.connect(destination);
      
      mergedStream = destination.stream;
      recordingStream = {
        systemAudioStream,
        micStream,
        getTracks: () => [...systemAudioStream.getTracks(), ...micStream.getTracks()]
      };
    } else {
      audioContext = new AudioContext();
      mergedStream = micStream;
      recordingStream = {
        micStream,
        getTracks: () => [...micStream.getTracks()]
      };
    }
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    const visualizationSource = audioContext.createMediaStreamSource(mergedStream);
    visualizationSource.connect(analyser);
    
    audioChunks = [];
    mediaRecorder = new MediaRecorder(mergedStream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
    };
    
    mediaRecorder.start(1000);
  } catch (error) {
    console.error('Failed to start audio recording:', error);
    throw error;
  }
}

async function stopRecording() {
  try {
    if (!isRecording) return;
    
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
    
    const result = await noteTaker.stopMeeting({
      onTranscriptionComplete: () => {
        updateProgress(3, 'active', 'Generating summary...');
      },
      onSummarizationComplete: () => {
        updateProgress(4, 'active', 'Saving to vault...');
      }
    });
    
    updateProgress(5, 'completed', '✓ Saved successfully!');
    setStatus('ready', 'Ready');
    
    if (result.recordingId && noteTaker.currentAudioPath && fs.existsSync(noteTaker.currentAudioPath)) {
      try {
        await ipcRenderer.invoke('update-recording', result.recordingId, { audioPath: noteTaker.currentAudioPath });
      } catch (error) {
        console.warn('Failed to update recording history:', error);
      }
    }
    
    setTimeout(() => {
      const notification = new Notification('Aura - Meeting Recorder', {
        body: 'Meeting notes have been saved successfully!',
        silent: false
      });
      
      notification.onclick = () => {
        shell.showItemInFolder(result.notePath);
      };
    }, 500);
    
    setTimeout(() => {
      resetUI();
    }, 2000);
    
  } catch (error) {
    console.error('Stop recording error:', error);
    
    let errorMsg = error.message;
    if (errorMsg.includes('Transcription failed')) {
      updateProgress(0, 'error', 'Transcription failed');
    } else if (errorMsg.includes('no content')) {
      updateProgress(0, 'error', 'No audio content captured');
    } else {
      updateProgress(0, 'error', errorMsg.substring(0, 50));
    }
    
    setStatus('ready', 'Ready');
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
            console.warn('Audio blob is empty - no audio data was captured');
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
            recordingStream.getTracks().forEach(track => track.stop());
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
          console.error('Failed to save recording:', error);
          reject(error);
        }
      };
      
      mediaRecorder.stop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
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
  isRecording = false;
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
  statusMessage.classList.remove('fade-in', 'fade-out', 'success-pulse', 'error-shake');
  statusMessage.style.color = '';
  statusMessage.textContent = '';
  meetingTitleInput.disabled = false;
  
  // Reset stop button content to square
  if (stopButtonContent) {
    stopButtonContent.innerHTML = '';
    stopButtonContent.className = 'w-8 h-8 bg-primary rounded-lg';
  }
  
  // Reset audio bars to initial state
  if (recordingVisual) {
    const bars = recordingVisual.querySelectorAll('.bar');
    bars.forEach(bar => {
      bar.style.height = '12px';
    });
  }
}

if (Notification.permission === 'default') {
  Notification.requestPermission();
}

init();

