/**
 * Shows a notification if permission is granted
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {boolean} silent - Whether notification should be silent
 * @returns {Notification|null} The notification instance or null
 */
function showNotification(title, body, silent = false) {
  if (Notification.permission === 'granted') {
    return new Notification(title, {
      body,
      silent
    });
  } else if (Notification.permission === 'default') {
    // Request permission if not yet requested
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        return new Notification(title, {
          body,
          silent
        });
      }
    });
  }
  return null;
}

/**
 * Shows a notification with click handler
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Function} onClick - Click handler function
 * @param {boolean} silent - Whether notification should be silent
 * @returns {Notification|null} The notification instance or null
 */
function showNotificationWithClick(title, body, onClick, silent = false) {
  const notification = showNotification(title, body, silent);
  if (notification && onClick) {
    notification.onclick = onClick;
  }
  return notification;
}

module.exports = {
  showNotification,
  showNotificationWithClick
};

