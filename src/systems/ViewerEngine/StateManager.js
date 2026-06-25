/**
 * StateManager - Manages viewer state for all viewing modes
 * Pure business logic - no UI dependencies
 */
class StateManager {
  constructor() {
    this.state = {
      mediaId: null,
      mode: 'singlepage',
      currentPage: 0,
      totalPages: 0,
      progress: 0,
      zoom: 1.0,
      isFullscreen: false,
      showControls: true,
      collectionInfo: null,
      mangaMode: false
    };
  }

  /**
   * Get current viewer state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state with validation
   * @param {Object} updates - State updates to merge
   * @returns {Object} Updated state
   */
  updateState(updates) {
    try {
      // Validate updates
      const validatedUpdates = this.validateStateUpdates(updates);
      
      // Merge updates into current state
      this.state = { ...this.state, ...validatedUpdates };
      
      console.log('StateManager: State updated', this.state);
      return this.getState();
    } catch (error) {
      console.error('StateManager: Failed to update state', error);
      throw new Error(`State update failed: ${error.message}`);
    }
  }

  /**
   * Set viewing mode with validation
   * @param {string} mode - Viewing mode ('singlepage', 'manga', 'webtoon')
   * @returns {Object} Updated state
   */
  setMode(mode) {
    const validModes = ['singlepage', 'manga', 'webtoon'];
    
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
    }

    const updates = { mode };
    
    // Adjust mangaMode flag based on mode
    if (mode === 'manga') {
      updates.mangaMode = true;
    } else {
      updates.mangaMode = false;
    }

    return this.updateState(updates);
  }

  /**
   * Reset state to defaults
   * @returns {Object} Reset state
   */
  resetState() {
    this.state = {
      mediaId: null,
      mode: 'singlepage',
      currentPage: 0,
      totalPages: 0,
      progress: 0,
      zoom: 1.0,
      isFullscreen: false,
      showControls: true,
      collectionInfo: null,
      mangaMode: false
    };
    
    console.log('StateManager: State reset to defaults');
    return this.getState();
  }

  /**
   * Validate state updates
   * @param {Object} updates - Updates to validate
   * @returns {Object} Validated updates
   */
  validateStateUpdates(updates) {
    const validated = {};

    // Validate mediaId
    if (updates.mediaId !== undefined) {
      if (updates.mediaId !== null && typeof updates.mediaId !== 'string') {
        throw new Error('mediaId must be a string or null');
      }
      validated.mediaId = updates.mediaId;
    }

    // Validate mode
    if (updates.mode !== undefined) {
      const validModes = ['singlepage', 'manga', 'webtoon'];
      if (!validModes.includes(updates.mode)) {
        throw new Error(`Invalid mode: ${updates.mode}`);
      }
      validated.mode = updates.mode;
    }

    // Validate currentPage
    if (updates.currentPage !== undefined) {
      if (typeof updates.currentPage !== 'number' || updates.currentPage < 0) {
        throw new Error('currentPage must be a non-negative number');
      }
      validated.currentPage = updates.currentPage;
    }

    // Validate totalPages
    if (updates.totalPages !== undefined) {
      if (typeof updates.totalPages !== 'number' || updates.totalPages < 0) {
        throw new Error('totalPages must be a non-negative number');
      }
      validated.totalPages = updates.totalPages;
    }

    // Validate progress
    if (updates.progress !== undefined) {
      if (typeof updates.progress !== 'number' || updates.progress < 0 || updates.progress > 100) {
        throw new Error('progress must be a number between 0 and 100');
      }
      validated.progress = updates.progress;
    }

    // Validate zoom
    if (updates.zoom !== undefined) {
      if (typeof updates.zoom !== 'number' || updates.zoom <= 0) {
        throw new Error('zoom must be a positive number');
      }
      validated.zoom = updates.zoom;
    }

    // Validate boolean properties
    ['isFullscreen', 'showControls', 'mangaMode'].forEach(prop => {
      if (updates[prop] !== undefined) {
        if (typeof updates[prop] !== 'boolean') {
          throw new Error(`${prop} must be a boolean`);
        }
        validated[prop] = updates[prop];
      }
    });

    // Validate collectionInfo
    if (updates.collectionInfo !== undefined) {
      if (updates.collectionInfo !== null && typeof updates.collectionInfo !== 'object') {
        throw new Error('collectionInfo must be an object or null');
      }
      validated.collectionInfo = updates.collectionInfo;
    }

    return validated;
  }

  /**
   * Check if viewer has valid media loaded
   * @returns {boolean} True if media is loaded
   */
  hasMedia() {
    return this.state.mediaId !== null;
  }

  /**
   * Check if current page is within bounds
   * @returns {boolean} True if current page is valid
   */
  isCurrentPageValid() {
    return this.state.currentPage >= 0 && 
           this.state.currentPage < this.state.totalPages;
  }

  /**
   * Get navigation bounds info
   * @returns {Object} Navigation bounds
   */
  getNavigationBounds() {
    return {
      canGoPrevious: this.state.currentPage > 0,
      canGoNext: this.state.currentPage < this.state.totalPages - 1,
      isFirstPage: this.state.currentPage === 0,
      isLastPage: this.state.currentPage === this.state.totalPages - 1,
      totalPages: this.state.totalPages,
      currentPage: this.state.currentPage
    };
  }

  /**
   * Navigate to a different page based on direction and mode
   * @param {string} direction - Navigation direction ('next', 'prev', 'first', 'last')
   * @returns {Object} Navigation result
   */
  navigate(direction) {
    const { currentPage, totalPages, mode } = this.state;
    let newPage = currentPage;

    console.log(`StateManager: Navigation attempt - current: ${currentPage}, total: ${totalPages}, direction: ${direction}, mode: ${mode}`);

    switch (direction) {
      case 'next':
        // Next page (0-based, so max is totalPages-1)
        newPage = Math.min(totalPages - 1, currentPage + 1);
        break;

      case 'prev':
      case 'previous':
        // Previous page
        newPage = Math.max(0, currentPage - 1);
        break;

      case 'first':
        newPage = 0;
        break;

      case 'last':
        newPage = totalPages - 1;
        break;
    }

    // Validate bounds
    if (newPage < 0 || newPage >= totalPages) {
      console.warn(`StateManager: Navigation failed - invalid page ${newPage} (total: ${totalPages})`);
      throw new Error(`Cannot navigate ${direction} - invalid page ${newPage}`);
    }

    this.setPage(newPage);
    return {
      direction,
      oldPage: currentPage,
      newPage,
      totalPages,
      mode
    };
  }

  /**
   * Set current page with validation
   * @param {number} page - Page number (0-based)
   * @returns {Object} Updated state
   */
  setPage(page) {
    if (typeof page !== 'number' || page < 0 || page >= this.state.totalPages) {
      throw new Error(`Invalid page number: ${page}. Valid range: 0-${this.state.totalPages - 1}`);
    }

    return this.updateState({ currentPage: page });
  }
}

module.exports = StateManager;
