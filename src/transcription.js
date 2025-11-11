const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');
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
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const command = `"whisper" "${audioPath}" --model ${this.model} --output_format txt --language en --output_dir "${audioPath.substring(0, audioPath.lastIndexOf('/'))}"`;

    await execAsync(command, {
      shell: true,
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
