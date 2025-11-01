const { ipcRenderer } = require('electron');

/**
 * Tracks an analytics event
 * @param {string} eventName - Name of the event
 * @param {object} parameters - Event parameters
 */
function trackEvent(eventName, parameters = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, parameters);
  }
  ipcRenderer.send('analytics-track-event', eventName, parameters);
}

/**
 * Tracks a page view
 * @param {string} pageName - Name of the page
 * @param {string} pageTitle - Title of the page
 */
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

module.exports = {
  trackEvent,
  trackPageView
};

