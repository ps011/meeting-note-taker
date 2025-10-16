const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Note: desktopCapturer is accessed via IPC from main process in Electron 28+

// Import backend modules
const { MeetingNoteTaker } = require('../src/meetingNoteTaker.js');

// State
let noteTaker = null;
let config = null;
let isRecording = false;
let startTime = null;
let timerInterval = null;

// Audio recording state
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let audioContext = null;
let mergedStream = null;
let analyser = null;
let animationFrameId = null;

// DOM Elements
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

// New UI elements
const historyButton = document.getElementById('historyButton');
const participantInput = document.getElementById('participantInput');
const participantTags = document.getElementById('participantTags');
const themeToggle = document.getElementById('themeToggle');
const stopButtonInner = document.getElementById('stopButtonInner');

// Participants state
let participants = [];

// Permission Management
async function checkPermissions() {
  try {
    console.log('🔍 Checking screen recording permission...');
    const result = await ipcRenderer.invoke('check-screen-recording-permission');
    
    console.log('Permission check result:', result);
    
    if (result.granted) {
      permissionBanner.classList.add('hidden');
      alert(`✅ Screen Recording Permission Granted!\n\nFound ${result.sourceCount} screen source(s).\n\nYou can now start recording meetings.`);
    } else {
      permissionBanner.classList.remove('hidden');
      
      const isDev = process.env.NODE_ENV !== 'production';
      let message = '❌ Screen Recording Permission NOT Granted\n\n';
      
      message += `Status: ${result.status}\n`;
      message += `Screen sources found: ${result.sourceCount || 0}\n\n`;
      
      if (isDev) {
        message += 'Running in DEVELOPMENT mode.\n\n';
        message += 'Grant permission to:\n';
        message += '• Terminal (or iTerm2/your terminal app)\n';
        message += '  OR\n';
        message += '• Electron\n\n';
        message += 'Important: After granting permission, you MUST:\n';
        message += '1. Fully quit Terminal (Cmd+Q)\n';
        message += '2. Relaunch Terminal\n';
        message += '3. Run npm start again\n';
      } else {
        message += 'Grant permission to:\n';
        message += '• Meeting Note Taker\n\n';
        message += 'Important: After granting permission, you MUST:\n';
        message += '1. Fully quit this app (Cmd+Q)\n';
        message += '2. Relaunch the app\n';
      }
      
      message += '\nClick "Open System Settings" below to grant permission.';
      
      if (result.error) {
        message += '\n\nError details: ' + result.error;
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
    
    // Show helpful message
    setTimeout(() => {
      alert('📱 System Settings Opening...\n\n' +
            '1. Go to Privacy & Security → Screen Recording\n' +
            '2. Enable the app in the list\n' +
            '3. Come back and click "Check Permissions" again\n' +
            '4. Fully quit and restart this app\n\n' +
            'Note: You may need to manually navigate to Screen Recording.');
    }, 500);
  } catch (error) {
    console.error('Error opening System Settings:', error);
  }
}

// Theme Management
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

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

// Initialize
async function init() {
  // Load theme first
  loadTheme();
  
  // Get configuration
  ipcRenderer.send('get-config');
  
  ipcRenderer.on('config-data', (event, data) => {
    config = data;
    if (vaultPath) vaultPath.textContent = config.obsidianVaultPath || 'Not configured';
    if (modelName) modelName.textContent = config.llamaModel || 'Not configured';
    
    // Initialize MeetingNoteTaker
    if (config.obsidianVaultPath) {
      noteTaker = new MeetingNoteTaker(config);
      setStatus('ready', 'Ready');
    } else {
      setStatus('warning', 'Not configured');
    }
  });
  
  // Check permissions on load
  setTimeout(checkPermissionsOnLoad, 1000);
}

// Check permissions silently on load
async function checkPermissionsOnLoad() {
  try {
    const result = await ipcRenderer.invoke('check-screen-recording-permission');
    if (!result.granted) {
      permissionBanner.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error checking permissions on load:', error);
  }
}

// Participant Management
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

// Make removeParticipant available globally for onclick
window.removeParticipant = removeParticipant;

// Audio Visualization
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

// History Handler  
function openHistory() {
  if (!config || !config.obsidianVaultPath) {
    alert('Please configure your Obsidian vault in settings first.');
    window.location.href = 'setup.html';
    return;
  }
  
  // Open the vault folder
  shell.openPath(config.obsidianVaultPath);
}

// Event Listeners
recordButton.addEventListener('click', startRecording);
if (stopButtonInner) stopButtonInner.addEventListener('click', stopRecording);
if (openSettingsButton) {
  openSettingsButton.addEventListener('click', () => {
    window.location.href = 'setup.html';
  });
}
if (checkPermissionButton) checkPermissionButton.addEventListener('click', checkPermissions);
if (openPermissionsButton) openPermissionsButton.addEventListener('click', openSystemPreferences);

// New UI event listeners
if (historyButton) historyButton.addEventListener('click', openHistory);
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

// Participant input handling
if (participantInput) {
  participantInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addParticipant(participantInput.value.trim());
    }
  });
}

// Start Recording
async function startRecording() {
  try {
    if (!noteTaker) {
      alert('Please configure Obsidian vault in Settings first');
      return;
    }
    
    const title = meetingTitleInput.value.trim() || 'Meeting';
    
    setStatus('recording', 'Recording');
    
    // UI Updates - show compact recording state
    recordButton.classList.add('hidden');
    stopButton.classList.remove('hidden');
    stopButton.classList.add('flex'); // Show the flex container
    meetingTitleInput.disabled = true;
    
    // Start recording with microphone
    await startMicrophoneRecording();
    
    // Start audio visualization
    updateAudioBars();
    
    // Initialize meeting in backend (creates temp file path)
    await noteTaker.startMeeting(title);
    
    isRecording = true;
    startTime = Date.now();
    startTimer();
    
  } catch (error) {
    console.error('Recording error:', error);
    
    // Stop visualization if it was started
    stopAudioVisualization();
    
    let errorMessage = 'Failed to start recording.\n\n';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage += '⚠️ Microphone Permission Required\n\n';
      errorMessage += 'Steps:\n';
      errorMessage += '1. Open System Settings\n';
      errorMessage += '2. Go to Privacy & Security → Microphone\n';
      errorMessage += '3. Enable this app\n';
      errorMessage += '4. Restart this app\n\n';
      errorMessage += '📝 Note: Check the console for system audio setup info.\n';
      errorMessage += 'The app will work with microphone only if no virtual audio device is installed.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += '⚠️ No microphone found\n\n';
      errorMessage += 'Please check:\n';
      errorMessage += '• Microphone is connected\n';
      errorMessage += '• Microphone is selected in System Settings → Sound → Input\n';
    } else {
      errorMessage += '⚠️ Error:\n\n';
      errorMessage += error.message;
      errorMessage += '\n\nCheck the console for more details.';
    }
    
    alert(errorMessage);
    setStatus('ready', 'Ready');
    resetUI();
  }
}

// Start microphone recording with system audio (Enhanced approach for headphones)
async function startMicrophoneRecording() {
  try {
    console.log('🎙️ Starting audio recording (microphone + system audio)...');
    console.log('📚 Using enhanced audio capture with headphone support\n');
    
    // Step 1: Enumerate all audio input devices
    console.log('🔍 Enumerating audio devices...');
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    console.log(`📊 Found ${audioInputs.length} audio input devices:`);
    audioInputs.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device.label || 'Unknown device'} (${device.deviceId.substring(0, 20)}...)`);
    });
    
    // Step 2: Detect virtual audio devices and audio interfaces
    const virtualDevices = audioInputs.filter(device => {
      const label = device.label.toLowerCase();
      return label.includes('blackhole') || 
             label.includes('soundflower') || 
             label.includes('virtual') ||
             label.includes('loopback') ||
             label.includes('aggregate') ||
             label.includes('multi-output');
    });
    
    // Step 3: Detect headphone/audio interface devices
    const headphoneDevices = audioInputs.filter(device => {
      const label = device.label.toLowerCase();
      return label.includes('headphone') || 
             label.includes('airpods') ||
             label.includes('bluetooth') ||
             label.includes('usb audio') ||
             label.includes('audio interface') ||
             label.includes('focusrite') ||
             label.includes('scarlett') ||
             label.includes('apollo') ||
             label.includes('rme') ||
             label.includes('motu');
    });
    
    console.log(`\n🎧 Detected ${headphoneDevices.length} headphone/audio interface device(s):`);
    headphoneDevices.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device.label}`);
    });
    
    let systemAudioStream = null;
    let systemAudioSource = 'none';
    
    if (virtualDevices.length > 0) {
      console.log(`\n✅ Found ${virtualDevices.length} virtual audio device(s) for system audio:`);
      virtualDevices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.label}`);
      });
      
      // Try virtual devices first (preferred for system audio)
      for (const virtualDevice of virtualDevices) {
        console.log(`\n🔊 Attempting to use "${virtualDevice.label}" for system audio capture`);
        
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
          console.log(`✅ System audio stream obtained from virtual device: ${virtualDevice.label}`);
          break; // Success, stop trying other devices
        } catch (error) {
          console.warn(`⚠️ Failed to get system audio from ${virtualDevice.label}:`, error.message);
          continue; // Try next device
        }
      }
    }
    
    // Step 4: If virtual devices failed and headphones are connected, try alternative approaches
    if (!systemAudioStream && headphoneDevices.length > 0) {
      console.log('\n🔄 Virtual devices failed, trying headphone audio interface approach...');
      
      // Try to get system audio through headphone device (if it supports it)
      for (const headphoneDevice of headphoneDevices) {
        console.log(`\n🎧 Attempting to use "${headphoneDevice.label}" for system audio capture`);
        
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
          console.log(`✅ System audio stream obtained from headphone device: ${headphoneDevice.label}`);
          break;
        } catch (error) {
          console.warn(`⚠️ Failed to get system audio from ${headphoneDevice.label}:`, error.message);
          continue;
        }
      }
    }
    
    // Step 5: Final fallback - try to get any available audio input
    if (!systemAudioStream) {
      console.log('\n🔄 Trying fallback approach - attempting to capture from any available audio input...');
      
      try {
        // Try to get audio without specifying device (let browser choose)
        systemAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          },
          video: false
        });
        systemAudioSource = 'browser-selected';
        console.log('✅ System audio stream obtained from browser-selected device');
      } catch (error) {
        console.warn('⚠️ Fallback system audio capture failed:', error.message);
      }
    }
    
    // Step 6: Provide user guidance based on results
    if (!systemAudioStream) {
      console.warn('\n⚠️ No system audio capture available');
      console.warn('💡 System audio will NOT be captured - only microphone audio will be recorded.');
      console.warn('\n📖 To enable system audio capture with headphones:');
      console.warn('   1. Install BlackHole: brew install blackhole-2ch');
      console.warn('   2. Configure macOS Audio MIDI Setup:');
      console.warn('      • Create Multi-Output Device');
      console.warn('      • Include both headphones and BlackHole');
      console.warn('      • Set as system output device');
      console.warn('   3. Or use audio interface with loopback capability');
      console.warn('   4. Restart this app after configuration\n');
    } else {
      console.log(`\n🎉 System audio capture successful using: ${systemAudioSource}`);
    }
    
    // Step 7: Get microphone audio (separate from system audio)
    console.log('\n📱 Requesting microphone access...');
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    
    console.log('✅ Microphone access granted');
    
    // Step 8: Merge streams if we have system audio, otherwise just use microphone
    if (systemAudioStream) {
      console.log('\n🔀 Merging microphone + system audio streams using Web Audio API...');
      audioContext = new AudioContext();
      
      // Create audio sources
      const systemAudioSourceNode = audioContext.createMediaStreamSource(systemAudioStream);
      const micSourceNode = audioContext.createMediaStreamSource(micStream);
      
      // Create a destination for the merged audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect both sources to the destination
      systemAudioSourceNode.connect(destination);
      micSourceNode.connect(destination);
      
      console.log('✅ Audio streams merged successfully');
      
      // Store the merged stream
      mergedStream = destination.stream;
      
      // Keep track of original streams for cleanup
      recordingStream = {
        systemAudioStream,
        micStream,
        getTracks: () => [...systemAudioStream.getTracks(), ...micStream.getTracks()]
      };
      
      // Log stream info
      const systemAudioTracks = systemAudioStream.getAudioTracks();
      const micAudioTracks = micStream.getAudioTracks();
      const mergedAudioTracks = mergedStream.getAudioTracks();
      
      console.log(`\n📊 Stream Summary:`);
      console.log(`   • System audio tracks: ${systemAudioTracks.length} (source: ${systemAudioSource})`);
      console.log(`   • Microphone tracks: ${micAudioTracks.length}`);
      console.log(`   • Merged tracks: ${mergedAudioTracks.length}`);
      
      if (systemAudioTracks.length > 0) {
        console.log(`   • System: ${systemAudioTracks[0].label} (enabled: ${systemAudioTracks[0].enabled})`);
      }
      if (micAudioTracks.length > 0) {
        console.log(`   • Microphone: ${micAudioTracks[0].label} (enabled: ${micAudioTracks[0].enabled})`);
      }
    } else {
      console.log('\n🎤 Recording microphone only (no system audio)');
      mergedStream = micStream;
      recordingStream = {
        micStream,
        getTracks: () => [...micStream.getTracks()]
      };
    }
    
    // Step 9: Set up audio visualization
    console.log('\n🎨 Setting up audio visualization...');
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Higher = more frequency detail
    analyser.smoothingTimeConstant = 0.8; // Smoother animations
    
    // Connect the merged stream to the analyser for visualization
    const visualizationSource = audioContext.createMediaStreamSource(mergedStream);
    visualizationSource.connect(analyser);
    
    console.log('✅ Audio visualization ready');
    
    // Step 10: Create MediaRecorder with the stream (merged or mic-only)
    audioChunks = [];
    let dataReceived = 0;
    
    mediaRecorder = new MediaRecorder(mergedStream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        dataReceived += event.data.size;
      }
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('❌ MediaRecorder error:', event.error);
    };
    
    mediaRecorder.onstart = () => {
      console.log('\n▶️ MediaRecorder started');
    };
    
    mediaRecorder.onstop = () => {
      console.log('⏹️ MediaRecorder stopped');
      console.log(`📊 Captured: ${audioChunks.length} chunks, ${(dataReceived / 1024 / 1024).toFixed(2)} MB total`);
    };
    
    // Start recording with timeslice to collect data every second
    mediaRecorder.start(1000);
    
    if (systemAudioStream) {
      console.log(`✅ Recording started: Microphone + System Audio (source: ${systemAudioSource})`);
    } else {
      console.log('✅ Recording started: Microphone Only');
      console.log('💡 For system audio with headphones, configure BlackHole Multi-Output Device');
    }
    
  } catch (error) {
    console.error('Failed to start audio recording:', error);
    throw error;
  }
}

// Stop Recording
async function stopRecording() {
  try {
    if (!isRecording) return;
    
    setStatus('processing', 'Processing');
    
    // Stop audio visualization
    stopAudioVisualization();
    
    // Stop timer and show status
    stopTimer();
    
    // UI Updates
    if (stopButtonInner) {
      stopButtonInner.disabled = true;
      stopButtonInner.classList.remove('recording-pulse');
    }
    
    // Turn stop button into a loader
    if (stopButtonContent) {
      stopButtonContent.className = '';
      stopButtonContent.innerHTML = `
        <svg class="w-14 h-14 spinner" fill="none" viewBox="0 0 24 24" style="color: #EF4444;">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      `;
    }
    
    // Show first progress message
    updateProgress(1, 'active', 'Saving audio...');
    
    // Stop and save microphone recording
    const audioPath = await stopMicrophoneRecording();
    
    updateProgress(2, 'active', 'Transcribing audio...');
    
    // Override the audio path in noteTaker to use our recorded file
    if (noteTaker.currentAudioPath && audioPath) {
      // Replace the temp audio file with our recorded one
      if (fs.existsSync(audioPath)) {
        const destPath = noteTaker.currentAudioPath;
        const destDir = path.dirname(destPath);
        
        // Ensure destination directory exists
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Copy our recording to the expected location
        fs.copyFileSync(audioPath, destPath);
        console.log(`✅ Audio file copied to: ${destPath}`);
      }
    }
    
    // Stop and process with backend
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
    
    // Clean up temp audio file
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    
    // Show success notification
    setTimeout(() => {
      const notification = new Notification('Aura - Meeting Recorder', {
        body: 'Meeting notes have been saved successfully!',
        silent: false
      });
      
      notification.onclick = () => {
        shell.showItemInFolder(result.notePath);
      };
    }, 500);
    
    // Reset after a delay to show success message
    setTimeout(() => {
      resetUI();
    }, 2000);
    
  } catch (error) {
    console.error('Stop recording error:', error);
    
    // Show detailed error in status
    let errorMsg = error.message;
    if (errorMsg.includes('Transcription failed')) {
      updateProgress(0, 'error', 'Transcription failed');
    } else if (errorMsg.includes('no content')) {
      updateProgress(0, 'error', 'No audio content captured');
    } else {
      updateProgress(0, 'error', `${errorMsg.substring(0, 50)}`);
    }
  
    
    setStatus('ready', 'Ready');
    setTimeout(resetUI, 5000);
  }
}

// Stop microphone recording and save to file (Vibe-style cleanup)
async function stopMicrophoneRecording() {
  return new Promise((resolve, reject) => {
    try {
      if (!mediaRecorder) {
        resolve(null);
        return;
      }
      
      console.log('\n⏹️ Stopping audio recording (microphone + system audio)...');
      
      mediaRecorder.onstop = async () => {
        try {
          console.log(`🔄 Processing ${audioChunks.length} audio chunks...`);
          
          // Create blob from audio chunks
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log(`📦 Created audio blob: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);
          
          if (audioBlob.size === 0) {
            console.warn('\n⚠️ WARNING: Audio blob is empty! No audio data was captured.');
            console.warn('💡 Possible reasons:');
            console.warn('   1. No audio was playing during recording');
            console.warn('   2. Virtual audio device not properly configured');
            console.warn('   3. Microphone permission not granted');
          }
          
          // Save to temp file
          const tempDir = path.join(os.tmpdir(), 'meeting-note-taker');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          const timestamp = Date.now();
          const audioPath = path.join(tempDir, `recording-${timestamp}.webm`);
          
          // Convert blob to buffer and save
          const buffer = Buffer.from(await audioBlob.arrayBuffer());
          fs.writeFileSync(audioPath, buffer);
          
          const fileStats = fs.statSync(audioPath);
          console.log(`✅ Audio saved to: ${audioPath}`);
          console.log(`📁 File size: ${(fileStats.size / 1024).toFixed(2)} KB`);
          
          // Stop all tracks from both streams
          if (recordingStream) {
            console.log('\n🔇 Stopping all audio tracks...');
            recordingStream.getTracks().forEach(track => {
              console.log(`   • Stopping: ${track.label}`);
              track.stop();
            });
          }
          
          // Close audio context (important for proper cleanup)
          if (audioContext) {
            console.log('🔌 Closing Web Audio context...');
            await audioContext.close();
            audioContext = null;
          }
          
          // Clean up all references
          mediaRecorder = null;
          audioChunks = [];
          recordingStream = null;
          mergedStream = null;
          analyser = null;
          
          console.log('✅ All audio resources cleaned up\n');
          
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

// Timer
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

// UI Updates
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

// Request notification permission
if (Notification.permission === 'default') {
  Notification.requestPermission();
}

// Initialize the app
init();

