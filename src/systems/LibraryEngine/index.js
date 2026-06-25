// LibraryEngine Public API
const MetadataStore = require('./MetadataStore.js');
const ScannerService = require('./ScannerService.js');
const DatabaseService = require('./DatabaseService.js');
const ThumbnailService = require('./ThumbnailService.js');
const crypto = require('crypto');

/*
interface LibraryEngine {
  // Data Access
  loadLibrary(): Promise<LibraryData>
  updateEntry(entry: MediaEntry): Promise<void>
  updateCollection(collection: CollectionEntry): Promise<void>
  getThumbnail(id: string): Promise<string | null>
  
  // Operations
  scanLibrary(): AsyncGenerator<ScanProgress>
  refreshThumbnails(): AsyncGenerator<ThumbnailProgress>
  getWorkspace(): Workspace
  
  // Library Sync
  syncIDs(rootPath): Promise<{success: boolean, created: number, error?: string}>
  syncLibrary(rootPath, progressCallback): Promise<{success: boolean, processed: number, error?: string}>
  
  // Workspace Management
  initializeWorkspace(mainDirectory): Promise<void>
  closeDatabase(): Promise<void>
  getWorkspaceHash(mainDirectory): string
}
*/

const metadataStore = new MetadataStore();
let scannerService = null;
let databaseService = null;
let thumbnailService = null;

/**
 * Generate workspace hash for directory identification
 * @param {string} mainDirectory - The main directory path
 * @returns {string} - Hash of the directory path
 */
function getWorkspaceHash(mainDirectory) {
  return crypto.createHash('sha256').update(mainDirectory).digest('hex').substring(0, 16);
}

/**
 * Initialize workspace with database connection
 * @param {string} mainDirectory - The main directory path for this workspace
 * @param {string} userDataPath - The Electron userData path
 */
async function initializeWorkspace(mainDirectory, userDataPath) {
  // Close existing connections
  if (scannerService) {
    scannerService.close();
    scannerService = null;
  }
  if (databaseService) {
    await databaseService.close();
    databaseService = null;
  }
  
  // Create new instances for this workspace
  databaseService = new DatabaseService();
  await databaseService.initialize(mainDirectory, userDataPath);
  
  // MetadataStore owns CRUD — give it the database
  metadataStore.initializeWithDatabase(databaseService);
  
  // ScannerService routes all writes through MetadataStore
  scannerService = new ScannerService();
  scannerService.initializeWithMetadataStore(metadataStore);
  
  // ThumbnailService uses MetadataStore and DatabaseService
  thumbnailService = new ThumbnailService();
  thumbnailService.initialize(metadataStore, databaseService);
}

/**
 * Close database connections
 */
async function closeDatabase() {
  // Release scanner reference first (does not close DB)
  if (scannerService) {
    scannerService.close();
    scannerService = null;
  }
  // Release thumbnail service reference
  if (thumbnailService) {
    thumbnailService = null;
  }
  // Close the database (single close, no double-close)
  if (databaseService) {
    await databaseService.close();
    databaseService = null;
  }
}

/**
 * Library Sync - Ensures all folders have .per_id files
 * @param {string} rootPath - The root directory to scan
 * @returns {Promise<{success: boolean, created: number, error?: string}>}
 */
async function syncIDs(rootPath) {
  return await metadataStore.ensureFolderIDs(rootPath);
}

/**
 * Library Scanner and SQLite Sync - Scans folders and updates database
 * @param {string} rootPath - The root directory to scan
 * @param {function} progressCallback - Progress callback function
 * @returns {Promise<{success: boolean, processed: number, error?: string}>}
 */
async function syncLibrary(rootPath, progressCallback) {
  if (!scannerService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await scannerService.syncLibrary(rootPath, progressCallback);
}

// Data Access (delegated to MetadataStore)
async function loadLibrary() {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  const entries = await metadataStore.getAllMediaEntries();
  const collections = await metadataStore.getAllCollections();
  
  // Validate and fix IN_COLLECTION values
  const fixedEntries = await validateAndFixInCollection(entries);
  
  return { entries: fixedEntries, collections };
}

/**
 * Get all collections with their members
 */
async function getCollectionsWithMembers() {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await metadataStore.getCollectionsWithMembers();
}

/**
 * Validate and fix IN_COLLECTION values for all entries
 */
async function validateAndFixInCollection(entries) {
  const fixedEntries = [];
  
  for (const entry of entries) {
    // Ensure IN_COLLECTION has a valid value (0 or 1)
    if (entry.IN_COLLECTION === null || entry.IN_COLLECTION === undefined) {
      // Check if this entry is actually in a collection
      const isInCollection = await checkEntryInCollections(entry.ID);
      
      // Update the database with correct value
      await metadataStore.upsertMediaEntry({
        id: entry.ID,
        path: entry.PATH,
        name: entry.NAME,
        type: entry.TYPE,
        rating: entry.RATING,
        dateAdded: entry.DATE_ADDED,
        progress: entry.PROGRESS,
        pageCount: entry.PAGE_COUNT,
        thumbnailProcessed: entry.THUMBNAIL_PROCESSED,
        inCollection: isInCollection ? 1 : 0
      });
      
      // Update local entry
      entry.IN_COLLECTION = isInCollection ? 1 : 0;
    }
    
    fixedEntries.push(entry);
  }
  
  return fixedEntries;
}

/**
 * Check if an entry is in any collection
 */
async function checkEntryInCollections(entryId) {
  try {
    const members = await metadataStore.getCollectionMembersForEntry(entryId);
    return members.length > 0;
  } catch (error) {
    console.error(`Error checking collections for entry ${entryId}:`, error);
    return false;
  }
}

async function updateEntry(entry) {
  return await metadataStore.safeUpsertMediaEntry(entry);
}

async function updateCollection(collection) {
  return await metadataStore.upsertCollection(collection);
}

async function getEntry(id) {
  return await metadataStore.getMediaEntry(id);
}

async function getCollection(id) {
  return await metadataStore.getCollection(id);
}

async function getCollectionMembers(collectionId) {
  return await metadataStore.getCollectionMembers(collectionId);
}

/**
 * Get collection manifest for viewer navigation
 * Returns sorted array of entries in a collection for chapter navigation
 * @param {string} collectionId - Collection ID
 * @returns {Promise<Array>} - Array of entry objects with manifest data
 */
async function getCollectionManifest(collectionId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  // Use existing getCollectionMembers which already returns sorted entries
  return await metadataStore.getCollectionMembers(collectionId);
}

/**
 * Get all collection memberships for a specific entry
 * @param {string} entryId - Entry ID to look up
 * @returns {Promise<Array>} - Array of collection memberships
 */
async function getCollectionMembersForEntry(entryId) {
  return await metadataStore.getCollectionMembersForEntry(entryId);
}

/**
 * Create a user-created collection (no file system association)
 * @param {string} name - Collection name
 * @returns {Promise<{id: string, name: string}>}
 */
async function createUserCollection(name) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  const collectionId = crypto.randomUUID();
  const collection = {
    id: collectionId,
    path: null,
    name: name.trim(),
    autoGenerated: false,
    lastOpenedId: null,
    thumbnailId: null,
    rating: 0
  };
  await metadataStore.upsertCollection(collection);
  return { id: collectionId, name: name.trim() };
}

/**
 * Add a media entry to a user collection
 * @param {string} entryId - Media entry ID
 * @param {string} collectionId - Collection ID
 */
async function addEntryToCollection(entryId, collectionId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await metadataStore.addCollectionMember(collectionId, entryId);
  await updateEntryCollectionStatus(entryId);
}
/**
 * Remove a media entry from a collection

 * @param {string} entryId - Media entry ID
 * @param {string} collectionId - Collection ID
 */
async function removeEntryFromCollection(entryId, collectionId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await metadataStore.removeCollectionMember(collectionId, entryId);
  await updateEntryCollectionStatus(entryId);
}

/**
 * Get all user-created collections
 * @returns {Promise<Array>}
 */
async function getUserCollections() {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await metadataStore.getUserCollections();
}

/**
 * Delete a user-created collection
 * @param {string} collectionId - Collection ID to delete
 */
async function deleteUserCollection(collectionId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await metadataStore.deleteCollection(collectionId);
}

/**
 * Update IN_COLLECTION status based on actual membership
 * @param {string} entryId - Media entry ID
 */
async function updateEntryCollectionStatus(entryId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  const memberships = await metadataStore.getCollectionMembersForEntry(entryId);
  const inCollection = memberships.length > 0 ? 1 : 0;
  await metadataStore.updateMediaEntryCollectionStatus(entryId, inCollection);
}

/**
 * Process thumbnails for all unprocessed entries
 * @param {function} progressCallback - Progress callback function
 * @returns {Promise<{success: boolean, processed: number, error?: string}>}
 */
async function processImages(progressCallback) {
  if (!thumbnailService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await thumbnailService.processAllThumbnails(progressCallback);
}

/**
 * Get thumbnail path for an entry ID
 * @param {string} entryId - Entry UUID
 * @returns {string} - Full path to thumbnail file
 */
function getThumbnailPath(entryId) {
  if (!thumbnailService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return thumbnailService.getThumbnailPath(entryId);
}

/**
 * Check if thumbnail exists for an entry
 * @param {string} entryId - Entry UUID
 * @returns {Promise<boolean>} - True if thumbnail file exists
 */
async function thumbnailExists(entryId) {
  if (!thumbnailService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await thumbnailService.thumbnailExists(entryId);
}

/**
 * Reset cache and regenerate all thumbnails
 * @param {function} progressCallback - Progress callback function
 */
async function resetAndProcessImages(progressCallback) {
  if (!thumbnailService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  
  await thumbnailService.resetCache();
  return await thumbnailService.processAllThumbnails(progressCallback);
}

/**
 * Add a tag to the system
 * @param {string} tagName - Name of the tag to add
 * @returns {Promise<void>}
 */
async function addTag(tagName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.addTag(tagName);
}

/**
 * Rename a tag in the system
 * @param {string} oldName - Current name of the tag
 * @param {string} newName - New name for the tag
 * @returns {Promise<void>}
 */
async function renameTag(oldName, newName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.renameTag(oldName, newName);
}


/**
 * Remove a tag from the system
 * @param {string} tagName - Name of the tag to remove
 * @returns {Promise<void>}
 */
async function removeTag(tagName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.removeTag(tagName);
}

/**
 * Add a tag to a media entry
 * @param {string} entryId - Media entry ID
 * @param {string} tagName - Tag name
 * @returns {Promise<void>}
 */
async function addTagToEntry(entryId, tagName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.addTagToEntry(entryId, tagName);
}

/**
 * Remove a tag from a media entry
 * @param {string} entryId - Media entry ID
 * @param {string} tagName - Tag name
 * @returns {Promise<void>}
 */
async function removeTagFromEntry(entryId, tagName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.removeTagFromEntry(entryId, tagName);
}

/**
 * Get all tags in the system
 * @returns {Promise<string[]>} - Array of tag names
 */
async function getAllTags() {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.getAllTags();
}

/**
 * Get all tags for a specific entry
 * @param {string} entryId - Media entry ID
 * @returns {Promise<string[]>} - Array of tag names
 */
async function getEntryTags(entryId) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.getEntryTags(entryId);
}

/**
 * Add a tag to a collection
 * @param {string} collectionId - Collection ID
 * @param {string} tagName - Tag name
 * @returns {Promise<void>}
 */
async function addTagToCollection(collectionId, tagName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.addTagToCollection(collectionId, tagName);
}

/**
 * Remove a tag from a collection
 * @param {string} collectionId - Collection ID
 * @param {string} tagName - Tag name
 * @returns {Promise<void>}
 */
async function removeTagFromCollection(collectionId, tagName) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  await databaseService.removeTagFromCollection(collectionId, tagName);
}

/**
 * Get all tags for a specific collection
 * @param {string} collectionId - Collection ID
 * @returns {Promise<string[]>} - Array of tag names
 */
async function getCollectionTags(collectionId) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.getCollectionTags(collectionId);
}

/**
 * Set rating for a media entry
 * @param {string} entryId - Media entry ID
 * @param {number} rating - Rating value (0-100)
 * @returns {Promise<void>}
 */
async function setEntryRating(entryId, rating) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await metadataStore.setEntryRating(entryId, rating);
}

/**
 * Set rating for a collection
 * @param {string} collectionId - Collection ID
 * @param {number} rating - Rating value (0-100)
 * @returns {Promise<void>}
 */
async function setCollectionRating(collectionId, rating) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.setCollectionRating(collectionId, rating);
}

/**
 * Update collection thumbnail
 * @param {string} collectionId - Collection ID
 * @param {string} thumbnailId - Media entry ID to use as thumbnail
 */
async function setCollectionThumbnail(collectionId, thumbnailId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await metadataStore.setCollectionThumbnail(collectionId, thumbnailId);
}

/**
 * Update collection member sort order
 * @param {string} collectionId - Collection ID
 * @param {string} mediaEntryId - Media entry ID
 * @param {number} sortOrder - New sort order
 */
async function updateCollectionMemberSortOrder(collectionId, mediaEntryId, sortOrder) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await metadataStore.updateCollectionMemberSortOrder(collectionId, mediaEntryId, sortOrder);
}

/**
 * Update collection's last opened entry
 * @param {string} collectionId - Collection ID
 * @param {string} lastOpenedId - Last opened entry ID
 */
async function updateCollectionLastOpened(collectionId, lastOpenedId) {
  if (!metadataStore.database) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await metadataStore.updateCollectionLastOpened(collectionId, lastOpenedId);
}

/**
 * Mark a collection member as completed
 * @param {string} collectionId - Collection ID
 * @param {string} mediaEntryId - Media entry ID
 */
async function markCollectionMemberCompleted(collectionId, mediaEntryId) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.markCollectionMemberCompleted(collectionId, mediaEntryId);
}

/**
 * Mark a collection member as not completed (reset to 0)
 * @param {string} collectionId - Collection ID
 * @param {string} mediaEntryId - Media entry ID
 */
async function markCollectionMemberNotCompleted(collectionId, mediaEntryId) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.markCollectionMemberNotCompleted(collectionId, mediaEntryId);
}

/**
 * Reset all collection members in a collection to IS_COMPLETED = 0
 * @param {string} collectionId - Collection ID
 */
async function resetAllCollectionMembersCompleted(collectionId) {
  if (!databaseService) {
    throw new Error('Workspace not initialized. Call initializeWorkspace() first.');
  }
  return await databaseService.resetAllCollectionMembersCompleted(collectionId);
}

module.exports = {
  syncIDs,
  syncLibrary,
  initializeWorkspace,
  closeDatabase,
  getWorkspaceHash,
  loadLibrary,
  getCollectionsWithMembers,
  updateEntry,
  updateCollection,
  getEntry,
  getCollection,
  getCollectionMembers,
  getCollectionManifest,
  getCollectionMembersForEntry,
  // User collection management
  createUserCollection,
  addEntryToCollection,
  removeEntryFromCollection,
  getUserCollections,
  deleteUserCollection,
  updateEntryCollectionStatus,
  processImages,
  getThumbnailPath,
  thumbnailExists,
  resetAndProcessImages,
  // Tagging methods
  addTag,
  renameTag,
  removeTag,
  addTagToEntry,
  removeTagFromEntry,
  getAllTags,
  getEntryTags,
  addTagToCollection,
  removeTagFromCollection,
  getCollectionTags,
  // Rating methods
  setEntryRating,
  setCollectionRating,
  // Collection management methods
  setCollectionThumbnail,
  updateCollectionMemberSortOrder,
  updateCollectionLastOpened,
  getCollectionMembersForEntry,
  markCollectionMemberCompleted,
  markCollectionMemberNotCompleted,
  resetAllCollectionMembersCompleted
};
