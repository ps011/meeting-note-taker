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
        command: 'which brew && brew --version',
        installCommand: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        required: true,
        description: 'Package manager for macOS',
        skipIfPresent: false
      },
      {
        name: 'Python3',
        command: 'which python3 && python3 --version',
        installCommand: 'brew install python3',
        required: true,
        description: 'Python 3 runtime (required for Whisper)',
        skipIfPresent: false
      },
      {
        name: 'FFmpeg',
        command: 'which ffmpeg && ffmpeg -version',
        installCommand: 'brew install ffmpeg',
        required: true,
        description: 'Audio/video processing tool',
        skipIfPresent: false
      },
      {
        name: 'Sox',
        command: 'which sox && sox --version',
        installCommand: 'brew install sox',
        required: true,
        description: 'Sound processing tool',
        skipIfPresent: false
      },
      {
        name: 'Ollama',
        command: 'which ollama && ollama --version',
        installCommand: 'brew install ollama',
        required: true,
        description: 'Local LLM runtime',
        skipIfPresent: false
      },
      {
        name: 'Whisper',
        command: 'which whisper && whisper --help',
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
   * Debug environment information
   */
  async debugEnvironment() {
    console.log('Platform:', this.platform);
    console.log('Node version:', process.version);
    console.log('Electron version:', process.versions.electron);
    const isPackaged = process.env.NODE_ENV === 'production' || (process.env.ELECTRON_IS_DEV !== '1' && !process.env.npm_lifecycle_event);
    console.log('App is packaged:', isPackaged);
    
    // Check PATH
    const pathResult = await this.executeCommand('echo $PATH');
    console.log('PATH:', pathResult.stdout);
    
    // Check common locations
    const homeDir = process.env.HOME || os.homedir();
    console.log('Home directory:', homeDir);
    const locations = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', homeDir + '/.local/bin'];
    for (const location of locations) {
      const result = await this.executeCommand(`ls -la ${location} 2>/dev/null | head -5`);
      console.log(`${location}:`, result.success ? 'exists' : 'not accessible');
    }
  }

  /**
   * Check if Whisper is installed via pip or pipx
   */
  async checkWhisperViaPip() {
    // First check pipx installations
    const pipxCommands = [
      'pipx list',
      '/usr/local/bin/pipx list',
      '/opt/homebrew/bin/pipx list'
    ];
    
    for (const pipxCmd of pipxCommands) {
      console.log(`Checking pipx for Whisper: ${pipxCmd}`);
      const result = await this.executeCommand(pipxCmd, 5000);
      console.log(`Pipx command result - Success: ${result.success}, Output: ${result.stdout}, Error: ${result.error}`);
      
      if (result.success && result.stdout.toLowerCase().includes('whisper')) {
        console.log(`Found Whisper in pipx: ${result.stdout}`);
        return true;
      }
    }
    
    // Then check regular pip installations
    const pipCommands = [
      'pip3 list',
      '/usr/bin/pip3 list',
      '/usr/local/bin/pip3 list',
      '/opt/homebrew/bin/pip3 list',
      'python3 -m pip list',
      '/usr/bin/python3 -m pip list',
      '/usr/local/bin/python3 -m pip list',
      '/opt/homebrew/bin/python3 -m pip list'
    ];
    
    for (const pipCmd of pipCommands) {
      console.log(`Checking pip for Whisper: ${pipCmd}`);
      const result = await this.executeCommand(pipCmd, 5000);
      console.log(`Pip command result - Success: ${result.success}, Output: ${result.stdout}, Error: ${result.error}`);
      
      if (result.success && result.stdout.toLowerCase().includes('whisper')) {
        console.log(`Found Whisper in pip: ${result.stdout}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute command and check if successful
   */
  async executeCommand(command, timeout = 30000) {
    try {
      // For packaged apps, we need to ensure the PATH includes common locations
      const homeDir = process.env.HOME || os.homedir();
      const env = {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:' + homeDir + '/.local/bin'
      };
      
      const { stdout, stderr } = await execAsync(command, { 
        timeout,
        env: env,
        shell: true
      });
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
    
    // Try multiple approaches to find the executable
    let result = await this.executeCommand(dependency.command, 5000);
    
    // If the main command fails, try alternative approaches
    if (!result.success) {
      if (dependency.name === 'Homebrew') {
        // Try common Homebrew locations
        const brewPaths = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
        for (const brewPath of brewPaths) {
          console.log(`Trying Homebrew at: ${brewPath}`);
          result = await this.executeCommand(`${brewPath} --version`, 5000);
          if (result.success) {
            console.log(`Found Homebrew at ${brewPath}`);
            break;
          }
        }
      } else if (dependency.name === 'Whisper') {
        // Special handling for Whisper - it's a Python package
        console.log('Trying Whisper-specific detection methods...');
        
        // First try pip check
        console.log('Starting Whisper pip check...');
        const pipCheck = await this.checkWhisperViaPip();
        if (pipCheck) {
          result = { success: true };
          console.log('Found Whisper via pip check');
        } else {
          console.log('Pip check failed, trying import commands...');
          // Try import and module commands
          const homeDir = process.env.HOME || os.homedir();
          const whisperCommands = [
            homeDir + '/.local/bin/whisper --help 2>/dev/null',
            'whisper --help 2>/dev/null',
            'python3 -c "import whisper; print(\'whisper available\')" 2>/dev/null',
            '/usr/bin/python3 -c "import whisper; print(\'whisper available\')" 2>/dev/null',
            '/usr/local/bin/python3 -c "import whisper; print(\'whisper available\')" 2>/dev/null',
            '/opt/homebrew/bin/python3 -c "import whisper; print(\'whisper available\')" 2>/dev/null',
            'python3 -m whisper --help 2>/dev/null',
            '/usr/bin/python3 -m whisper --help 2>/dev/null',
            '/usr/local/bin/python3 -m whisper --help 2>/dev/null',
            '/opt/homebrew/bin/python3 -m whisper --help 2>/dev/null'
          ];
          
          for (const whisperCmd of whisperCommands) {
            console.log(`Trying Whisper command: ${whisperCmd}`);
            result = await this.executeCommand(whisperCmd, 5000);
            console.log(`Whisper command result - Success: ${result.success}, Output: ${result.stdout}, Error: ${result.error}`);
            
            if (result.success) {
              console.log(`Found Whisper with command: ${whisperCmd}`);
              break;
            }
          }
          
          // If all commands failed, try a simple Python import test
          if (!result.success) {
            console.log('All Whisper commands failed, trying simple import test...');
            const simpleImportCommands = [
              'python3 -c "try: import whisper; print(\'OK\')\nexcept: print(\'FAIL\')"',
              '/usr/bin/python3 -c "try: import whisper; print(\'OK\')\nexcept: print(\'FAIL\')"',
              '/usr/local/bin/python3 -c "try: import whisper; print(\'OK\')\nexcept: print(\'FAIL\')"',
              '/opt/homebrew/bin/python3 -c "try: import whisper; print(\'OK\')\nexcept: print(\'FAIL\')"'
            ];
            
            for (const simpleCmd of simpleImportCommands) {
              console.log(`Trying simple import: ${simpleCmd}`);
              result = await this.executeCommand(simpleCmd, 5000);
              console.log(`Simple import result - Success: ${result.success}, Output: ${result.stdout}, Error: ${result.error}`);
              
              if (result.success && result.stdout.trim() === 'OK') {
                console.log(`Found Whisper with simple import: ${simpleCmd}`);
                break;
              }
            }
          }
        }
      } else {
        // Try with absolute paths
        const alternativeCommands = this.getAlternativeCommands(dependency.name);
        for (const altCommand of alternativeCommands) {
          console.log(`Trying alternative command: ${altCommand}`);
          result = await this.executeCommand(altCommand, 5000);
          if (result.success) {
            console.log(`Found ${dependency.name} with alternative command`);
            break;
          }
        }
      }
    }
    
    return {
      name: dependency.name,
      installed: result.success,
      description: dependency.description,
      required: dependency.required,
      installCommand: dependency.installCommand
    };
  }

  /**
   * Get alternative commands to try for finding executables
   */
  getAlternativeCommands(toolName) {
    const homeDir = process.env.HOME || os.homedir();
    
    const commands = {
      'Python3': [
        '/usr/bin/python3 --version',
        '/usr/local/bin/python3 --version',
        '/opt/homebrew/bin/python3 --version'
      ],
      'FFmpeg': [
        '/usr/local/bin/ffmpeg -version',
        '/opt/homebrew/bin/ffmpeg -version'
      ],
      'Sox': [
        '/usr/local/bin/sox --version',
        '/opt/homebrew/bin/sox --version'
      ],
      'Ollama': [
        '/usr/local/bin/ollama --version',
        '/opt/homebrew/bin/ollama --version'
      ],
      'Whisper': [
        homeDir + '/.local/bin/whisper --help',
        '/usr/local/bin/whisper --help',
        '/opt/homebrew/bin/whisper --help',
        'whisper --help',
        'python3 -c "import whisper; print(\'whisper available\')"',
        '/usr/bin/python3 -c "import whisper; print(\'whisper available\')"',
        '/usr/local/bin/python3 -c "import whisper; print(\'whisper available\')"',
        '/opt/homebrew/bin/python3 -c "import whisper; print(\'whisper available\')"',
        'python3 -m whisper --help',
        '/usr/bin/python3 -m whisper --help',
        '/usr/local/bin/python3 -m whisper --help',
        '/opt/homebrew/bin/python3 -m whisper --help'
      ]
    };
    
    return commands[toolName] || [];
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

    // Debug environment in packaged apps
    const isPackaged = process.env.NODE_ENV === 'production' || (process.env.ELECTRON_IS_DEV !== '1' && !process.env.npm_lifecycle_event);
    if (isPackaged) {
      console.log('Running in packaged environment, debugging...');
      await this.debugEnvironment();
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

