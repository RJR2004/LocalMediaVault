/**
 * NavigationEngine - Handles navigation logic for all viewing modes
 * Pure business logic - no UI dependencies
 */
class NavigationEngine {
  constructor(stateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Navigate in the specified direction based on current mode
   * @param {string} direction - Navigation direction ('next', 'previous', 'first', 'last')
   * @returns {Object} Navigation result with updated state
   */
  navigate(direction) {
    try {
      const state = this.stateManager.getState();
      
      if (!state.mediaId) {
        throw new Error('No media loaded for navigation');
      }

      console.log(`NavigationEngine: Navigating ${direction}`);
      const result = this.stateManager.navigate(direction);
      const updatedState = this.stateManager.getState();
      
      console.log(`NavigationEngine: Navigation successful`, result);
      
      return {
        success: true,
        state: updatedState,
        navigation: {
          direction,
          mode: state.mode,
          previousPage: state.currentPage,
          newPage: updatedState.currentPage
        }
      };

    } catch (error) {
      console.error('NavigationEngine: Navigation failed', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Navigate in single page mode (left-to-right)
   * @param {string} direction - Navigation direction
   * @param {Object} state - Current state
   * @returns {Object} State updates
   */
  navigateSinglePage(direction, state) {
    const updates = {};

    switch (direction) {
      case 'next':
        if (state.currentPage < state.totalPages - 1) {
          updates.currentPage = state.currentPage + 1;
        } else {
          throw new Error('Already on the last page');
        }
        break;

      case 'previous':
        if (state.currentPage > 0) {
          updates.currentPage = state.currentPage - 1;
        } else {
          throw new Error('Already on the first page');
        }
        break;

      case 'first':
        updates.currentPage = 0;
        break;

      case 'last':
        updates.currentPage = state.totalPages - 1;
        break;

      default:
        throw new Error(`Invalid navigation direction: ${direction}`);
    }

    return updates;
  }

  /**
   * Navigate in manga mode (right-to-left)
   * @param {string} direction - Navigation direction
   * @param {Object} state - Current state
   * @returns {Object} State updates
   */
  navigateManga(direction, state) {
    const updates = {};

    switch (direction) {
      case 'next':
        // In manga mode, "next" means going to the previous page number (right-to-left reading)
        if (state.currentPage > 0) {
          updates.currentPage = state.currentPage - 1;
        } else {
          throw new Error('Already on the last page (manga mode)');
        }
        break;

      case 'previous':
        // In manga mode, "previous" means going to the next page number
        if (state.currentPage < state.totalPages - 1) {
          updates.currentPage = state.currentPage + 1;
        } else {
          throw new Error('Already on the first page (manga mode)');
        }
        break;

      case 'first':
        // In manga mode, "first" means the rightmost page (highest page number)
        updates.currentPage = state.totalPages - 1;
        break;

      case 'last':
        // In manga mode, "last" means the leftmost page (page 0)
        updates.currentPage = 0;
        break;

      default:
        throw new Error(`Invalid navigation direction: ${direction}`);
    }

    return updates;
  }

  /**
   * Navigate in webtoon mode (vertical scrolling)
   * @param {string} direction - Navigation direction
   * @param {Object} state - Current state
   * @returns {Object} State updates
   */
  navigateWebtoon(direction, state) {
    const updates = {};

    switch (direction) {
      case 'next':
        if (state.currentPage < state.totalPages - 1) {
          updates.currentPage = state.currentPage + 1;
        } else {
          throw new Error('Already on the last page');
        }
        break;

      case 'previous':
        if (state.currentPage > 0) {
          updates.currentPage = state.currentPage - 1;
        } else {
          throw new Error('Already on the first page');
        }
        break;

      case 'first':
        updates.currentPage = 0;
        break;

      case 'last':
        updates.currentPage = state.totalPages - 1;
        break;

      default:
        throw new Error(`Invalid navigation direction: ${direction}`);
    }

    return updates;
  }

  /**
   * Handle keyboard navigation commands
   * @param {string} command - Keyboard command
   * @returns {Object} Navigation result
   */
  handleKeyboard(command) {
    const state = this.stateManager.getState();

    // Map keyboard commands to navigation directions
    let direction;

    switch (command) {
      case 'arrow_right':
        direction = 'next';
        break;
      case 'arrow_left':
        direction = 'previous';
        break;
      case 'arrow_up':
        direction = 'previous';
        break;
      case 'arrow_down':
        direction = 'next';
        break;
      case 'home':
        direction = 'first';
        break;
      case 'end':
        direction = 'last';
        break;
      case 'space':
        direction = 'next';
        break;
      case 'backspace':
        direction = 'previous';
        break;
      default:
        throw new Error(`Unsupported keyboard command: ${command}`);
    }

    return this.navigate(direction);
  }

  /**
   * Jump to a specific page
   * @param {number} pageNumber - Target page number
   * @returns {Object} Navigation result
   */
  jumpToPage(pageNumber) {
    try {
      const state = this.stateManager.getState();
      
      if (typeof pageNumber !== 'number' || pageNumber < 0 || pageNumber >= state.totalPages) {
        throw new Error(`Invalid page number: ${pageNumber}. Valid range: 0-${state.totalPages - 1}`);
      }

      const updates = { currentPage: pageNumber };
      const updatedState = this.stateManager.updateState(updates);
      
      console.log(`NavigationEngine: Jumped to page ${pageNumber}`, updatedState);
      
      return {
        success: true,
        state: updatedState,
        navigation: {
          direction: 'jump',
          mode: state.mode,
          previousPage: state.currentPage,
          newPage: pageNumber,
          targetPage: pageNumber
        }
      };

    } catch (error) {
      console.error('NavigationEngine: Page jump failed', error);
      return {
        success: false,
        error: error.message,
        state: this.stateManager.getState()
      };
    }
  }

  /**
   * Get navigation information for current state
   * @returns {Object} Navigation info
   */
  getNavigationInfo() {
    const state = this.stateManager.getState();
    const bounds = this.stateManager.getNavigationBounds();

    return {
      ...bounds,
      mode: state.mode,
      canNavigate: state.mediaId !== null && state.totalPages > 0,
      readingDirection: state.mode === 'manga' ? 'right-to-left' : 'left-to-right'
    };
  }

  /**
   * Check if navigation is possible in the specified direction
   * @param {string} direction - Navigation direction
   * @returns {boolean} True if navigation is possible
   */
  canNavigate(direction) {
    try {
      const state = this.stateManager.getState();

      if (!state.mediaId || state.totalPages <= 1) {
        return false;
      }

      switch (direction) {
        case 'next':
          return state.currentPage < state.totalPages - 1;

        case 'previous':
          return state.currentPage > 0;

        case 'first':
        case 'last':
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error('NavigationEngine: Failed to check navigation possibility', error);
      return false;
    }
  }
}

module.exports = NavigationEngine;
