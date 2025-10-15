const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

/**
 * Dependency checker and installer
 */
class DependencyChecker {
  constructor() {
    this.platform = os.platform();
    this.dependencies = [
      {
        name: 'Homebrew',
        command: 'brew --version',
        installCommand: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        required: true,
        description: 'Package manager for macOS',
        skipIfPresent: false
      },
      {
        name: 'Python3',
        command: 'python3 --version',
        installCommand: 'brew install python3',
        required: true,
        description: 'Python 3 runtime (required for Whisper)',
        skipIfPresent: false
      },
      {
        name: 'FFmpeg',
        command: 'ffmpeg -version',
        installCommand: 'brew install ffmpeg',
        required: true,
        description: 'Audio/video processing tool',
        skipIfPresent: false
      },
      {
        name: 'Sox',
        command: 'sox --version',
        installCommand: 'brew install sox',
        required: true,
        description: 'Sound processing tool',
        skipIfPresent: false
      },
      {
        name: 'Ollama',
        command: 'ollama --version',
        installCommand: 'brew install ollama',
        required: true,
        description: 'Local LLM runtime',
        skipIfPresent: false
      },
      {
        name: 'Whisper',
        command: 'whisper --help',
        installCommand: 'pip3 install -U openai-whisper',
        required: true,
        description: 'Speech-to-text transcription',
        skipIfPresent: false
      }
    ];
  }

  /**
   * Check if running on macOS
   */
  isMacOS() {
    return this.platform === 'darwin';
  }

  /**
   * Execute command and check if successful
   */
  async executeCommand(command, timeout = 30000) {
    try {
      const { stdout, stderr } = await execAsync(command, { timeout });
      return { success: true, stdout, stderr };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  }

  /**
   * Check if a single dependency is installed
   */
  async checkDependency(dependency) {
    console.log(`Checking ${dependency.name}...`);
    const result = await this.executeCommand(dependency.command, 5000);
    
    return {
      name: dependency.name,
      installed: result.success,
      description: dependency.description,
      required: dependency.required,
      installCommand: dependency.installCommand
    };
  }

  /**
   * Check all dependencies
   */
  async checkAll(progressCallback) {
    if (!this.isMacOS()) {
      return {
        success: false,
        error: 'Automatic dependency installation is only supported on macOS'
      };
    }

    const results = [];
    const total = this.dependencies.length;

    for (let i = 0; i < this.dependencies.length; i++) {
      const dep = this.dependencies[i];
      
      if (progressCallback) {
        progressCallback({
          step: 'checking',
          dependency: dep.name,
          current: i + 1,
          total: total,
          progress: ((i + 1) / total) * 100
        });
      }

      const result = await this.checkDependency(dep);
      results.push(result);

      // Small delay for UI update
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const missing = results.filter(r => !r.installed);
    
    return {
      success: true,
      results: results,
      missing: missing,
      allInstalled: missing.length === 0
    };
  }

  /**
   * Install a single dependency
   */
  async installDependency(dependency, progressCallback) {
    try {
      console.log(`Installing ${dependency.name}...`);
      
      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dependency.name,
          status: 'in-progress'
        });
      }

      // Special handling for Homebrew
      if (dependency.name === 'Homebrew') {
        // Homebrew installation is interactive, so we need to handle it differently
        const result = await this.executeCommand(dependency.installCommand, 300000);
        
        if (!result.success) {
          throw new Error(`Failed to install ${dependency.name}: ${result.error}`);
        }
      } else {
        // For other packages, use brew or pip
        const result = await this.executeCommand(dependency.installCommand, 300000);
        
        if (!result.success) {
          throw new Error(`Failed to install ${dependency.name}: ${result.error}`);
        }
      }

      // Verify installation
      await new Promise(resolve => setTimeout(resolve, 1000));
      const verifyResult = await this.checkDependency(dependency);
      
      if (!verifyResult.installed) {
        throw new Error(`Installation appeared to succeed but ${dependency.name} is still not available`);
      }

      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dependency.name,
          status: 'success'
        });
      }

      return { success: true };
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dependency.name,
          status: 'error',
          error: error.message
        });
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Install all missing dependencies
   */
  async installMissing(missingDeps, progressCallback) {
    const results = [];
    const total = missingDeps.length;

    for (let i = 0; i < missingDeps.length; i++) {
      const dep = missingDeps[i];
      
      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dep.name,
          current: i + 1,
          total: total,
          progress: ((i + 1) / total) * 100,
          status: 'starting'
        });
      }

      // Find the full dependency object
      const fullDep = this.dependencies.find(d => d.name === dep.name);
      
      const result = await this.installDependency(fullDep, progressCallback);
      results.push({
        name: dep.name,
        success: result.success,
        error: result.error
      });

      if (!result.success) {
        // Continue with other installations even if one fails
        console.error(`Failed to install ${dep.name}: ${result.error}`);
      }

      // Small delay between installations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const failed = results.filter(r => !r.success);
    
    return {
      success: failed.length === 0,
      results: results,
      failed: failed
    };
  }

  /**
   * Check if Ollama is running
   */
  async checkOllamaRunning() {
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:11434/api/tags', { timeout: 3000 });
      return { running: true, models: response.data.models || [] };
    } catch (error) {
      return { running: false };
    }
  }

  /**
   * Start Ollama service
   */
  async startOllama(progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          step: 'starting-ollama',
          status: 'in-progress'
        });
      }

      // Start Ollama in the background
      exec('ollama serve > /dev/null 2>&1 &');
      
      // Wait for Ollama to start (check every second for up to 10 seconds)
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const status = await this.checkOllamaRunning();
        if (status.running) {
          if (progressCallback) {
            progressCallback({
              step: 'starting-ollama',
              status: 'success'
            });
          }
          return { success: true };
        }
      }

      throw new Error('Ollama failed to start within 10 seconds');
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          step: 'starting-ollama',
          status: 'error',
          error: error.message
        });
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Pull a specific Ollama model
   */
  async pullOllamaModel(modelName, progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          step: 'pulling-model',
          model: modelName,
          status: 'in-progress'
        });
      }

      const result = await this.executeCommand(`ollama pull ${modelName}`, 600000);
      
      if (!result.success) {
        throw new Error(`Failed to pull model ${modelName}: ${result.error}`);
      }

      if (progressCallback) {
        progressCallback({
          step: 'pulling-model',
          model: modelName,
          status: 'success'
        });
      }

      return { success: true };
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          step: 'pulling-model',
          model: modelName,
          status: 'error',
          error: error.message
        });
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Run full setup - check and install all dependencies
   */
  async runFullSetup(options = {}) {
    const progressCallback = options.progressCallback;
    const modelName = options.modelName || 'llama3';

    try {
      // Step 1: Check all dependencies
      if (progressCallback) {
        progressCallback({
          phase: 'checking',
          message: 'Checking for installed dependencies...'
        });
      }

      const checkResults = await this.checkAll(progressCallback);
      
      if (!checkResults.success) {
        return checkResults;
      }

      // Step 2: Install missing dependencies
      if (checkResults.missing.length > 0) {
        if (progressCallback) {
          progressCallback({
            phase: 'installing',
            message: `Installing ${checkResults.missing.length} missing dependencies...`,
            missing: checkResults.missing
          });
        }

        const installResults = await this.installMissing(checkResults.missing, progressCallback);
        
        if (!installResults.success) {
          return {
            success: false,
            error: 'Some dependencies failed to install',
            details: installResults.failed
          };
        }
      } else {
        if (progressCallback) {
          progressCallback({
            phase: 'complete',
            message: 'All dependencies are already installed!'
          });
        }
      }

      // Step 3: Check if Ollama is running
      if (progressCallback) {
        progressCallback({
          phase: 'ollama-check',
          message: 'Checking Ollama service...'
        });
      }

      const ollamaStatus = await this.checkOllamaRunning();
      
      if (!ollamaStatus.running) {
        if (progressCallback) {
          progressCallback({
            phase: 'ollama-start',
            message: 'Starting Ollama service...'
          });
        }

        const startResult = await this.startOllama(progressCallback);
        
        if (!startResult.success) {
          return {
            success: false,
            warning: 'Dependencies installed but Ollama service failed to start',
            error: startResult.error
          };
        }
      }

      // Step 4: Pull the model if needed
      if (progressCallback) {
        progressCallback({
          phase: 'model-check',
          message: `Checking for ${modelName} model...`
        });
      }

      const modelStatus = await this.checkOllamaRunning();
      const hasModel = modelStatus.models && modelStatus.models.some(m => m.name.includes(modelName));

      if (!hasModel) {
        if (progressCallback) {
          progressCallback({
            phase: 'model-pull',
            message: `Downloading ${modelName} model (this may take a while)...`
          });
        }

        const pullResult = await this.pullOllamaModel(modelName, progressCallback);
        
        if (!pullResult.success) {
          return {
            success: false,
            warning: 'Dependencies installed but model download failed',
            error: pullResult.error
          };
        }
      }

      // All done!
      if (progressCallback) {
        progressCallback({
          phase: 'complete',
          message: 'All dependencies are installed and ready!'
        });
      }

      return {
        success: true,
        message: 'All dependencies successfully installed and configured'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DependencyChecker;

