// SystemLayer Public API
const ConfigManager = require('./ConfigManager');
const IPCManager = require('./IPCManager');
const ExternalLauncher = require('./ExternalLauncher');
const LibraryEngine = require('../LibraryEngine/index.js');
const ViewerEngine = require('../ViewerEngine/index.js');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

class SystemLayer {
  static currentWorkspace = null;
  static currentMainDirectory = null;
  static mainWindow = null;
  static viewerWindow = null;
  static viewerEngine = null;

  // Configuration
  static async checkUserData() {
    return await ConfigManager.checkUserData();
  }
  
  static async loadConfig() {
    return await ConfigManager.getConfig();
  }
  
  static async loadTheme() {
    return await ConfigManager.getTheme();
  }
  
  static async updateConfig(newConfig) {
    return await ConfigManager.updateConfig(newConfig);
  }

  /**
   * Switch to a new workspace
   * @param {string} mainDirectory - The new main directory path
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async switchWorkspace(mainDirectory) {
    try {
      // Close existing database connections
      await LibraryEngine.closeDatabase();

      // Initialize new workspace with userData path
      const userDataPath = app.getPath('userData');
      await LibraryEngine.initializeWorkspace(mainDirectory, userDataPath);

      // Update current workspace tracking
      this.currentMainDirectory = mainDirectory;
      this.currentWorkspace = LibraryEngine.getWorkspaceHash(mainDirectory);

      return { success: true };
    } catch (error) {
      console.error('Error switching workspace:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize current workspace from config
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async initializeCurrentWorkspace() {
    try {
      const activePath = await ConfigManager.getActiveLibraryPath();
      
      if (activePath) {
        const switchResult = await this.switchWorkspace(activePath);
        if (switchResult.success) {
          console.log('Initialized workspace:', activePath);
        } else {
          console.warn('Failed to initialize workspace:', switchResult.error);
        }
        return switchResult;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing current workspace:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current workspace information
   * @returns {object} - Current workspace info
   */
  static getCurrentWorkspace() {
    return {
      mainDirectory: this.currentMainDirectory,
      workspaceHash: this.currentWorkspace
    };
  }

  /**
   * Add a new library to the config
   * @param {string} name - Library name
   * @param {string} path - Library directory path
   * @returns {Promise<{success: boolean, libraryId?: string, error?: string}>}
   */
  static async addLibrary(name, path) {
    return await ConfigManager.addLibrary(name, path);
  }

  /**
   * Remove a library and optionally delete its workspace
   * @param {string} libraryId - Library ID to remove
   * @param {boolean} deleteUserData - Whether to delete workspace data
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async removeLibrary(libraryId, deleteUserData = false) {
    try {
      // Remove library from config
      const removeResult = await ConfigManager.removeLibrary(libraryId);
      if (!removeResult.success) {
        return removeResult;
      }

      const library = removeResult.library;

      // Delete workspace data if requested
      if (deleteUserData && library) {
        const workspaceHash = LibraryEngine.getWorkspaceHash(library.path);
        const userDataPath = app.getPath('userData');
        const workspacePath = path.join(userDataPath, 'workspaces', workspaceHash);

        // Close database if it's the current workspace
        if (this.currentWorkspace === workspaceHash) {
          await LibraryEngine.closeDatabase();
          this.currentWorkspace = null;
          this.currentMainDirectory = null;
        }

        // Delete workspace folder
        if (fs.existsSync(workspacePath)) {
          fs.rmSync(workspacePath, { recursive: true, force: true });
          console.log('Deleted workspace:', workspacePath);
        }
      }

      // If we removed the active library, switch to the new active library
      const config = await ConfigManager.getConfig();
      if (config.activeLibraryId && config.libraries.length > 0) {
        const newActiveLibrary = config.libraries.find(lib => lib.id === config.activeLibraryId);
        if (newActiveLibrary && newActiveLibrary.path !== this.currentMainDirectory) {
          await this.switchWorkspace(newActiveLibrary.path);
        }
      }

      return { success: true };
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
    return await ConfigManager.renameLibrary(libraryId, newName);
  }

  /**
   * Switch to a different library tab
   * @param {string} libraryId - Library ID to switch to
   * @param {object} webContents - WebContents object for reload
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async switchLibraryTab(libraryId, webContents) {
    try {
      // Set active library in config
      const setActiveResult = await ConfigManager.setActiveLibrary(libraryId);
      if (!setActiveResult.success) {
        return setActiveResult;
      }

      // Get the new library path
      const config = await ConfigManager.getConfig();
      const library = config.libraries.find(lib => lib.id === libraryId);
      if (!library) {
        return { success: false, error: 'Library not found' };
      }

      // Switch workspace (closes old DB, initializes new one)
      const switchResult = await this.switchWorkspace(library.path);
      if (!switchResult.success) {
        return switchResult;
      }

      // Reload the renderer to clear state
      if (webContents && !webContents.isDestroyed()) {
        webContents.reload();
      }

      return { success: true };
    } catch (error) {
      console.error('Error switching library tab:', error);
      return { success: false, error: error.message };
    }
  }
  
  // IPC Coordination
  static initializeIPC() {
    IPCManager.initialize(this);
  }
  
  // External Operations
  static async launchExternal(filePath, player) {
    return await ExternalLauncher.launch(filePath, player);
  }
  
  static async openExplorer() {
    return await ExternalLauncher.openDirectoryDialog();
  }
  
  // Library Operations
  static async repairLibrary(rootPath) {
    // Switch workspace first if different
    if (rootPath !== this.currentMainDirectory) {
      const switchResult = await this.switchWorkspace(rootPath);
      if (!switchResult.success) {
        return switchResult;
      }
    }
    return await LibraryEngine.syncIDs(rootPath);
  }

  static async syncLibrary(rootPath, progressCallback) {
    // Switch workspace first if different
    if (rootPath !== this.currentMainDirectory) {
      const switchResult = await this.switchWorkspace(rootPath);
      if (!switchResult.success) {
        return switchResult;
      }
    }
    return await LibraryEngine.syncLibrary(rootPath, progressCallback);
  }

  static async getActiveLibraryPath() {
    return await ConfigManager.getActiveLibraryPath();
  }

  static async loadLibrary() {
    return await LibraryEngine.loadLibrary();
  }

  static async getCollectionsWithMembers() {
    return await LibraryEngine.getCollectionsWithMembers();
  }

  // Thumbnail Operations
  static async updateThumbnailCache(progressCallback) {
    return await LibraryEngine.processImages(progressCallback);
  }

  static async resetThumbnailCache(progressCallback) {
    return await LibraryEngine.resetAndProcessImages(progressCallback);
  }

  static getUserDataPath() {
    return app.getPath('userData');
  }

  // Viewer Operations
  static async initializeViewerEngine() {
    try {
      if (!this.viewerEngine) {
        this.viewerEngine = ViewerEngine;
        const initResult = await this.viewerEngine.initialize(this);
        if (!initResult.success) {
          throw new Error(initResult.error);
        }
        console.log('SystemLayer: ViewerEngine initialized successfully');
      }
      return { success: true };
    } catch (error) {
      console.error('SystemLayer: Failed to initialize ViewerEngine', error);
      return { success: false, error: error.message };
    }
  }

  static async openViewer(mediaId, mode = 'webtoon', collectionId = null) {
    console.log('🏢 SystemLayer: openViewer called with:', { mediaId, mode, collectionId });
    console.log('🏢 SystemLayer: currentWorkspace:', !!this.currentWorkspace);
    
    try {
      // Check workspace is available
      if (!this.currentWorkspace) {
        throw new Error('No workspace selected. Please select a workspace first.');
      }

      console.log('🏢 SystemLayer: Initializing ViewerEngine...');
      // Initialize ViewerEngine if not already done
      const initResult = await this.initializeViewerEngine();
      if (!initResult.success) {
        throw new Error(initResult.error);
      }

      console.log('🏢 SystemLayer: Opening media in ViewerEngine...');
      // Open media in ViewerEngine
      const openResult = await this.viewerEngine.openMedia(mediaId);
      if (!openResult.success) {
        throw new Error(openResult.error);
      }

      console.log('🏢 SystemLayer: Setting viewer mode...');
      // Set viewing mode
      const modeResult = this.viewerEngine.setMode(mode);
      if (!modeResult.success) {
        throw new Error(modeResult.error);
      }

      console.log('🏢 SystemLayer: Creating viewer window...');
      // Create viewer window if it doesn't exist
      if (!this.viewerWindow || this.viewerWindow.isDestroyed()) {
        const { BrowserWindow } = require('electron');
        this.viewerWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          fullscreen: true,
          show: false, // Don't show until ready
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Allow file:// access
            preload: path.join(__dirname, '../../preload.js')
          },
          autoHideMenuBar: true,
          title: 'PeraPera Viewer'
        });

        // Handle window closed
        this.viewerWindow.on('closed', () => {
          console.log('🏢 SystemLayer: Viewer window closed');
          this.viewerWindow = null;
          this.cleanupViewerEngine();

          // Notify main window that viewer closed
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('viewer:closed');
          }
        });

        // Handle window ready to show
        this.viewerWindow.once('ready-to-show', () => {
          console.log('🏢 SystemLayer: Viewer window ready to show');
          // Only open developer tools in development
          if (process.env.NODE_ENV === 'development') {
            this.viewerWindow.webContents.openDevTools();
          }
          this.viewerWindow.show();
        });
      }

      console.log('🏢 SystemLayer: Building viewer URL...');
      console.log('🏢 SystemLayer: __dirname:', __dirname);
      // Build viewer URL with parameters - use app.getPath to get correct location
      const { app } = require('electron');
      const appPath = app.getAppPath();
      const viewerPath = path.join(appPath, 'dist/src/viewer.html');
      console.log('🏢 SystemLayer: appPath:', appPath);
      console.log('🏢 SystemLayer: viewerPath:', viewerPath);

      // Build URL with collectionId if provided
      let viewerUrl = `file://${viewerPath}?id=${encodeURIComponent(mediaId)}&mode=${encodeURIComponent(mode)}`;
      if (collectionId) {
        viewerUrl += `&collectionId=${encodeURIComponent(collectionId)}`;
      }
      console.log('🏢 SystemLayer: Viewer URL:', viewerUrl);

      console.log('🏢 SystemLayer: Loading viewer URL...');
      // Load viewer URL
      await this.viewerWindow.loadURL(viewerUrl);

      // Focus the window
      this.viewerWindow.focus();

      console.log(`✅ SystemLayer: Opened viewer for media ${mediaId} in ${mode} mode${collectionId ? ` with collection ${collectionId}` : ''}`);

      return {
        success: true,
        mediaId,
        mode,
        collectionId,
        windowId: this.viewerWindow.id
      };

    } catch (error) {
      console.error('💥 SystemLayer: Failed to open viewer', error);
      return { success: false, error: error.message };
    }
  }

  static closeViewer() {
    try {
      if (this.viewerWindow && !this.viewerWindow.isDestroyed()) {
        this.viewerWindow.close();
        this.viewerWindow = null;
      }
      
      this.cleanupViewerEngine();
      
      console.log('SystemLayer: Viewer closed');
      return { success: true };
    } catch (error) {
      console.error('SystemLayer: Failed to close viewer', error);
      return { success: false, error: error.message };
    }
  }

  static cleanupViewerEngine() {
    try {
      if (this.viewerEngine) {
        this.viewerEngine.closeViewer();
        console.log('SystemLayer: ViewerEngine cleaned up');
      }
    } catch (error) {
      console.error('SystemLayer: Failed to cleanup ViewerEngine', error);
    }
  }

  static async sendToViewer(channel, data) {
    try {
      if (this.viewerWindow && !this.viewerWindow.isDestroyed()) {
        this.viewerWindow.webContents.send(channel, data);
        return { success: true };
      } else {
        throw new Error('Viewer window is not available');
      }
    } catch (error) {
      console.error('SystemLayer: Failed to send to viewer', error);
      return { success: false, error: error.message };
    }
  }

  static getViewerWindowState() {
    try {
      if (this.viewerWindow && !this.viewerWindow.isDestroyed()) {
        return {
          isOpen: true,
          id: this.viewerWindow.id,
          isFocused: this.viewerWindow.isFocused(),
          isMinimized: this.viewerWindow.isMinimized(),
          isMaximized: this.viewerWindow.isMaximized(),
          isFullScreen: this.viewerWindow.isFullScreen()
        };
      } else {
        return { isOpen: false };
      }
    } catch (error) {
      console.error('SystemLayer: Failed to get viewer window state', error);
      return { isOpen: false, error: error.message };
    }
  }

  static async handleViewerNavigation(direction) {
    try {
      if (!this.viewerEngine) {
        throw new Error('ViewerEngine not initialized');
      }

      const result = await this.viewerEngine.navigate(direction);
      
      // Send updated state to viewer window
      if (result.success) {
        await this.sendToViewer('viewer:state:update', result.state);
      }
      
      return result;
    } catch (error) {
      console.error('SystemLayer: Failed to handle viewer navigation', error);
      return { success: false, error: error.message };
    }
  }

  static async handleViewerKeyboard(command) {
    try {
      if (!this.viewerEngine) {
        throw new Error('ViewerEngine not initialized');
      }

      const result = await this.viewerEngine.handleKeyboard(command);
      
      // Send updated state to viewer window
      if (result.success) {
        await this.sendToViewer('viewer:state:update', result.state);
      }
      
      return result;
    } catch (error) {
      console.error('SystemLayer: Failed to handle viewer keyboard', error);
      return { success: false, error: error.message };
    }
  }

  static getViewerState() {
    try {
      if (!this.viewerEngine) {
        throw new Error('ViewerEngine not initialized');
      }

      return this.viewerEngine.getState();
    } catch (error) {
      console.error('SystemLayer: Failed to get viewer state', error);
      return { success: false, error: error.message };
    }
  }

  static async getMediaData(mediaId) {
    try {
      if (!this.currentWorkspace) {
        throw new Error('No workspace initialized');
      }

      // Use LibraryEngine to get media data
      const mediaData = await LibraryEngine.getEntry(mediaId);
      
      if (!mediaData) {
        throw new Error('Media not found');
      }

      return {
        success: true,
        data: {
          id: mediaData.ID,
          path: mediaData.PATH,
          name: mediaData.NAME,
          type: mediaData.TYPE,
          rating: mediaData.RATING || 0,
          progress: mediaData.PROGRESS || 0,
          pageCount: mediaData.PAGE_COUNT || 1,
          dateAdded: mediaData.DATE_ADDED
        }
      };
    } catch (error) {
      console.error('SystemLayer: Failed to get media data:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SystemLayer;
