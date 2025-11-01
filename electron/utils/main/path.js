const path = require('path');
const { app } = require('electron');

/**
 * Gets the path to UI files (HTML)
 * @param {string} fileName - Name of the UI file
 * @returns {string} Full path to the UI file
 */
function getUIPath(fileName) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar', 'electron', 'ui', fileName);
  } else {
    return path.join(__dirname, '../../ui', fileName);
  }
}

/**
 * Gets the path to assets directory
 * @returns {string} Full path to assets directory
 */
function getAssetsPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets');
  } else {
    return path.join(__dirname, '../../../assets');
  }
}

/**
 * Gets the path to a specific asset file
 * @param {string} fileName - Name of the asset file
 * @returns {string} Full path to the asset file
 */
function getAssetPath(fileName) {
  return path.join(getAssetsPath(), fileName);
}

module.exports = {
  getUIPath,
  getAssetsPath,
  getAssetPath
};

