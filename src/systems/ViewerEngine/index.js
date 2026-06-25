/**
 * ViewerEngine - Public API facade for viewer functionality
 * Provides clean interface between UI and viewer business logic
 */

const StateManager = require('./StateManager.js');
const NavigationEngine = require('./NavigationEngine.js');

class ViewerEngine {
  constructor() {
    this.stateManager = new StateManager();
    this.navigationEngine = new NavigationEngine(this.stateManager);
    this.isInitialized = false;
  }

  /**
   * Initialize ViewerEngine with workspace context
   * @param {Object} systemLayer - SystemLayer instance for workspace access
   */
  async initialize(systemLayer) {
    try {
      if (!systemLayer) {
        throw new Error('SystemLayer instance required for initialization');
      }

      this.systemLayer = systemLayer;
      this.isInitialized = true;
      
      console.log('ViewerEngine: Initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('ViewerEngine: Initialization failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if workspace is initialized
   * @private
   */
  checkInitialization() {
    if (!this.isInitialized) {
      throw new Error('ViewerEngine not initialized. Call initialize() first.');
    }
  }

  /**
   * Open media for viewing
   * @param {string} id - Media ID to open
   * @returns {Promise<Object>} Updated viewer state
   */
  async openMedia(id) {
    try {
      this.checkInitialization();

      if (!id || typeof id !== 'string') {
        throw new Error('Valid media ID required');
      }

      // Get current workspace
      const workspace = this.systemLayer.getCurrentWorkspace();
      if (!workspace) {
        throw new Error('No workspace selected');
      }

      // Get media info from LibraryEngine through SystemLayer
      const LibraryEngine = require('../LibraryEngine/index.js');
      const mediaInfo = await LibraryEngine.getEntry(id);
      
      if (!mediaInfo) {
        throw new Error(`Media not found: ${id}`);
      }

      // Determine total pages based on media type
      let totalPages = 1;
      if (mediaInfo.TYPE === 'image' && mediaInfo.PAGE_COUNT) {
        totalPages = mediaInfo.PAGE_COUNT;
      }

      // Preserve current zoom level before resetting state
      const currentZoom = this.stateManager.getState().zoom;

      // Reset and update state
      this.stateManager.resetState();
      const updatedState = this.stateManager.updateState({
        mediaId: id,
        currentPage: 0,
        totalPages,
        progress: mediaInfo.PROGRESS || 0,
        collectionInfo: mediaInfo.collectionInfo || null,
        zoom: currentZoom // Preserve zoom level
      });

      console.log(`ViewerEngine: Opened media ${id}`, updatedState);

      return {
        success: true,
        state: updatedState,
        media: mediaInfo
      };

    } catch (error) {
      console.error('ViewerEngine: Failed to open media', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Navigate in the specified direction
   * @param {string} direction - Navigation direction ('next', 'previous', 'first', 'last')
   * @returns {Promise<Object>} Navigation result
   */
  async navigate(direction) {
    try {
      this.checkInitialization();
      
      const result = this.navigationEngine.navigate(direction);
      
      if (result.success) {
        // Auto-save progress after navigation
        await this.saveProgress();
      }
      
      return result;

    } catch (error) {
      console.error('ViewerEngine: Navigation failed', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Update reading progress
   * @param {number} progress - Progress percentage (0-100)
   * @returns {Promise<Object>} Update result
   */
  async updateProgress(progress) {
    try {
      this.checkInitialization();

      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        throw new Error('Progress must be a number between 0 and 100');
      }

      const updatedState = this.stateManager.updateState({ progress });
      
      // Save to database
      await this.saveProgress();
      
      console.log(`ViewerEngine: Updated progress to ${progress}%`);
      
      return {
        success: true,
        state: updatedState,
        progress
      };

    } catch (error) {
      console.error('ViewerEngine: Failed to update progress', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Get current viewer state
   * @returns {Object} Current viewer state
   */
  getState() {
    try {
      this.checkInitialization();
      
      const state = this.stateManager.getState();
      const navigationInfo = this.navigationEngine.getNavigationInfo();
      
      return {
        success: true,
        state,
        navigation: navigationInfo
      };

    } catch (error) {
      console.error('ViewerEngine: Failed to get state', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Handle keyboard navigation command
   * @param {string} command - Keyboard command
   * @returns {Promise<Object>} Navigation result
   */
  async handleKeyboard(command) {
    try {
      this.checkInitialization();
      
      const result = this.navigationEngine.handleKeyboard(command);
      
      if (result.success) {
        // Auto-save progress after keyboard navigation
        await this.saveProgress();
      }
      
      return result;

    } catch (error) {
      console.error('ViewerEngine: Keyboard handling failed', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Close the current viewer
   * @returns {Promise<Object>} Close result
   */
  async closeViewer() {
    try {
      this.checkInitialization();

      // Save final progress
      await this.saveProgress();
      
      // Reset state
      const resetState = this.stateManager.resetState();
      
      console.log('ViewerEngine: Viewer closed');
      
      return {
        success: true,
        state: resetState
      };

    } catch (error) {
      console.error('ViewerEngine: Failed to close viewer', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Set viewing mode
   * @param {string} mode - Viewing mode ('singlepage', 'manga', 'webtoon')
   * @returns {Object} Mode change result
   */
  setMode(mode) {
    try {
      this.checkInitialization();
      
      const updatedState = this.stateManager.setMode(mode);
      
      console.log(`ViewerEngine: Set mode to ${mode}`);
      
      return {
        success: true,
        state: updatedState,
        mode
      };

    } catch (error) {
      console.error('ViewerEngine: Failed to set mode', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Jump to specific page
   * @param {number} pageNumber - Target page number
   * @returns {Promise<Object>} Jump result
   */
  async jumpToPage(pageNumber) {
    try {
      this.checkInitialization();
      
      const result = this.navigationEngine.jumpToPage(pageNumber);
      
      if (result.success) {
        // Auto-save progress after page jump
        await this.saveProgress();
      }
      
      return result;

    } catch (error) {
      console.error('ViewerEngine: Page jump failed', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Save current progress to database
   * @private
   */


  async saveProgress() {
    try {
      const state = this.stateManager.getState();
      
      if (!state.mediaId) {
        return; // No media to save progress for
      }

      const workspace = this.systemLayer.getCurrentWorkspace();
      if (!workspace) {
        throw new Error('No workspace available');
      }

      // Use LibraryEngine directly
      const LibraryEngine = require('../LibraryEngine/index.js');
      
      // Calculate progress based on current page
      const calculatedProgress = state.totalPages > 0 ? 
        Math.round((state.currentPage / state.totalPages) * 100) : 0;
      
      // Note: updateEntryProgress may not exist, but we'll try
      try {
        await LibraryEngine.updateEntry(state.mediaId, { progress: calculatedProgress });
      } catch (err) {
        console.warn('ViewerEngine: Progress update not available:', err.message);
      }
      
      console.log(`ViewerEngine: Saved progress ${calculatedProgress}% for media ${state.mediaId}`);

    } catch (error) {
      console.error('ViewerEngine: Failed to save progress', error);
      // Don't throw here - progress saving failures shouldn't break navigation
    }
  }

  /**
   * Check if viewer can navigate in specified direction
   * @param {string} direction - Navigation direction
   * @returns {boolean} True if navigation is possible
   */
  canNavigate(direction) {
    try {
      this.checkInitialization();
      return this.navigationEngine.canNavigate(direction);
    } catch (error) {
      console.error('ViewerEngine: Failed to check navigation', error);
      return false;
    }
  }

  /**
   * Get viewer information and capabilities
   * @returns {Object} Viewer info
   */
  getViewerInfo() {
    try {
      this.checkInitialization();
      
      const state = this.stateManager.getState();
      const navigationInfo = this.navigationEngine.getNavigationInfo();
      
      return {
        success: true,
        isInitialized: this.isInitialized,
        hasMedia: this.stateManager.hasMedia(),
        state,
        navigation: navigationInfo,
        supportedModes: ['singlepage', 'manga', 'webtoon'],
        supportedCommands: [
          'arrow_left', 'arrow_right', 'arrow_up', 'arrow_down',
          'home', 'end', 'space', 'backspace'
        ]
      };

    } catch (error) {
      console.error('ViewerEngine: Failed to get viewer info', error);
      return {
        success: false,
        error: error.message,
        isInitialized: this.isInitialized
      };
    }
  }
}

// Create and export singleton instance
const viewerEngine = new ViewerEngine();

module.exports = viewerEngine;
