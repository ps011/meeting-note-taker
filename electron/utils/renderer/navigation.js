const { shell } = require('electron');

/**
 * Navigates to a page with a smooth fade animation
 */
function navigateToPage(url) {
  // Add fade-out animation to body
  if (document.body) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.25s ease-out';

    // Navigate after animation starts
    setTimeout(() => {
      window.location.href = url;
    }, 150);
  } else {
    // Fallback if body isn't ready
    window.location.href = url;
  }
}

/**
 * Opens the notes folder in the file manager
 * @param {string} notesPath - Path to the notes folder
 * @returns {Promise<void>}
 */
function openNotesFolder(notesPath) {
  if (notesPath && notesPath.trim()) {
    return shell.openPath(notesPath);
  }
  return Promise.reject(new Error('Notes path not configured'));
}

/**
 * Navigates to the recordings history page with animation
 */
function openRecordingsPage() {
  navigateToPage('history.html');
}

/**
 * Navigates to the settings page with animation
 */
function openSettingsPage() {
  navigateToPage('setup.html');
}

/**
 * Navigates to the main page with animation
 */
function openMainPage() {
  navigateToPage('index.html');
}

module.exports = {
  openNotesFolder,
  openRecordingsPage,
  openSettingsPage,
  openMainPage,
  navigateToPage,
};
