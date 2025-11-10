/**
 * Common layout loader
 */

const headerConfigs = {
  'index.html': {
    left: `
      <svg width="175" height="40" viewBox="0 0 370 100" xmlns="http://www.w3.org/2000/svg" class="w-54 h-10">
        <g fill="currentColor">
          <path d="M25.04899,10.19723h-4.52647l-37.31581,73.3068v4.08487h76.50846v-4.08487zM6.28068,72.13265l16.11866,-31.57492l14.79384,31.57492z"/>
          <path d="M165.31449,58.99483v-48.7976h-15.45625v48.908h0.1104c-0.1104,3.86406 -1.54563,7.39692 -4.30567,10.15697c-2.76005,2.76005 -6.2929,4.19527 -10.15697,4.19527c-3.86406,0 -7.50732,-1.43522 -10.26737,-4.19527c-2.76005,-2.76005 -4.30567,-6.40331 -4.30567,-10.26737v-48.7976h-15.45625v48.908c0.1104,16.44987 13.46902,29.80849 30.02929,29.80849c16.44987,0 29.91889,-13.35862 29.91889,-29.91889z"/>
          <path d="M211.51765,10.08683v77.39167h15.45625v-47.69358l7.72813,16.67067v0.1104l14.46264,31.02291h16.44987l-16.11866,-33.12054c9.60496,-1.65603 15.67706,-11.70259 15.67706,-21.08675c0,-12.80661 -10.37777,-23.29478 -23.18438,-23.29478zM235.36444,25.54308h6.62411c4.30567,0 7.72813,3.53286 7.72813,7.83853c0,3.97447 -2.98085,7.17612 -6.73451,7.61772z"/>
          <path d="M350.12713,10.19723h-4.52647l-37.31581,73.3068v4.08487h76.50846v-4.08487zM331.35882,72.13265l16.11866,-31.57492l14.79384,31.57492z"/>
        </g>
      </svg>
    `,
    right: `
      <button id="historyButton" class="p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50" title="View Notes">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </button>
      <button id="recordingsButton" class="p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50" title="Manage Recordings">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
      </button>
      <button id="openSettings" class="p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50" title="Settings">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>
      <button id="themeToggle" class="p-2.5 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50" title="Toggle theme">
        <svg id="sunIcon" class="w-5 h-5 text-gray-700 dark:text-gray-300 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <svg id="moonIcon" class="w-5 h-5 text-gray-700 dark:text-gray-300 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
      </button>
    `,
  },
  'history.html': {
    left: `
      <button id="backButton" class="p-2 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Recording History</h1>
    `,
    right: `
      <button id="refreshButton" class="p-2 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag" title="Refresh">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>
    `,
  },
  'setup.html': {
    left: `
      <button id="backButton" class="p-2 rounded-xl bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-300 no-drag">
        <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
    `,
    right: `
      <button id="themeToggle" class="p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700 transition" title="Toggle theme">
        <svg id="sunIcon" class="w-5 h-5 text-gray-700 dark:text-gray-300 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <svg id="moonIcon" class="w-5 h-5 text-gray-700 dark:text-gray-300 block dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
      </button>
    `,
  },
};

function loadLayout() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const config = headerConfigs[currentPage];

  if (!config) {
    return;
  }

  // Find or create header container
  let headerContainer = document.getElementById('appHeader');

  if (!headerContainer) {
    // Create header if it doesn't exist
    headerContainer = document.createElement('header');
    headerContainer.id = 'appHeader';
    headerContainer.className =
      'flex items-center justify-between px-8 pt-12 pb-6 border-b border-gray-200 dark:border-gray-700';

    // Insert at the beginning of body
    document.body.insertBefore(headerContainer, document.body.firstChild);
  }

  // Clear and rebuild header
  headerContainer.innerHTML = '';

  const leftContainer = document.createElement('div');
  leftContainer.id = 'headerLeft';
  leftContainer.className =
    'flex items-center gap-3 text-gray-800 dark:text-white';
  leftContainer.innerHTML = config.left;

  const rightContainer = document.createElement('div');
  rightContainer.id = 'headerRight';
  rightContainer.className = 'flex items-center gap-3';
  rightContainer.innerHTML = config.right;

  headerContainer.appendChild(leftContainer);
  headerContainer.appendChild(rightContainer);

  // Setup theme toggle
  setupThemeToggle();
}

// Import theme utilities - use unique name to avoid global scope conflicts
const layoutThemeUtils = require('../utils/renderer/theme');

function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  // Load saved theme
  layoutThemeUtils.loadTheme();

  themeToggle.addEventListener('click', () => {
    layoutThemeUtils.toggleTheme();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadLayout();
    window.dispatchEvent(new CustomEvent('layoutLoaded'));
  });
} else {
  loadLayout();
  window.dispatchEvent(new CustomEvent('layoutLoaded'));
}

window.Layout = {
  loadLayout,
  loadTheme: layoutThemeUtils.loadTheme,
  toggleTheme: layoutThemeUtils.toggleTheme,
};
