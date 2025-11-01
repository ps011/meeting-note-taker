/**
 * Loads the theme from localStorage and applies it
 * This is the base implementation - does not check window.Layout to avoid circular calls
 */
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * Toggles between dark and light theme
 * This is the base implementation - does not check window.Layout to avoid circular calls
 */
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', !isDark);
  localStorage.setItem('theme', !isDark ? 'dark' : 'light');
}

module.exports = {
  loadTheme,
  toggleTheme
};

