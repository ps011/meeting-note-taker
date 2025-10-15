const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');

const execAsync = promisify(exec);

/**
 * Transcription service using Whisper
 */
class TranscriptionService {
  constructor(model = 'base') {
    this.model = model;
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

      const command = `whisper "${audioPath}" --model ${this.model} --output_format txt --language en --output_dir "${audioPath.substring(0, audioPath.lastIndexOf('/'))}"`;
      
      console.log('   Running Whisper transcription (this may take a while)...');
      
      const { stdout, stderr } = await execAsync(command);
      
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

