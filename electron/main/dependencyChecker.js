const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const Config = require('./config');

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
        whichCommand: 'brew',
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
        required: true,
        description: 'Package manager for macOS',
        verifyCommand: '--version',
      },
      {
        name: 'Python3',
        whichCommand: 'python3',
        installCommand: 'brew install python3',
        required: true,
        description: 'Python 3 runtime (required for Whisper)',
        verifyCommand: '--version',
      },
      {
        name: 'FFmpeg',
        whichCommand: 'ffmpeg',
        installCommand: 'brew install ffmpeg',
        required: true,
        description: 'Audio/video processing tool',
        verifyCommand: '-version',
      },
      {
        name: 'Sox',
        whichCommand: 'sox',
        installCommand: 'brew install sox',
        required: true,
        description: 'Sound processing tool',
        verifyCommand: '--version',
      },
      {
        name: 'Ollama',
        whichCommand: 'ollama',
        installCommand: 'brew install ollama',
        required: true,
        description: 'Local LLM runtime',
        verifyCommand: '--version',
      },
      {
        name: 'Whisper',
        whichCommand: 'whisper',
        installCommand: 'pip3 install -U openai-whisper',
        required: true,
        description: 'Speech-to-text transcription',
        verifyCommand: "-h | grep 'usage'",
      },
    ];
  }

  /**
   * Check if running on macOS
   */
  isMacOS() {
    return this.platform === 'darwin';
  }

  /**
   * Get stored path for a dependency
   */
  getStoredPath(dependencyName) {
    const paths = Config.get('dependencyPaths') || {};
    return paths[dependencyName] || null;
  }

  /**
   * Store path for a dependency
   */
  storePath(dependencyName, path) {
    const paths = Config.get('dependencyPaths') || {};
    paths[dependencyName] = path;
    Config.set('dependencyPaths', paths);
  }

  /**
   * Find path of a dependency using which command
   */
  async findDependencyPath(whichCommand) {
    if (!whichCommand) {
      return null;
    }

    const result = await this.executeCommand(`which ${whichCommand}`, 5000);
    if (result.success && result.stdout.trim()) {
      return result.stdout.trim();
    }
    return null;
  }

  /**
   * Execute command and check if successful
   */
  async executeCommand(command, timeout = 30000) {
    try {
      const homeDir = process.env.HOME || os.homedir();
      let pathToAdd = '';

      // If command uses an absolute path (stored path), add its directory to PATH
      // This handles subprocess calls from the command
      const pathMatch = command.match(/^["']?(\/[^"'\s]+)/);
      if (pathMatch) {
        const absPath = pathMatch[1];
        const pathDir = path.dirname(absPath);
        pathToAdd = `${pathDir}:`;
      }

      // For 'which' commands or commands without absolute paths, include common locations
      if (command.startsWith('which ') || !pathToAdd) {
        const commonPaths = '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin';
        const userLocalBin = `${homeDir}/.local/bin`;
        pathToAdd = `${commonPaths}:${userLocalBin}:`;
      }

      const env = {
        ...process.env,
        PATH: `${pathToAdd}${process.env.PATH || ''}`,
      };

      const { stdout, stderr } = await execAsync(command, {
        timeout,
        env: env,
        shell: true,
      });
      return { success: true, stdout, stderr };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  }

  /**
   * Get command path for a dependency (uses stored path if available)
   */
  getCommandPath(dependencyName) {
    const storedPath = this.getStoredPath(dependencyName);
    if (storedPath) {
      return storedPath;
    }

    // Fallback to dependency name if no stored path
    const dep = this.dependencies.find((d) => d.name === dependencyName);
    return dep?.whichCommand || dependencyName.toLowerCase();
  }

  /**
   * Check if a single dependency is installed
   */
  async checkDependency(dependency) {
    let installed = false;
    let path = null;
    // Check if we already have a stored path
    path = this.getStoredPath(dependency.name);

    if (!path) {
      // Find the path using which
      path = await this.findDependencyPath(dependency.whichCommand);
      if (path) {
        this.storePath(dependency.name, path);
      }
    }

    // Verify the dependency is working
    if (path && dependency.verifyCommand) {
      const result = await this.executeCommand(
        `${path} ${dependency.verifyCommand}`,
        5000
      );
      installed = result.success;
    } else {
      installed = path !== null;
    }

    return {
      name: dependency.name,
      installed: installed,
      description: dependency.description,
      required: dependency.required,
      installCommand: dependency.installCommand,
    };
  }

  /**
   * Check all dependencies
   */
  async checkAll(progressCallback) {
    if (!this.isMacOS()) {
      return {
        success: false,
        error: 'Automatic dependency installation is only supported on macOS',
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
          progress: ((i + 1) / total) * 100,
        });
      }

      const result = await this.checkDependency(dep);
      results.push(result);

      // Small delay for UI update
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const missing = results.filter((r) => !r.installed);

    return {
      success: true,
      results: results,
      missing: missing,
      allInstalled: missing.length === 0,
    };
  }

  /**
   * Install a single dependency
   */
  async installDependency(dependency, progressCallback) {
    try {
      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dependency.name,
          status: 'in-progress',
        });
      }

      // Special handling for Homebrew
      if (dependency.name === 'Homebrew') {
        // Homebrew installation is interactive, so we need to handle it differently
        const result = await this.executeCommand(
          dependency.installCommand,
          300000
        );

        if (!result.success) {
          throw new Error(
            `Failed to install ${dependency.name}: ${result.error}`
          );
        }
      } else {
        // For other packages, use brew or pip
        const result = await this.executeCommand(
          dependency.installCommand,
          300000
        );

        if (!result.success) {
          throw new Error(
            `Failed to install ${dependency.name}: ${result.error}`
          );
        }
      }

      // Verify installation and refresh stored path
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const verifyResult = await this.checkDependency(dependency);

      if (!verifyResult.installed) {
        throw new Error(
          `Installation appeared to succeed but ${dependency.name} is still not available`
        );
      }

      // Clear stored path to force re-discovery after installation
      if (dependency.name !== 'Whisper') {
        const paths = Config.get('dependencyPaths') || {};
        delete paths[dependency.name];
        Config.set('dependencyPaths', paths);
      }

      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dependency.name,
          status: 'success',
        });
      }

      return { success: true };
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          step: 'installing',
          dependency: dependency.name,
          status: 'error',
          error: error.message,
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
          status: 'starting',
        });
      }

      // Find the full dependency object
      const fullDep = this.dependencies.find((d) => d.name === dep.name);

      const result = await this.installDependency(fullDep, progressCallback);
      results.push({
        name: dep.name,
        success: result.success,
        error: result.error,
      });

      if (!result.success) {
        // Continue with other installations even if one fails
      }

      // Small delay between installations
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const failed = results.filter((r) => !r.success);

    return {
      success: failed.length === 0,
      results: results,
      failed: failed,
    };
  }

  /**
   * Check if Ollama is running
   */
  async checkOllamaRunning() {
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:11434/api/tags', {
        timeout: 3000,
      });
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
          status: 'in-progress',
        });
      }

      // Start Ollama in the background using stored path
      const ollamaPath = this.getCommandPath('Ollama');
      exec(`${ollamaPath} serve > /dev/null 2>&1 &`);

      // Wait for Ollama to start (check every second for up to 10 seconds)
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const status = await this.checkOllamaRunning();
        if (status.running) {
          if (progressCallback) {
            progressCallback({
              step: 'starting-ollama',
              status: 'success',
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
          error: error.message,
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
          status: 'in-progress',
        });
      }

      const ollamaPath = this.getCommandPath('Ollama');
      const result = await this.executeCommand(
        `${ollamaPath} pull ${modelName}`,
        600000
      );

      if (!result.success) {
        throw new Error(`Failed to pull model ${modelName}: ${result.error}`);
      }

      if (progressCallback) {
        progressCallback({
          step: 'pulling-model',
          model: modelName,
          status: 'success',
        });
      }

      return { success: true };
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          step: 'pulling-model',
          model: modelName,
          status: 'error',
          error: error.message,
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
          message: 'Checking for installed dependencies...',
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
            missing: checkResults.missing,
          });
        }

        const installResults = await this.installMissing(
          checkResults.missing,
          progressCallback
        );

        if (!installResults.success) {
          return {
            success: false,
            error: 'Some dependencies failed to install',
            details: installResults.failed,
          };
        }
      } else {
        if (progressCallback) {
          progressCallback({
            phase: 'complete',
            message: 'All dependencies are already installed!',
          });
        }
      }

      // Step 3: Check if Ollama is running
      if (progressCallback) {
        progressCallback({
          phase: 'ollama-check',
          message: 'Checking Ollama service...',
        });
      }

      const ollamaStatus = await this.checkOllamaRunning();

      if (!ollamaStatus.running) {
        if (progressCallback) {
          progressCallback({
            phase: 'ollama-start',
            message: 'Starting Ollama service...',
          });
        }

        const startResult = await this.startOllama(progressCallback);

        if (!startResult.success) {
          return {
            success: false,
            warning:
              'Dependencies installed but Ollama service failed to start',
            error: startResult.error,
          };
        }
      }

      // Step 4: Pull the model if needed
      if (progressCallback) {
        progressCallback({
          phase: 'model-check',
          message: `Checking for ${modelName} model...`,
        });
      }

      const modelStatus = await this.checkOllamaRunning();
      const hasModel =
        modelStatus.models &&
        modelStatus.models.some((m) => m.name.includes(modelName));

      if (!hasModel) {
        if (progressCallback) {
          progressCallback({
            phase: 'model-pull',
            message: `Downloading ${modelName} model (this may take a while)...`,
          });
        }

        const pullResult = await this.pullOllamaModel(
          modelName,
          progressCallback
        );

        if (!pullResult.success) {
          return {
            success: false,
            warning: 'Dependencies installed but model download failed',
            error: pullResult.error,
          };
        }
      }

      // All done!
      if (progressCallback) {
        progressCallback({
          phase: 'complete',
          message: 'All dependencies are installed and ready!',
        });
      }

      return {
        success: true,
        message: 'All dependencies successfully installed and configured',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = DependencyChecker;
