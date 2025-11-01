const { app, nativeImage } = require('electron');
const path = require('path');

/**
 * Loads the base tray icon from assets
 * Handles both development and packaged app paths
 * @returns {NativeImage} The tray icon as a NativeImage
 */
function loadBaseTrayIcon() {
  // Create tray icon - use PNG for better menu bar compatibility
  // Handle both development and packaged app paths
  let iconPath;
  if (app.isPackaged) {
    // In packaged app, assets are in the app.asar or Resources folder
    iconPath = path.join(process.resourcesPath, 'assets', 'icon.png');
  } else {
    // In development, assets are at root level
    iconPath = path.join(__dirname, '../../../assets/icon.png');
  }
  
  let trayIcon = nativeImage.createFromPath(iconPath);
  
  // If PNG not found, try ICNS as fallback
  if (trayIcon.isEmpty()) {
    const icnsPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.icns')
      : path.join(__dirname, '../../../assets/icon.icns');
    trayIcon = nativeImage.createFromPath(icnsPath);
  }
  
  // Validate that we got a valid image
  if (trayIcon.isEmpty()) {
    console.error('Failed to load tray icon. Tried:', iconPath);
    // Try using the app icon as last resort
    const appIconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'electron', 'assets', 'icon.png')
      : path.join(__dirname, '../../assets/icon.png');
    trayIcon = nativeImage.createFromPath(appIconPath);
  }
  
  // Resize to appropriate size for menu bar (22x22 for retina displays on macOS)
  const size = process.platform === 'darwin' ? 22 : 16;
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: size, height: size });
    
    // Note: Template images work best with monochrome icons
    // For full-color icons, don't set as template to preserve visibility
    // Uncomment the line below if your icon is monochrome/template-ready
    // trayIcon.setTemplateImage(true);
  } else {
    console.error('All attempts to load tray icon failed. Tray may not be visible.');
  }
  
  return trayIcon;
}

/**
 * Creates a recording icon with a red dot indicator
 * @param {NativeImage} baseIcon - The base icon to overlay
 * @returns {NativeImage} A new icon with red dot indicator
 */
function createRecordingIcon(baseIcon) {
  // Create a red dot indicator for recording using native Buffer only
  // For macOS, create a simple red circle overlay
  const size = process.platform === 'darwin' ? 22 : 16;
  
  // Create a red circle icon using Buffer (no external dependencies)
  const buffer = Buffer.alloc(size * size * 4); // RGBA
  for (let i = 0; i < buffer.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor((i / 4) / size);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 3;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    
    if (distance < radius) {
      // Red circle (EF4444 = rgb(239, 68, 68))
      buffer[i] = 239;     // R
      buffer[i + 1] = 68;   // G
      buffer[i + 2] = 68;   // B
      buffer[i + 3] = 255;  // A (fully opaque)
    } else {
      // Transparent background
      buffer[i] = 0;
      buffer[i + 1] = 0;
      buffer[i + 2] = 0;
      buffer[i + 3] = 0;
    }
  }
  
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

module.exports = {
  loadBaseTrayIcon,
  createRecordingIcon
};

