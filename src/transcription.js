const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

/**
 * Transcription service using Whisper
 */
class TranscriptionService {
  constructor(model = 'base') {
    this.model = model;
  }

  /**
   * Find the correct whisper executable path
   */
  async findWhisperPath() {
    const homeDir = process.env.HOME || os.homedir();
    const possiblePaths = [
      homeDir + '/.local/bin/whisper',
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper',
      'whisper' // fallback to PATH
    ];
    
    for (const path of possiblePaths) {
      try {
        const testCommand = path === 'whisper' ? 'whisper --help' : `${path} --help`;
        await execAsync(testCommand, { timeout: 5000 });
        console.log(`   Found whisper at: ${path}`);
        return path;
      } catch (error) {
        // Continue to next path
      }
    }
    
    throw new Error('Whisper executable not found in any expected location');
  }

  /**
   * Transcribe audio file using Whisper
   */
  async transcribe(audioPath) {
    try {
      console.log('🎯 Starting transcription with Whisper...');
      console.log(`   Model: ${this.model}`);
      console.log(`   Audio file: ${audioPath}`);

      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Find the correct whisper path
      const whisperPath = await this.findWhisperPath();
      
      const command = `"${whisperPath}" "${audioPath}" --model ${this.model} --output_format txt --language en --output_dir "${audioPath.substring(0, audioPath.lastIndexOf('/'))}"`;
      
      console.log('   Running Whisper transcription (this may take a while)...');
      console.log(`   Command: ${command}`);
      
      // Use the same PATH resolution as dependency checker
      const homeDir = process.env.HOME || os.homedir();
      const env = {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + homeDir + '/.local/bin'
      };
      
      console.log(`   Home directory: ${homeDir}`);
      console.log(`   Updated PATH: ${env.PATH}`);
      
      const { stdout, stderr } = await execAsync(command, { 
        env: env,
        shell: true
      });
      
      if (stderr && !stderr.includes('WARNING')) {
        console.warn('Whisper stderr:', stderr);
      }

      const txtPath = audioPath.replace(/\.[^/.]+$/, '.txt');
      
      if (!fs.existsSync(txtPath)) {
        throw new Error('Transcription file was not generated');
      }

      const transcription = fs.readFileSync(txtPath, 'utf-8');
      console.log('✅ Transcription completed');
      console.log(`   Length: ${transcription.length} characters`);
      
      return transcription.trim();
    } catch (error) {
      console.error('❌ Transcription failed:', error.message);
      throw error;
    }
  }
}

module.exports = { TranscriptionService };

