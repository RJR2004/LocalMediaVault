// IPCManager - Centralized IPC handling for all renderer-to-main communication
const { ipcMain } = require('electron');

class IPCManager {
  /**
   * Initialize all IPC handlers
   * @param {object} systemLayer - The SystemLayer facade instance to delegate calls to
   */
  static initialize(systemLayer) {
    this.registerConfigHandlers(systemLayer);
    this.registerDirectoryHandlers(systemLayer);
    this.registerLibraryHandlers(systemLayer);
    this.registerViewerHandlers(systemLayer);
  }

  /**
   * Configuration-related IPC handlers
   */
  static registerConfigHandlers(systemLayer) {
    ipcMain.handle('get-config', async () => {
      return await systemLayer.loadConfig();
    });

    ipcMain.handle('get-theme', async () => {
      return await systemLayer.loadTheme();
    });

    ipcMain.handle('update-config', async (event, newConfig) => {
      return await systemLayer.updateConfig(newConfig);
    });
  }

  /**
   * Directory and file operations IPC handlers
   */
  static registerDirectoryHandlers(systemLayer) {
    ipcMain.handle('select-directory', async () => {
      return await systemLayer.openExplorer();
    });

    ipcMain.handle('update-main-path', async (event, newPath) => {
      return await systemLayer.updateConfig({ mainPath: newPath });
    });

    ipcMain.handle('restart-app', async () => {
      const { app } = require('electron');
      app.relaunch();
      app.exit();
    });

    ipcMain.handle('switch-library-tab', async (event, libraryId) => {
      return await systemLayer.switchLibraryTab(libraryId, event.sender);
    });

    ipcMain.handle('add-library', async (event, name, path) => {
      return await systemLayer.addLibrary(name, path);
    });

    ipcMain.handle('remove-library', async (event, libraryId, deleteUserData) => {
      const result = await systemLayer.removeLibrary(libraryId, deleteUserData);
      // Reload renderer to update UI
      if (result.success && event.sender && !event.sender.isDestroyed()) {
        event.sender.reload();
      }
      return result;
    });

    ipcMain.handle('rename-library', async (event, libraryId, newName) => {
      return await systemLayer.renameLibrary(libraryId, newName);
    });
  }

  /**
   * Library operations IPC handlers
   */
  static registerLibraryHandlers(systemLayer) {
    ipcMain.handle('library:repair-ids', async (event, rootPath) => {
      return await systemLayer.repairLibrary(rootPath);
    });

    ipcMain.handle('library:sync', async (event, rootPath) => {
      const webContents = event.sender;

      // Progress callback that sends updates to renderer
      const progressCallback = (progress) => {
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('sync-progress', progress);
        }
      };

      return await systemLayer.syncLibrary(rootPath, progressCallback);
    });

    ipcMain.handle('get-active-library-path', async () => {
      return await systemLayer.getActiveLibraryPath();
    });

    ipcMain.handle('library:get-snapshot', async () => {
      try {
        return await systemLayer.loadLibrary();
      } catch (error) {
        if (error.message.includes('Workspace not initialized')) {
          // Return empty data if workspace not initialized (e.g., fresh install)
          return { entries: [], collections: [] };
        }
        throw error;
      }
    });

    ipcMain.handle('library:get-collections-with-members', async () => {
      try {
        if (!systemLayer.getCurrentWorkspace().mainDirectory) {
          throw new Error('No workspace selected');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const collections = await LibraryEngine.getCollectionsWithMembers();
        return { success: true, data: collections };
      } catch (error) {
        console.error('Error getting collections with members:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:get-collection', async (event, collectionId) => {
      try {
        if (!systemLayer.getCurrentWorkspace().mainDirectory) {
          throw new Error('No workspace selected');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const collection = await LibraryEngine.getCollection(collectionId);
        return { success: true, data: collection };
      } catch (error) {
        console.error('Error getting collection:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:get-collection-members', async (event, collectionId) => {
      try {
        if (!systemLayer.getCurrentWorkspace().mainDirectory) {
          throw new Error('No workspace selected');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const members = await LibraryEngine.getCollectionMembers(collectionId);
        return { success: true, data: members };
      } catch (error) {
        console.error('Error getting collection members:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:update-cache', async (event) => {
      try {
        const webContents = event.sender;

        // Progress callback that sends updates to renderer
        const progressCallback = (progress) => {
          if (webContents && !webContents.isDestroyed()) {
            webContents.send('cache-progress', progress);
          }
        };

        return await systemLayer.updateThumbnailCache(progressCallback);
      } catch (error) {
        if (error.message.includes('Workspace not initialized')) {
          return { success: false, error: 'No library directory configured' };
        }
        throw error;
      }
    });

    ipcMain.handle('library:reset-cache', async (event) => {
      try {
        const webContents = event.sender;

        // Progress callback that sends updates to renderer
        const progressCallback = (progress) => {
          if (webContents && !webContents.isDestroyed()) {
            webContents.send('cache-progress', progress);
          }
        };

        return await systemLayer.resetThumbnailCache(progressCallback);
      } catch (error) {
        if (error.message.includes('Workspace not initialized')) {
          return { success: false, error: 'No library directory configured' };
        }
        throw error;
      }
    });

    // SearchEngine tagging operations
    ipcMain.handle('search:add-tag-to-entry', async (event, entryId, tagName) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.addTagToEntry(entryId, tagName);
        return { success: true };
      } catch (error) {
        console.error('Error adding tag to entry:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('search:remove-tag-from-entry', async (event, entryId, tagName) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.removeTagFromEntry(entryId, tagName);
        return { success: true };
      } catch (error) {
        console.error('Error removing tag from entry:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('search:set-entry-rating', async (event, entryId, rating) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.setEntryRating(entryId, Math.max(0, Math.min(100, rating)));
        return { success: true };
      } catch (error) {
        console.error('Error setting entry rating:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('search:set-collection-rating', async (event, collectionId, rating) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.setCollectionRating(collectionId, Math.max(0, Math.min(100, rating)));
        return { success: true };
      } catch (error) {
        console.error('Error setting collection rating:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('addTag', async (event, tagName) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.addTag(tagName);
        return { success: true };
      } catch (error) {
        console.error('Error adding tag:', error);
        return { success: false, error: error.message };
      }
    });
    
    ipcMain.handle('renameTag', async (event, oldName, newName) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.renameTag(oldName, newName);
        return { success: true };
      } catch (error) {
        console.error('Error renaming tag:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('removeTag', async (event, tagName) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.removeTag(tagName);
        return { success: true };
      } catch (error) {
        console.error('Error removing tag:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('getAllTags', async (event) => {
      try {
        // Check workspace initialization
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const tags = await LibraryEngine.getAllTags();
        return { success: true, data: tags };
      } catch (error) {
        console.error('Error getting all tags:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('open-explorer', async (event, path) => {
      const { shell } = require('electron');
      try {
        await shell.showItemInFolder(path);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Collection tagging operations
    ipcMain.handle('addTagToCollection', async (event, collectionId, tagName) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.addTagToCollection(collectionId, tagName);
        return { success: true };
      } catch (error) {
        console.error('Error adding tag to collection:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('removeTagFromCollection', async (event, collectionId, tagName) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.removeTagFromCollection(collectionId, tagName);
        return { success: true };
      } catch (error) {
        console.error('Error removing tag from collection:', error);
        return { success: false, error: error.message };
      }
    });

    // Get tags for specific entry
    ipcMain.handle('search:get-entry-tags', async (event, entryId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const tags = await LibraryEngine.getEntryTags(entryId);
        return { success: true, data: tags };
      } catch (error) {
        console.error('Error getting entry tags:', error);
        return { success: false, error: error.message };
      }
    });

    // Get tags for specific collection
    ipcMain.handle('search:get-collection-tags', async (event, collectionId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const tags = await LibraryEngine.getCollectionTags(collectionId);
        return { success: true, data: tags };
      } catch (error) {
        console.error('Error getting collection tags:', error);
        return { success: false, error: error.message };
      }
    });

    // User collection management handlers
    ipcMain.handle('library:create-user-collection', async (event, name) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const result = await LibraryEngine.createUserCollection(name);
        return { success: true, data: result };
      } catch (error) {
        console.error('Error creating user collection:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:add-entry-to-collection', async (event, entryId, collectionId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.addEntryToCollection(entryId, collectionId);
        return { success: true };
      } catch (error) {
        console.error('Error adding entry to collection:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:remove-entry-from-collection', async (event, entryId, collectionId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.removeEntryFromCollection(entryId, collectionId);
        return { success: true };
      } catch (error) {
        console.error('Error removing entry from collection:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:get-user-collections', async () => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const collections = await LibraryEngine.getUserCollections();
        return { success: true, data: collections };
      } catch (error) {
        console.error('Error getting user collections:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:delete-user-collection', async (event, collectionId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.deleteUserCollection(collectionId);
        return { success: true };
      } catch (error) {
        console.error('Error deleting user collection:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:get-collection-members-for-entry', async (event, entryId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        const members = await LibraryEngine.getCollectionMembersForEntry(entryId);
        return { success: true, data: members };
      } catch (error) {
        console.error('Error getting collection members for entry:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:set-collection-thumbnail', async (event, collectionId, thumbnailId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.setCollectionThumbnail(collectionId, thumbnailId);
        return { success: true };
      } catch (error) {
        console.error('Error setting collection thumbnail:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:update-collection-member-sort-order', async (event, collectionId, mediaEntryId, sortOrder) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }
        
        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.updateCollectionMemberSortOrder(collectionId, mediaEntryId, sortOrder);
        return { success: true };
      } catch (error) {
        console.error('Error updating collection member sort order:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:update-collection-last-opened', async (event, collectionId, lastOpenedId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }

        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.updateCollectionLastOpened(collectionId, lastOpenedId);
        return { success: true };
      } catch (error) {
        console.error('Error updating collection last opened:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('library:get-collection-manifest', async (event, collectionId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }

        const LibraryEngine = require('../LibraryEngine/index.js');
        const manifest = await LibraryEngine.getCollectionManifest(collectionId);
        return { success: true, data: manifest };
      } catch (error) {
        console.error('Error getting collection manifest:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('collection:mark-completed', async (event, collectionId, mediaEntryId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }

        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.markCollectionMemberCompleted(collectionId, mediaEntryId);
        return { success: true };
      } catch (error) {
        console.error('Error marking collection member as completed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('collection:mark-not-completed', async (event, collectionId, mediaEntryId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }

        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.markCollectionMemberNotCompleted(collectionId, mediaEntryId);
        return { success: true };
      } catch (error) {
        console.error('Error marking collection member as not completed:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('collection:reset-all-completed', async (event, collectionId) => {
      try {
        const workspace = systemLayer.getCurrentWorkspace();
        if (!workspace.mainDirectory) {
          throw new Error('No workspace initialized. Please select a library directory first.');
        }

        const LibraryEngine = require('../LibraryEngine/index.js');
        await LibraryEngine.resetAllCollectionMembersCompleted(collectionId);
        return { success: true };
      } catch (error) {
        console.error('Error resetting all collection members completed status:', error);
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Viewer operations IPC handlers
   */
  static registerViewerHandlers(systemLayer) {
    // Open viewer handler
    ipcMain.handle('viewer:open', async (event, { mediaId, mode, collectionId }) => {
      console.log('🔌 IPC: viewer:open called with:', { mediaId, mode, collectionId });
      try {
        console.log('🔌 IPC: Calling systemLayer.openViewer...');
        const result = await systemLayer.openViewer(mediaId, mode, collectionId);
        console.log('🔌 IPC: systemLayer.openViewer result:', result);

        // Send response to the requesting window
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('viewer:open:response', result);
        }

        return result;
      } catch (error) {
        console.error('💥 IPC: Failed to open viewer', error);
        const errorResult = { success: false, error: error.message };

        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('viewer:open:response', errorResult);
        }

        return errorResult;
      }
    });

    // Switch media in existing viewer handler (for chapter navigation)
    ipcMain.handle('viewer:switch-media', async (event, { mediaId }) => {
      console.log('🔌 IPC: viewer:switch-media called with:', { mediaId });
      try {
        if (!systemLayer.viewerEngine) {
          throw new Error('ViewerEngine not initialized');
        }

        const result = await systemLayer.viewerEngine.openMedia(mediaId);
        console.log('🔌 IPC: viewer:switch-media result:', result);

        return result;
      } catch (error) {
        console.error('💥 IPC: Failed to switch media', error);
        return { success: false, error: error.message };
      }
    });

    // Close viewer handler
    ipcMain.handle('viewer:close', async () => {
      try {
        const result = await systemLayer.closeViewer();
        
        // Send response to all windows (viewer might be closed)
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (window.webContents && !window.webContents.isDestroyed()) {
            window.webContents.send('viewer:close:response', result);
          }
        });
        
        return result;
      } catch (error) {
        console.error('IPC: Failed to close viewer', error);
        const errorResult = { success: false, error: error.message };
        
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(window => {
          if (window.webContents && !window.webContents.isDestroyed()) {
            window.webContents.send('viewer:close:response', errorResult);
          }
        });
        
        return errorResult;
      }
    });

    // Navigation handler
    ipcMain.handle('viewer:navigate', async (event, direction) => {
      try {
        const result = await systemLayer.handleViewerNavigation(direction);
        return result;
      } catch (error) {
        console.error('IPC: Failed to navigate viewer', error);
        return { success: false, error: error.message };
      }
    });

    // Keyboard handler
    ipcMain.handle('viewer:keyboard', async (event, command) => {
      try {
        const result = await systemLayer.handleViewerKeyboard(command);
        return result;
      } catch (error) {
        console.error('IPC: Failed to handle viewer keyboard', error);
        return { success: false, error: error.message };
      }
    });

    // Get viewer state handler
    ipcMain.handle('viewer:get-state', async () => {
      try {
        return await systemLayer.getViewerState();
      } catch (error) {
        console.error('IPC: Failed to get viewer state', error);
        return { success: false, error: error.message };
      }
    });

    // Jump to page handler
    ipcMain.handle('viewer:jump-to-page', async (event, pageNumber) => {
      try {
        if (!systemLayer.viewerEngine) {
          throw new Error('ViewerEngine not initialized');
        }

        const result = await systemLayer.viewerEngine.jumpToPage(pageNumber);
        
        // Send updated state to viewer window
        if (result.success) {
          await systemLayer.sendToViewer('viewer:state:update', result.state);
        }
        
        return result;
      } catch (error) {
        console.error('IPC: Failed to jump to page', error);
        return { success: false, error: error.message };
      }
    });

    // Set viewer mode handler
    ipcMain.handle('viewer:set-mode', async (event, mode) => {
      try {
        if (!systemLayer.viewerEngine) {
          throw new Error('ViewerEngine not initialized');
        }

        const result = systemLayer.viewerEngine.setMode(mode);
        
        // Send updated state to viewer window
        if (result.success) {
          await systemLayer.sendToViewer('viewer:state:update', result.state);
        }
        
        return result;
      } catch (error) {
        console.error('IPC: Failed to set viewer mode', error);
        return { success: false, error: error.message };
      }
    });

    // Update progress handler
    ipcMain.handle('viewer:update-progress', async (event, progress) => {
      try {
        if (!systemLayer.viewerEngine) {
          throw new Error('ViewerEngine not initialized');
        }

        const result = await systemLayer.viewerEngine.updateProgress(progress);
        
        // Send updated state to viewer window
        if (result.success) {
          await systemLayer.sendToViewer('viewer:state:update', result.state);
        }
        
        return result;
      } catch (error) {
        console.error('IPC: Failed to update viewer progress', error);
        return { success: false, error: error.message };
      }
    });

    // Get viewer window state handler
    ipcMain.handle('viewer:get-window-state', async () => {
      try {
        return systemLayer.getViewerWindowState();
      } catch (error) {
        console.error('IPC: Failed to get viewer window state', error);
        return { success: false, error: error.message };
      }
    });

    // Get viewer info handler
    ipcMain.handle('viewer:get-info', async () => {
      try {
        if (!systemLayer.viewerEngine) {
          return { success: false, error: 'ViewerEngine not initialized' };
        }

        return systemLayer.viewerEngine.getViewerInfo();
      } catch (error) {
        console.error('IPC: Failed to get viewer info', error);
        return { success: false, error: error.message };
      }
    });

    // Get media data handler
    ipcMain.handle('viewer:get-data', async (event, mediaId) => {
      try {
        console.log('IPC: viewer:get-data', mediaId);
        const result = await systemLayer.getMediaData(mediaId);
        return result;
      } catch (error) {
        console.error('IPC: Failed to get media data', error);
        return { success: false, error: error.message };
      }
    });

    // Get directory files handler
    ipcMain.handle('viewer:get-directory-files', async (event, directoryPath) => {
      try {
        console.log('IPC: viewer:get-directory-files', directoryPath);
        const fs = require('fs').promises;
        const path = require('path');
        
        // Check if directory exists
        try {
          const stats = await fs.stat(directoryPath);
          if (!stats.isDirectory()) {
            return { success: false, error: 'Path is not a directory' };
          }
        } catch (err) {
          return { success: false, error: 'Directory does not exist' };
        }
        
        // Get all files in directory
        const files = await fs.readdir(directoryPath);
        
        // Filter for image files and sort alphabetically
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];
        const imageFiles = files
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return imageExtensions.includes(ext);
          })
          .sort((a, b) => a.localeCompare(b));
        
        console.log(`IPC: Found ${imageFiles.length} image files in directory`);
        
        return { 
          success: true, 
          files: imageFiles,
          count: imageFiles.length
        };
        
      } catch (error) {
        console.error('IPC: Failed to get directory files', error);
        return { success: false, error: error.message };
      }
    });
  }
}

module.exports = IPCManager;
