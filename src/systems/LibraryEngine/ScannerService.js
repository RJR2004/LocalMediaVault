const fs = require('fs').promises;
const path = require('path');

class ScannerService {
  constructor() {
    this.metadataStore = null;
    this.mediaExtensions = {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.ico'],
      video: ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
      audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma']
    };
  }

  /**
   * Initialize the scanner service with a metadata store for CRUD operations
   * @param {MetadataStore} metadataStore - MetadataStore instance
   */
  initializeWithMetadataStore(metadataStore) {
    this.metadataStore = metadataStore;
  }

  /**
   * Main sync function - scans library and updates database
   * @param {string} rootPath - Root directory to scan
   * @param {function} progressCallback - Callback for progress updates
   * @returns {Promise<{success: boolean, processed: number, error?: string}>}
   */
  async syncLibrary(rootPath, progressCallback) {
    try {
      if (!this.metadataStore) {
        throw new Error('ScannerService not initialized. Call initializeWithMetadataStore() first.');
      }
      
      let processed = 0;
      const stats = {
        standalone: 0,
        collections: 0,
        errors: 0
      };

      // Level 1 Scan: Get all immediate subdirectories
      const level1Dirs = await this.getImmediateSubdirectories(rootPath);
      
      // Classification and processing
      for (const dir of level1Dirs) {
        try {
          const classification = await this.classifyDirectory(dir);
          
          if (classification.type === 'standalone') {
            await this.processStandalone(dir, classification);
            stats.standalone++;
          } else if (classification.type === 'auto-series') {
            await this.processAutoSeries(dir, classification);
            stats.collections++;
          }
          
          processed++;
          if (progressCallback) {
            progressCallback({
              processed,
              total: level1Dirs.length,
              current: path.basename(dir),
              stats
            });
          }
        } catch (error) {
          console.error(`Error processing ${dir}:`, error);
          stats.errors++;
        }
      }

      return { success: true, processed, stats };
    } catch (error) {
      console.error('Library sync failed:', error);
      return { success: false, processed: 0, error: error.message };
    }
  }

  /**
   * Get immediate subdirectories of a path
   */
  async getImmediateSubdirectories(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => path.join(dirPath, entry.name));
    } catch (error) {
      throw new Error(`Failed to read directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Classify a directory as standalone or auto-series
   */
  async classifyDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const subdirs = entries.filter(entry => entry.isDirectory());
    const files = entries.filter(entry => entry.isFile());

    // First: Check if subdirectories contain media files (auto-series)
    const subdirsWithMedia = [];
    for (const subdir of subdirs) {
      const subdirPath = path.join(dirPath, subdir.name);
      try {
        const subdirEntries = await fs.readdir(subdirPath, { withFileTypes: true });
        const hasMedia = subdirEntries.some(entry => 
          entry.isFile() && this.isMediaFile(entry.name)
        );
        if (hasMedia) {
          subdirsWithMedia.push({ name: subdir.name, path: subdirPath });
        }
      } catch (error) {
        // Skip inaccessible subdirectories
        continue;
      }
    }

    if (subdirsWithMedia.length > 0) {
      return { type: 'auto-series', subdirs: subdirsWithMedia };
    }

    // Second: If no media subdirs, check for direct media files (standalone)
    const mediaFiles = files.filter(file => 
      this.isMediaFile(file.name)
    );

    if (mediaFiles.length > 0) {
      return { type: 'standalone', mediaFiles };
    }

    return { type: 'unknown' };
  }

  /**
   * Check if a file is a media file
   */
  isMediaFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    for (const mediaType in this.mediaExtensions) {
      if (this.mediaExtensions[mediaType].includes(ext)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Process a standalone media directory
   */
  async processStandalone(dirPath, classification) {
    const uuid = await this.readPerIdFile(dirPath);
    if (!uuid) {
      throw new Error(`No .per_id file found in ${dirPath}`);
    }

    // Determine media type from files
    let mediaType = 'unknown';
    for (const file of classification.mediaFiles) {
      const fileType = this.getMediaType(file.name);
      if (fileType !== 'unknown') {
        mediaType = fileType;
        break;
      }
    }

    // Count files for page count
    const pageCount = classification.mediaFiles.length;

    // Upsert media entry through MetadataStore
    await this.metadataStore.safeUpsertMediaEntry({
      id: uuid,
      path: dirPath,
      name: path.basename(dirPath),
      type: mediaType,
      pageCount,
      dateAdded: Date.now()
    });
  }

  /**
   * Process an auto-series directory
   */
  async processAutoSeries(dirPath, classification) {
    const collectionUuid = await this.readPerIdFile(dirPath);
    if (!collectionUuid) {
      throw new Error(`No .per_id file found in collection directory ${dirPath}`);
    }

    // Upsert collection through MetadataStore using safe method to preserve existing fields
    await this.metadataStore.safeUpsertCollection({
      id: collectionUuid,
      path: dirPath,
      name: path.basename(dirPath),
      autoGenerated: true
    });

    // Process each subdirectory as a media entry
    for (let i = 0; i < classification.subdirs.length; i++) {
      const subdir = classification.subdirs[i];
      const mediaUuid = await this.readPerIdFile(subdir.path);
      
      if (mediaUuid) {
        // Get media files in subdirectory
        const subdirEntries = await fs.readdir(subdir.path, { withFileTypes: true });
        const mediaFiles = subdirEntries.filter(entry => 
          entry.isFile() && this.isMediaFile(entry.name)
        );

        // Determine media type
        let mediaType = 'unknown';
        for (const file of mediaFiles) {
          const fileType = this.getMediaType(file.name);
          if (fileType !== 'unknown') {
            mediaType = fileType;
            break;
          }
        }

        // Upsert media entry through MetadataStore
        await this.metadataStore.safeUpsertMediaEntry({
          id: mediaUuid,
          path: subdir.path,
          name: subdir.name,
          type: mediaType,
          pageCount: mediaFiles.length,
          dateAdded: Date.now(),
          inCollection: 1  // Mark as being part of a collection
        });

        // Add to collection through MetadataStore
        await this.metadataStore.addCollectionMember(
          collectionUuid,
          mediaUuid,
          i // sort order
        );
      }
    }
  }

  /**
   * Get media type from file extension
   */
  getMediaType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    for (const mediaType in this.mediaExtensions) {
      if (this.mediaExtensions[mediaType].includes(ext)) {
        return mediaType;
      }
    }
    return 'unknown';
  }

  /**
   * Read .per_id file from directory
   */
  async readPerIdFile(dirPath) {
    try {
      const perIdPath = path.join(dirPath, '.per_id');
      const content = await fs.readFile(perIdPath, 'utf8');
      return content.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * Release reference to metadata store (does not close DB — owner is responsible)
   */
  close() {
    this.metadataStore = null;
  }
}

module.exports = ScannerService;
