const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
const path = require('path');

const execAsync = promisify(exec);

// Try to load Config if available (for Electron main process)
let Config = null;
try {
  // Config is in electron/main/config.js relative to src
  const configPath = path.join(
    __dirname,
    '..',
    'electron',
    'main',
    'config.js'
  );
  Config = require(configPath);
} catch (error) {
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
   * Get Whisper path from stored config or find it
   */
  async getWhisperPath() {
    // Try to get stored path from Config
    if (Config) {
      const storedPath = Config.get('dependencyPaths')?.['Whisper'];
      if (storedPath) {
        return storedPath;
      }
    }

    // Fallback: try to find whisper using which
    try {
      const { stdout } = await execAsync('which whisper', { timeout: 5000 });
      if (stdout && stdout.trim()) {
        return stdout.trim();
      }
    } catch (error) {
      // Continue to next fallback
    }

    // Final fallback
    return 'whisper';
  }

  /**
   * Transcribe audio file using Whisper
   */
  async transcribe(audioPath) {
    try {
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Get Whisper path and use it directly
      const whisperPath = await this.getWhisperPath();

      const command = `"${whisperPath}" "${audioPath}" --model ${this.model} --output_format txt --language en --output_dir "${audioPath.substring(0, audioPath.lastIndexOf('/'))}"`;

      // Ensure PATH includes the directory containing whisper for any subprocess calls
      // If whisperPath is absolute, use its directory; otherwise use common paths
      let whisperDir = '';
      if (path.isAbsolute(whisperPath)) {
        whisperDir = `${path.dirname(whisperPath)}:`;
      } else {
        // Fallback: include common binary locations
        const homeDir = process.env.HOME || os.homedir();
        whisperDir = `/usr/local/bin:/opt/homebrew/bin:${homeDir}/.local/bin:`;
      }

      const env = {
        ...process.env,
        PATH: `${whisperDir}${process.env.PATH || '/usr/bin:/bin'}`,
      };

      const { stdout, stderr } = await execAsync(command, {
        env: env,
        shell: true,
      });

      if (stderr && !stderr.includes('WARNING')) {
      }

      const txtPath = audioPath.replace(/\.[^/.]+$/, '.txt');

      if (!fs.existsSync(txtPath)) {
        throw new Error('Transcription file was not generated');
      }

      const transcription = fs.readFileSync(txtPath, 'utf-8');

      return transcription.trim();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = { TranscriptionService };
