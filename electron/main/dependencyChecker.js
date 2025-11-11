const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const Config = require('./config');
const { log } = require('console');

const execAsync = promisify(exec);

// Static dependencies list - shared across all instances
const DEPENDENCIES = [
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
    verifyCommand: '-h',
  },
];

/**
 * Dependency checker and installer
 */
class DependencyChecker {
  constructor() {
    this.platform = os.platform();
    this._cachedPath = null;
  }

  /**
   * Get the dependencies list (static, shared across all instances)
   */
  static get dependencies() {
    return DEPENDENCIES;
  }

  isMacOS() {
    return this.platform === 'darwin';
  }

  getStoredPath(dependencyName) {
    const paths = Config.get('dependencyPaths') || {};
    return paths[dependencyName] || null;
  }

  storePath(dependencyName, path) {
    const paths = Config.get('dependencyPaths') || {};
    paths[dependencyName] = path;
    console.log('storing path', dependencyName, path);
    Config.set('dependencyPaths', paths);
    console.log('clearing cache');
    this.clearPathCache();
    console.log('cache cleared');
  }

  async findDependencyPath(whichCommand) {
    if (!whichCommand) {
      return null;
    }

    // Use executeCommand with allowDiscovery=true to use system PATH
    // This allows finding commands in common installation locations
    const result = await this.executeCommand(
      `/usr/bin/which ${whichCommand}`,
      5000,
      true // allowDiscovery = true
    );

    if (result.success && result.stdout && result.stdout.trim()) {
      return result.stdout.trim();
    }

    return null;
  }

  buildPathFromStoredPaths() {
    // Return cached path if available
    if (this._cachedPath !== null) {
      return this._cachedPath;
    }

    const dependencyPaths = Config.get('dependencyPaths') || {};
    const pathDirs = new Set();

    Object.values(dependencyPaths).forEach((depPath) => {
      if (depPath && path.isAbsolute(depPath)) {
        const dir = path.dirname(depPath);
        pathDirs.add(dir);
      }
    });

    // Convert to array and join
    const storedPath = Array.from(pathDirs).join(':');

    // If no stored paths exist, throw error to redirect to settings
    if (!storedPath) {
      throw new Error(
        'Dependencies not configured. Please go to Settings and check dependencies to update configuration.'
      );
    }

    // Cache the path
    this._cachedPath = storedPath;
    return storedPath;
  }

  /**
   * Clear cached PATH (call this when dependency paths are updated)
   */
  clearPathCache() {
    this._cachedPath = null;
  }

  async executeCommand(command, timeout = 30000) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        shell: true,
      });
      return { success: true, stdout, stderr };
    } catch (error) {
      console.log('error', error);
      if (
        error.message &&
        error.message.includes('Dependencies not configured')
      ) {
        return {
          success: false,
          error: error.message,
          code: 'DEPENDENCIES_NOT_CONFIGURED',
          requiresSettingsRedirect: true,
        };
      }
      return { success: false, error: error.message, code: error.code };
    }
  }

  getCommandPath(dependencyName) {
    const storedPath = this.getStoredPath(dependencyName);
    if (storedPath) {
      return storedPath;
    }

    // Fallback to dependency name if no stored path
    const dep = DependencyChecker.dependencies.find(
      (d) => d.name === dependencyName
    );
    return dep?.whichCommand || dependencyName.toLowerCase();
  }

  async checkDependency(dependency) {
    let installed = false;
    let path = null;
    let justDiscovered = false;

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

  async checkAll(progressCallback) {
    if (!this.isMacOS()) {
      return {
        success: false,
        error: 'Automatic dependency installation is only supported on macOS',
      };
    }

    const results = [];
    const total = DependencyChecker.dependencies.length;

    for (let i = 0; i < DependencyChecker.dependencies.length; i++) {
      const dep = DependencyChecker.dependencies[i];

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
      const fullDep = DependencyChecker.dependencies.find(
        (d) => d.name === dep.name
      );

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

  async checkOllamaRunning() {
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:11434/api/tags', {
        timeout: 3000,
      });
      return { running: true, models: response.data.models || [] };
    } catch {
      return { running: false };
    }
  }

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
