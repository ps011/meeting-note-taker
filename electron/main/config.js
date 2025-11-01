const Store = require('electron-store');

// Initialize persistent storage
const store = new Store({
  defaults: {
    notesPath: '',
    llamaApiUrl: 'http://localhost:11434/api/generate',
    llamaModel: 'llama3',
    whisperModel: 'base',
    sampleRate: 16000,
    channels: 1,
    setupCompleted: false,
    dependenciesChecked: false,
    dependenciesInstalled: false
  }
});

/**
 * Configuration manager
 */
class Config {
  /**
   * Check if setup is completed
   */
  static isSetupCompleted() {
    return store.get('setupCompleted') && store.get('notesPath');
  }

  /**
   * Get all configuration
   */
  static getAll() {
    return {
      notesPath: store.get('notesPath'),
      llamaApiUrl: store.get('llamaApiUrl'),
      llamaModel: store.get('llamaModel'),
      whisperModel: store.get('whisperModel'),
      sampleRate: store.get('sampleRate'),
      channels: store.get('channels'),
      setupCompleted: store.get('setupCompleted'),
      dependenciesChecked: store.get('dependenciesChecked'),
      dependenciesInstalled: store.get('dependenciesInstalled')
    };
  }

  /**
   * Save configuration
   */
  static save(config) {
    if (config.notesPath !== undefined) {
      store.set('notesPath', config.notesPath);
    }
    if (config.llamaApiUrl !== undefined) {
      store.set('llamaApiUrl', config.llamaApiUrl);
    }
    if (config.llamaModel !== undefined) {
      store.set('llamaModel', config.llamaModel);
    }
    if (config.whisperModel !== undefined) {
      store.set('whisperModel', config.whisperModel);
    }
    if (config.sampleRate !== undefined) {
      store.set('sampleRate', config.sampleRate);
    }
    if (config.channels !== undefined) {
      store.set('channels', config.channels);
    }
    if (config.setupCompleted !== undefined) {
      store.set('setupCompleted', config.setupCompleted);
    }
    if (config.dependenciesChecked !== undefined) {
      store.set('dependenciesChecked', config.dependenciesChecked);
    }
    if (config.dependenciesInstalled !== undefined) {
      store.set('dependenciesInstalled', config.dependenciesInstalled);
    }
  }

  /**
   * Reset configuration
   */
  static reset() {
    store.clear();
  }

  /**
   * Get specific value
   */
  static get(key) {
    return store.get(key);
  }

  /**
   * Set specific value
   */
  static set(key, value) {
    store.set(key, value);
  }
}

module.exports = Config;

