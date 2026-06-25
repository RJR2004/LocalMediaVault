const { contextBridge, ipcRenderer } = require('electron');

// Expose safe methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Send message to main process
  sendMessage: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  
  // Example: Receive message from main process
  onMessage: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  
  // Example: Clean up listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Config and theme access methods
  getConfig: () => ipcRenderer.invoke('get-config'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  updateConfig: (newConfig) => ipcRenderer.invoke('update-config', newConfig),
  
  // Directory management methods
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  updateMainPath: (newPath) => ipcRenderer.invoke('update-main-path', newPath),
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // Library tab management methods
  switchLibraryTab: (libraryId) => {
    console.log('preload: switchLibraryTab called with:', libraryId);
    return ipcRenderer.invoke('switch-library-tab', libraryId);
  },

  addLibrary: (name, path) => {
    console.log('preload: addLibrary called with:', name, path);
    return ipcRenderer.invoke('add-library', name, path);
  },

  getActiveLibraryPath: () => {
    console.log('preload: getActiveLibraryPath called');
    return ipcRenderer.invoke('get-active-library-path');
  },

  removeLibrary: (libraryId, deleteUserData) => {
    console.log('preload: removeLibrary called with:', libraryId, deleteUserData);
    return ipcRenderer.invoke('remove-library', libraryId, deleteUserData);
  },

  renameLibrary: (libraryId, newName) => {
    console.log('preload: renameLibrary called with:', libraryId, newName);
    return ipcRenderer.invoke('rename-library', libraryId, newName);
  },

  // Library sync methods
  repairLibraryIds: (rootPath) => ipcRenderer.invoke('library:repair-ids', rootPath),
  syncLibrary: (rootPath) => ipcRenderer.invoke('library:sync', rootPath),
  onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (event, ...args) => callback(...args)),
  removeSyncProgressListener: () => ipcRenderer.removeAllListeners('sync-progress'),

  // Library data snapshot
  getLibrarySnapshot: () => ipcRenderer.invoke('library:get-snapshot'),
  getCollectionsWithMembers: () => ipcRenderer.invoke('library:get-collections-with-members'),

  getCollection: (collectionId) => {
    console.log('preload: getCollection called with:', collectionId);
    return ipcRenderer.invoke('library:get-collection', collectionId);
  },

  getCollectionMembers: (collectionId) => {
    console.log('preload: getCollectionMembers called with:', collectionId);
    return ipcRenderer.invoke('library:get-collection-members', collectionId);
  },

  // Thumbnail cache operations
  updateThumbnailCache: () => ipcRenderer.invoke('library:update-cache'),
  resetThumbnailCache: () => ipcRenderer.invoke('library:reset-cache'),
  onCacheProgress: (callback) => ipcRenderer.on('cache-progress', (event, ...args) => callback(...args)),
  removeCacheProgressListener: () => ipcRenderer.removeAllListeners('cache-progress'),

  // Tag management operations
  addTag: (tagName) => {
    console.log('preload: addTag called with:', tagName);
    return ipcRenderer.invoke('addTag', tagName);
  },
  
  renameTag: (oldName, newName) => {
    console.log('preload: renameTag called with:', oldName, newName);
    return ipcRenderer.invoke('renameTag', oldName, newName);
  },
  
  removeTag: (tagName) => {
    console.log('preload: removeTag called with:', tagName);
    return ipcRenderer.invoke('removeTag', tagName);
  },
  getAllTags: () => {
    console.log('preload: getAllTags called');
    return ipcRenderer.invoke('getAllTags');
  },
  
  // Entry tagging operations
  addTagToEntry: (entryId, tagName) => {
    console.log('preload: addTagToEntry called with:', entryId, tagName);
    return ipcRenderer.invoke('search:add-tag-to-entry', entryId, tagName);
  },
  removeTagFromEntry: (entryId, tagName) => {
    console.log('preload: removeTagFromEntry called with:', entryId, tagName);
    return ipcRenderer.invoke('search:remove-tag-from-entry', entryId, tagName);
  },
  
  // Rating operations
  setEntryRating: (entryId, rating) => {
    console.log('preload: setEntryRating called with:', entryId, rating);
    return ipcRenderer.invoke('search:set-entry-rating', entryId, rating);
  },
  setCollectionRating: (collectionId, rating) => {
    console.log('preload: setCollectionRating called with:', collectionId, rating);
    return ipcRenderer.invoke('search:set-collection-rating', collectionId, rating);
  },
  
  // File explorer operations
  openExplorer: (path) => {
    console.log('preload: openExplorer called with:', path);
    return ipcRenderer.invoke('open-explorer', path);
  },

  // Collection tagging operations
  addTagToCollection: (collectionId, tagName) => {
    console.log('preload: addTagToCollection called with:', collectionId, tagName);
    return ipcRenderer.invoke('addTagToCollection', collectionId, tagName);
  },

  removeTagFromCollection: (collectionId, tagName) => {
    console.log('preload: removeTagFromCollection called with:', collectionId, tagName);
    return ipcRenderer.invoke('removeTagFromCollection', collectionId, tagName);
  },

  // Get tags for specific entry
  getEntryTags: (entryId) => {
    console.log('preload: getEntryTags called with:', entryId);
    return ipcRenderer.invoke('search:get-entry-tags', entryId);
  },

  // Get tags for specific collection
  getCollectionTags: (collectionId) => {
    console.log('preload: getCollectionTags called with:', collectionId);
    return ipcRenderer.invoke('search:get-collection-tags', collectionId);
  },

  // User collection management
  createUserCollection: (name) => {
    console.log('preload: createUserCollection called with:', name);
    return ipcRenderer.invoke('library:create-user-collection', name);
  },

  addEntryToCollection: (entryId, collectionId) => {
    console.log('preload: addEntryToCollection called with:', entryId, collectionId);
    return ipcRenderer.invoke('library:add-entry-to-collection', entryId, collectionId);
  },

  removeEntryFromCollection: (entryId, collectionId) => {
    console.log('preload: removeEntryFromCollection called with:', entryId, collectionId);
    return ipcRenderer.invoke('library:remove-entry-from-collection', entryId, collectionId);
  },

  getUserCollections: () => {
    console.log('preload: getUserCollections called');
    return ipcRenderer.invoke('library:get-user-collections');
  },

  deleteUserCollection: (collectionId) => {
    console.log('preload: deleteUserCollection called with:', collectionId);
    return ipcRenderer.invoke('library:delete-user-collection', collectionId);
  },

  getCollectionMembersForEntry: (entryId) => {
    console.log('preload: getCollectionMembersForEntry called with:', entryId);
    return ipcRenderer.invoke('library:get-collection-members-for-entry', entryId);
  },

  // Additional collection management methods
  setCollectionThumbnail: (collectionId, thumbnailId) => {
    console.log('preload: setCollectionThumbnail called with:', collectionId, thumbnailId);
    return ipcRenderer.invoke('library:set-collection-thumbnail', collectionId, thumbnailId);
  },

  updateCollectionMemberSortOrder: (collectionId, mediaEntryId, sortOrder) => {
    console.log('preload: updateCollectionMemberSortOrder called with:', collectionId, mediaEntryId, sortOrder);
    return ipcRenderer.invoke('library:update-collection-member-sort-order', collectionId, mediaEntryId, sortOrder);
  },

  updateCollectionLastOpened: (collectionId, lastOpenedId) => {
    console.log('preload: updateCollectionLastOpened called with:', collectionId, lastOpenedId);
    return ipcRenderer.invoke('library:update-collection-last-opened', collectionId, lastOpenedId);
  },

  getCollectionManifest: (collectionId) => {
    console.log('preload: getCollectionManifest called with:', collectionId);
    return ipcRenderer.invoke('library:get-collection-manifest', collectionId);
  },

  markCollectionMemberCompleted: (collectionId, mediaEntryId) => {
    console.log('preload: markCollectionMemberCompleted called with:', collectionId, mediaEntryId);
    return ipcRenderer.invoke('collection:mark-completed', collectionId, mediaEntryId);
  },

  markCollectionMemberNotCompleted: (collectionId, mediaEntryId) => {
    console.log('preload: markCollectionMemberNotCompleted called with:', collectionId, mediaEntryId);
    return ipcRenderer.invoke('collection:mark-not-completed', collectionId, mediaEntryId);
  },

  resetAllCollectionMembersCompleted: (collectionId) => {
    console.log('preload: resetAllCollectionMembersCompleted called with:', collectionId);
    return ipcRenderer.invoke('collection:reset-all-completed', collectionId);
  },

  // Viewer operations
  openViewer: (mediaId, mode, collectionId) => {
    console.log('preload: openViewer called with:', mediaId, mode, collectionId);
    return ipcRenderer.invoke('viewer:open', { mediaId, mode, collectionId });
  },

  switchViewerMedia: (mediaId) => {
    console.log('preload: switchViewerMedia called with:', mediaId);
    return ipcRenderer.invoke('viewer:switch-media', { mediaId });
  },

  closeViewer: () => {
    console.log('preload: closeViewer called');
    return ipcRenderer.invoke('viewer:close');
  },

  navigateViewer: (direction) => {
    console.log('preload: navigateViewer called with:', direction);
    return ipcRenderer.invoke('viewer:navigate', direction);
  },

  viewerKeyboard: (command) => {
    console.log('preload: viewerKeyboard called with:', command);
    return ipcRenderer.invoke('viewer:keyboard', command);
  },

  getViewerState: () => {
    console.log('preload: getViewerState called');
    return ipcRenderer.invoke('viewer:get-state');
  },

  jumpToPage: (pageNumber) => {
    console.log('preload: jumpToPage called with:', pageNumber);
    return ipcRenderer.invoke('viewer:jump-to-page', pageNumber);
  },

  setViewerMode: (mode) => {
    console.log('preload: setViewerMode called with:', mode);
    return ipcRenderer.invoke('viewer:set-mode', mode);
  },

  updateViewerProgress: (progress) => {
    console.log('preload: updateViewerProgress called with:', progress);
    return ipcRenderer.invoke('viewer:update-progress', progress);
  },

  getViewerWindowState: () => {
    console.log('preload: getViewerWindowState called');
    return ipcRenderer.invoke('viewer:get-window-state');
  },

  getViewerInfo: () => {
    console.log('preload: getViewerInfo called');
    return ipcRenderer.invoke('viewer:get-info');
  },

  getViewerData: (mediaId) => {
    console.log('preload: getViewerData called with:', mediaId);
    return ipcRenderer.invoke('viewer:get-data', mediaId);
  },

  // Viewer event listeners
  onViewerStateUpdate: (callback) => {
    console.log('preload: onViewerStateUpdate listener added');
    return ipcRenderer.on('viewer:state:update', (event, ...args) => callback(...args));
  },

  onViewerOpenResponse: (callback) => {
    console.log('preload: onViewerOpenResponse listener added');
    return ipcRenderer.on('viewer:open:response', (event, ...args) => callback(...args));
  },

  onViewerCloseResponse: (callback) => {
    console.log('preload: onViewerCloseResponse listener added');
    return ipcRenderer.on('viewer:close:response', (event, ...args) => callback(...args));
  },

  removeViewerStateUpdateListener: () => {
    console.log('preload: removeViewerStateUpdateListener called');
    return ipcRenderer.removeAllListeners('viewer:state:update');
  },

  removeViewerOpenResponseListener: () => {
    console.log('preload: removeViewerOpenResponseListener called');
    return ipcRenderer.removeAllListeners('viewer:open:response');
  },

  removeViewerCloseResponseListener: () => {
    console.log('preload: removeViewerCloseResponseListener called');
    return ipcRenderer.removeAllListeners('viewer:close:response');
  },

  // Additional viewer event listeners for App.jsx
  onViewerClosed: (callback) => {
    console.log('preload: onViewerClosed listener added');
    return ipcRenderer.on('viewer:closed', (event, ...args) => callback(...args));
  },

  removeViewerClosedListener: () => {
    console.log('preload: removeViewerClosedListener called');
    return ipcRenderer.removeAllListeners('viewer:closed');
  },

  removeViewerStateUpdateListener: () => {
    console.log('preload: removeViewerStateUpdateListener called (duplicate)');
    return ipcRenderer.removeAllListeners('viewer:state:update');
  },

  // Generic event listeners for viewer
  on: (channel, callback) => {
    console.log(`preload: on listener added for channel: ${channel}`);
    return ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },

  removeListener: (channel, callback) => {
    console.log(`preload: removeListener called for channel: ${channel}`);
    return ipcRenderer.removeListener(channel, callback);
  },

  removeAllListeners: (channel) => {
    console.log(`preload: removeAllListeners called for channel: ${channel}`);
    return ipcRenderer.removeAllListeners(channel);
  },

  // Get files in a directory
  getDirectoryFiles: (directoryPath) => {
    console.log(`preload: getDirectoryFiles called with: ${directoryPath}`);
    return ipcRenderer.invoke('viewer:get-directory-files', directoryPath);
  }
});
