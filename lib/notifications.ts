export function isNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationsSupported()) return 'denied'
  return Notification.permission
}

export function notifyComplete(title: string, onClick?: () => void): void {
  if (getNotificationPermission() !== 'granted') return
  const n = new Notification('Aura — Notes ready', { body: title, icon: '/favicon.ico' })
  if (onClick) n.onclick = () => { window.focus(); onClick() }
}

export function notifyError(onClick?: () => void): void {
  if (getNotificationPermission() !== 'granted') return
  const n = new Notification('Aura — Something went wrong', { body: 'Open to retry.', icon: '/favicon.ico' })
  if (onClick) n.onclick = () => { window.focus(); onClick() }
}
