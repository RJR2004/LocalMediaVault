// ConfigManager - Configuration file management


const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

// ConfigManager - Configuration file management
class ConfigManager {
  static async checkUserData() {
    try {
      // Use Electron's built-in userData directory
      const userDataPath = app.getPath('userData');
      const configFolderPath = path.join(userDataPath, 'UserData');
      
      // Create UserData folder if it doesn't exist
      try {
        await fs.access(configFolderPath);
      } catch {
        await fs.mkdir(configFolderPath, { recursive: true });
        console.log('Created UserData folder:', configFolderPath);
      }
      
      // Create config.json if it doesn't exist
      const configPath = path.join(configFolderPath, 'config.json');
      try {
        await fs.access(configPath);
      } catch {
        const defaultConfig = {
          libraries: [],
          activeLibraryId: null,
          theme: 'light',
          language: 'en',
          lastUpdated: new Date().toISOString(),
          scrollTimeMs: 300,
          scrollDistanceMultiplier: 0.5,
          showGridCaptions: true,
          showGridRatings: false,
          sortOrder: 'asc',
          sortBy: 'name',
          itemsPerPage: 50,
          viewerMode: 'singlepage',
          filters: ['standalone', 'collections', 'series']
        };
        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log('Created config.json:', configPath);
      }
      
      // Create theme.json if it doesn't exist
      const themePath = path.join(configFolderPath, 'theme.json');
      try {
        await fs.access(themePath);
      } catch {
        const defaultTheme = {
          'theme.background.dark': '30,30,30',
          'theme.background.medium': '50,50,50',
          'theme.background.light': '60,60,60',
          'theme.border.color': '80,80,80',
          'theme.text.primary': '255,255,255',
          'theme.text.secondary': '211,211,211',
          'theme.accent.color': '0,255,255',
          'theme.overlay.color': '0,0,0,180',
          'theme.input.background': '50,50,50',
          'theme.collection.auto.border': '0,100,200',
          'theme.collection.manual.border': '60,120,60',
          'theme.collection.auto.label': '100,180,255',
          'theme.collection.manual.label': '0,255,255',
          'theme.rating.unrated': '128,128,128',
          'theme.rating.rated': '255,255,0',
          'theme.progress.bar': '100,150,255',
          'theme.placeholder.text': '128,128,128',
          'theme.success.color': '0,120,0',
          'theme.error.color': '150,0,0',
          'theme.warning.color': '150,100,0',
          'theme.highlight.color': '120,120,120'
        };
        await fs.writeFile(themePath, JSON.stringify(defaultTheme, null, 2));
        console.log('Created theme.json:', themePath);
      }
      
      return { success: true, path: configFolderPath };
    } catch (error) {
      console.error('Error in checkUserData:', error);
      return { success: false, error: error.message };
    }
  }
  
  static async getConfig() {
    try {
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'UserData', 'config.json');
      const data = await fs.readFile(configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading config:', error);
      return null;
    }
  }
  
  static async getTheme() {
    try {
      const userDataPath = app.getPath('userData');
      const themePath = path.join(userDataPath, 'UserData', 'theme.json');
      const data = await fs.readFile(themePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading theme:', error);
      return null;
    }
  }
  
  static async updateConfig(newConfig) {
    try {
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'UserData', 'config.json');
      
      // Read existing config
      let existingConfig = {};
      try {
        const data = await fs.readFile(configPath, 'utf8');
        existingConfig = JSON.parse(data);
      } catch (error) {
        console.log('No existing config found, creating new one');
      }
      
      // Merge with new config
      const updatedConfig = { ...existingConfig, ...newConfig, lastUpdated: new Date().toISOString() };
      
      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
      console.log('Config updated successfully');
      return { success: true, config: updatedConfig };
    } catch (error) {
      console.error('Error updating config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the path of the currently active library
   * @returns {Promise<string|null>} - Path of active library or null
   */
  static async getActiveLibraryPath() {
    try {
      const config = await this.getConfig();
      
      // Migrate old mainPath format if needed
      if (config.mainPath && !config.libraries) {
        await this.migrateFromMainPath(config.mainPath);
        return config.mainPath;
      }
      
      if (!config.libraries || !config.activeLibraryId) {
        return null;
      }
      
      const activeLibrary = config.libraries.find(lib => lib.id === config.activeLibraryId);
      return activeLibrary ? activeLibrary.path : null;
    } catch (error) {
      console.error('Error getting active library path:', error);
      return null;
    }
  }

  /**
   * Add a new library to the config
   * @param {string} name - Library name
   * @param {string} path - Library directory path
   * @returns {Promise<{success: boolean, libraryId?: string, error?: string}>}
   */
  static async addLibrary(name, path) {
    try {
      const config = await this.getConfig();
      
      // Initialize libraries array if it doesn't exist
      if (!config.libraries) {
        config.libraries = [];
      }
      
      // Check if library with this path already exists
      const existingLibrary = config.libraries.find(lib => lib.path === path);
      if (existingLibrary) {
        return { success: false, error: 'Library with this path already exists' };
      }
      
      // Generate UUID for new library
      const libraryId = crypto.randomUUID();
      
      // Add new library
      config.libraries.push({
        id: libraryId,
        name: name,
        path: path
      });
      
      // Set as active if it's the first library
      if (!config.activeLibraryId) {
        config.activeLibraryId = libraryId;
      }
      
      // Update config
      await this.updateConfig({ libraries: config.libraries, activeLibraryId: config.activeLibraryId });
      
      return { success: true, libraryId };
    } catch (error) {
      console.error('Error adding library:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set the active library by ID
   * @param {string} libraryId - Library ID to set as active
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async setActiveLibrary(libraryId) {
    try {
      const config = await this.getConfig();
      
      // Verify library exists
      if (!config.libraries || !config.libraries.find(lib => lib.id === libraryId)) {
        return { success: false, error: 'Library not found' };
      }
      
      // Update active library ID
      await this.updateConfig({ activeLibraryId: libraryId });
      
      return { success: true };
    } catch (error) {
      console.error('Error setting active library:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a library by ID
   * @param {string} libraryId - Library ID to remove
   * @returns {Promise<{success: boolean, error?: string, library?: object}>}
   */
  static async removeLibrary(libraryId) {
    try {
      const config = await this.getConfig();
      
      // Verify library exists
      const libraryIndex = config.libraries.findIndex(lib => lib.id === libraryId);
      if (libraryIndex === -1) {
        return { success: false, error: 'Library not found' };
      }
      
      const library = config.libraries[libraryIndex];
      
      // Remove library from array
      config.libraries.splice(libraryIndex, 1);
      
      // If this was the active library, set a new active library
      if (config.activeLibraryId === libraryId) {
        config.activeLibraryId = config.libraries.length > 0 ? config.libraries[0].id : null;
      }
      
      // Update config
      await this.updateConfig({ libraries: config.libraries, activeLibraryId: config.activeLibraryId });
      
      return { success: true, library };
    } catch (error) {
      console.error('Error removing library:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rename a library
   * @param {string} libraryId - Library ID to rename
   * @param {string} newName - New library name
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async renameLibrary(libraryId, newName) {
    try {
      const config = await this.getConfig();
      
      // Verify library exists
      const library = config.libraries.find(lib => lib.id === libraryId);
      if (!library) {
        return { success: false, error: 'Library not found' };
      }
      
      // Update library name
      library.name = newName;
      
      // Update config
      await this.updateConfig({ libraries: config.libraries });
      
      return { success: true };
    } catch (error) {
      console.error('Error renaming library:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Migrate old mainPath config to new libraries array format
   * @param {string} mainPath - Old mainPath value
   * @returns {Promise<void>}
   */
  static async migrateFromMainPath(mainPath) {
    try {
      console.log('Migrating from mainPath to libraries array format');
      
      // Generate library name from path
      const pathParts = mainPath.split(path.sep);
      const name = pathParts[pathParts.length - 1] || 'Library';
      
      // Add library
      const result = await this.addLibrary(name, mainPath);
      
      if (result.success) {
        // Remove old mainPath from config
        await this.updateConfig({ mainPath: undefined });
        console.log('Migration successful');
      }
    } catch (error) {
      console.error('Error migrating from mainPath:', error);
    }
  }

  /**
   * Generate workspace hash for directory identification
   * @param {string} mainDirectory - The main directory path
   * @returns {string} - Hash of the directory path
   */
  static generateWorkspaceHash(mainDirectory) {
    return crypto.createHash('sha256').update(mainDirectory).digest('hex').substring(0, 16);
  }

  }

module.exports = ConfigManager;
