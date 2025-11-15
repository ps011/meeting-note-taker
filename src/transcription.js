const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

let Config = null;
try {
  const configPath = path.join(
    __dirname,
    '..',
    'electron',
    'main',
    'config.js'
  );
  Config = require(configPath);
} catch {
  // Config not available, will use fallback methods
}

/**
 * Transcription service using Whisper
 */
class TranscriptionService {
  constructor(model = 'base') {
    this.model = model;
  }

  /**
   * Get Whisper path from stored config or find it using which
   * This is deterministic - uses the path stored by dependency checker
   * or finds it using /usr/bin/which with proper PATH
   */
  async getWhisperPath() {
    // First, try to get stored path from Config (set by dependency checker)
    if (Config) {
      const storedPath = Config.get('dependencyPaths')?.['Whisper'];
      if (storedPath && fs.existsSync(storedPath)) {
        return storedPath;
      }
    }

    // Fallback: try to find whisper using /usr/bin/which with proper PATH
    // Build a PATH that includes common locations so which can find it
    const searchPath = this.buildSearchPath();
    try {
      const { stdout } = await execAsync('/usr/bin/which whisper', {
        timeout: 5000,
        env: { ...process.env, PATH: searchPath },
      });
      if (stdout && stdout.trim()) {
        const foundPath = stdout.trim();
        // Store it for future use
        if (Config) {
          const paths = Config.get('dependencyPaths') || {};
          paths['Whisper'] = foundPath;
          Config.set('dependencyPaths', paths);
        }
        return foundPath;
      }
    } catch {
      // Continue to error
    }

    throw new Error(
      'Whisper not found. Please run dependency check in Settings to configure Whisper path.'
    );
  }

  /**
   * Build PATH for searching for whisper using which
   * Uses stored dependency paths to build a deterministic PATH
   */
  buildSearchPath() {
    const pathDirs = new Set();

    // Add existing PATH directories
    const existingPath = process.env.PATH || '';
    existingPath.split(':').forEach((dir) => {
      if (dir) pathDirs.add(dir);
    });

    // Add directories from stored dependency paths (deterministic)
    if (Config) {
      const dependencyPaths = Config.get('dependencyPaths') || {};
      Object.values(dependencyPaths).forEach((depPath) => {
        if (depPath && path.isAbsolute(depPath)) {
          const dir = path.dirname(depPath);
          pathDirs.add(dir);
        }
      });
    }

    return Array.from(pathDirs).join(':');
  }

  /**
   * Build PATH environment variable from stored dependency paths
   * This ensures whisper's dependencies (Python, FFmpeg, etc.) are found
   */
  buildPathFromStoredPaths() {
    const pathDirs = new Set();

    // Add existing PATH directories
    const existingPath = process.env.PATH || '';
    existingPath.split(':').forEach((dir) => {
      if (dir) pathDirs.add(dir);
    });

    // Add directories from stored dependency paths (deterministic - no guessing)
    if (Config) {
      const dependencyPaths = Config.get('dependencyPaths') || {};
      Object.values(dependencyPaths).forEach((depPath) => {
        if (depPath && path.isAbsolute(depPath)) {
          const dir = path.dirname(depPath);
          pathDirs.add(dir);
        }
      });
    }

    return Array.from(pathDirs).join(':');
  }

  /**
   * Transcribe audio file using Whisper
   */
  async transcribe(audioPath) {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Get the whisper path
    const whisperPath = await this.getWhisperPath();

    // Build PATH from stored dependency paths to ensure whisper and its dependencies are found
    const customPath = this.buildPathFromStoredPaths();

    // Get output directory
    const outputDir = path.dirname(audioPath);
    // Build command with proper path handling
    const command = `"${whisperPath}" "${audioPath}" --model ${this.model} --output_format txt --language en --output_dir "${outputDir}"`;

    // Execute with custom PATH if we have stored paths
    const env = customPath ? { ...process.env, PATH: customPath } : process.env;

    await execAsync(command, {
      shell: true,
      env: env,
    });

    const txtPath = audioPath.replace(/\.[^/.]+$/, '.txt');

    if (!fs.existsSync(txtPath)) {
      throw new Error('Transcription file was not generated');
    }

    const transcription = fs.readFileSync(txtPath, 'utf-8');

    return transcription.trim();
  }
}

module.exports = { TranscriptionService };
