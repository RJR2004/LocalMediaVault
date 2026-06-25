const fs = require('fs').promises;
const path = require('path');
const { nativeImage } = require('electron');
const sharp = require('sharp');

// ThumbnailService - Image processing and thumbnail generation
class ThumbnailService {
  constructor() {
    this.metadataStore = null;
    this.databaseService = null;
  }

  /**
   * Initialize with MetadataStore and DatabaseService instances
   * @param {MetadataStore} metadataStore - The metadata store instance
   * @param {DatabaseService} databaseService - The database service instance
   */
  initialize(metadataStore, databaseService) {
    this.metadataStore = metadataStore;
    this.databaseService = databaseService;
  }

  /**
   * Process all unprocessed thumbnails
   * @param {function} progressCallback - Progress callback function
   * @returns {Promise<{success: boolean, processed: number, error?: string}>}
   */
  async processAllThumbnails(progressCallback) {
    if (!this.metadataStore || !this.databaseService) {
      throw new Error('ThumbnailService not initialized');
    }

    try {
      // Get all media entries where ThumbnailProcessed = 0
      const unprocessedEntries = await this.getUnprocessedEntries();
      
      if (unprocessedEntries.length === 0) {
        return { success: true, processed: 0 };
      }

      const cachePath = this.databaseService.getCachePath();
      let processedCount = 0;
      const totalCount = unprocessedEntries.length;

      // Process each entry
      for (let i = 0; i < unprocessedEntries.length; i++) {
        const entry = unprocessedEntries[i];
        
        try {
          await this.processSingleThumbnail(entry, cachePath);
          processedCount++;
          
          // Update progress
          if (progressCallback) {
            progressCallback({
              type: 'thumbnail-progress',
              current: i + 1,
              total: totalCount,
              processed: processedCount,
              currentItem: entry.NAME
            });
          }
        } catch (error) {
          console.error(`Failed to process thumbnail for ${entry.NAME}:`, error);
          // Continue processing other entries
        }
      }

      // After processing media thumbnails, map collection thumbnails
      try {
        if (progressCallback) {
          progressCallback({
            type: 'thumbnail-progress',
            current: totalCount,
            total: totalCount,
            processed: processedCount,
            currentItem: 'Mapping collection thumbnails...'
          });
        }

        const mappingResult = await this.mapCollectionThumbnails();
        
        if (progressCallback) {
          progressCallback({
            type: 'thumbnail-progress',
            current: totalCount,
            total: totalCount,
            processed: processedCount,
            currentItem: `Updated ${mappingResult.updated} collection thumbnails`
          });
        }

        console.log(`Collection thumbnail mapping completed: ${mappingResult.updated} collections updated`);
      } catch (mappingError) {
        console.error('Collection thumbnail mapping failed:', mappingError);
        // Don't fail the entire process if mapping fails
      }

      return { success: true, processed: processedCount };
    } catch (error) {
      console.error('Error processing thumbnails:', error);
      return { success: false, processed: 0, error: error.message };
    }
  }

  /**
   * Get all media entries where ThumbnailProcessed = false
   * @returns {Promise<Array>} - Array of unprocessed entries
   */
  async getUnprocessedEntries() {
    return new Promise((resolve, reject) => {
      this.databaseService.db.all(
        'SELECT * FROM media_entry WHERE THUMBNAIL_PROCESSED = 0 OR THUMBNAIL_PROCESSED IS NULL',
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Process thumbnail for a single entry
   * @param {object} entry - Media entry from database
   * @param {string} cachePath - Cache directory path
   */
  async processSingleThumbnail(entry, cachePath) {
    try {
      // Find the first valid image file in the entry's path
      const imageFile = await this.findFirstImageFile(entry.PATH);
      
      if (!imageFile) {
        // No image found, mark as processed but no thumbnail created
        await this.markThumbnailProcessed(entry.ID);
        return;
      }

      // Read and resize the image
      const thumbnailBuffer = await this.createThumbnail(imageFile);
      
      if (!thumbnailBuffer) {
        // Failed to create thumbnail, mark as processed
        await this.markThumbnailProcessed(entry.ID);
        return;
      }

      // Save thumbnail to cache with UUID filename
      const thumbnailPath = path.join(cachePath, `${entry.ID}.jpg`);
      await fs.writeFile(thumbnailPath, thumbnailBuffer);

      // Mark entry as processed
      await this.markThumbnailProcessed(entry.ID);
      
    } catch (error) {
      console.error(`Error processing thumbnail for entry ${entry.ID}:`, error);
      // Mark as processed to avoid retry loops
      await this.markThumbnailProcessed(entry.ID);
      throw error;
    }
  }

  /**
   * Find the first valid image file in a directory (lexicographical order)
   * @param {string} dirPath - Directory path to search
   * @returns {Promise<string|null>} - Path to first image file or null
   */
  async findFirstImageFile(dirPath) {
    try {
      const stat = await fs.stat(dirPath);
      
      if (stat.isFile()) {
        // If it's a file, check if it's an image
        if (this.isImageFile(dirPath)) {
          return dirPath;
        }
        return null;
      }

      if (!stat.isDirectory()) {
        return null;
      }

      // Read directory contents
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Filter and sort image files
      const imageFiles = entries
        .filter(entry => entry.isFile() && this.isImageFile(entry.name))
        .map(entry => entry.name)
        .sort(); // Lexicographical order

      if (imageFiles.length === 0) {
        return null;
      }

      return path.join(dirPath, imageFiles[0]);
    } catch (error) {
      console.error(`Error finding image file in ${dirPath}:`, error);
      return null;
    }
  }

  /**
   * Check if a file is a valid thumbnailable image based on extension
   * @param {string} filename - Filename to check
   * @returns {boolean} - True if it's a thumbnailable image file
   */
  isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Create thumbnail from image file
   * @param {string} imagePath - Path to source image
   * @returns {Promise<Buffer|null>} - Thumbnail buffer or null on failure
   */
  async createThumbnail(imagePath) {
    try {
      // Read the image file
      let imageBuffer = await fs.readFile(imagePath);

      // Convert webp to PNG if needed (Electron nativeImage doesn't support webp)
      if (imagePath.toLowerCase().endsWith('.webp')) {
        imageBuffer = await sharp(imageBuffer).png().toBuffer();
      }
      
      // Create native image
      const image = nativeImage.createFromBuffer(imageBuffer);
      
      if (image.isEmpty()) {
        console.warn(`Failed to create image from ${imagePath}`);
        return null;
      }

      // Get original size
      const size = image.getSize();
      
      // Calculate new dimensions (300px width, maintain aspect ratio)
      const targetWidth = 300;
      const aspectRatio = size.height / size.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);

      // Resize image
      const resizedImage = image.resize({
        width: targetWidth,
        height: targetHeight,
        quality: 'good'
      });

      // Convert to JPEG buffer
      return resizedImage.toJPEG(80);
    } catch (error) {
      console.error(`Error creating thumbnail from ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Mark entry as thumbnail processed in database
   * @param {string} entryId - Entry ID to mark
   */
  async markThumbnailProcessed(entryId) {
    try {
      // Use MetadataStore to update the entry
      const entry = await this.metadataStore.getMediaEntry(entryId);
      if (entry) {
        //entry.THUMBNAIL_PROCESSED = 1;
        await this.metadataStore.safeUpsertMediaEntry({
          id: entry.ID,
          thumbnailProcessed: true
          // Other fields will be preserved automatically
        });
      }
    } catch (error) {
      console.error(`Error marking thumbnail as processed for entry ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * Get thumbnail path for an entry ID
   * @param {string} entryId - Entry UUID
   * @returns {string} - Full path to thumbnail file
   */
  getThumbnailPath(entryId) {
    if (!this.databaseService) {
      throw new Error('ThumbnailService not initialized');
    }
    
    const cachePath = this.databaseService.getCachePath();
    return path.join(cachePath, `${entryId}.jpg`);
  }

  /**
   * Check if thumbnail exists for an entry
   * @param {string} entryId - Entry UUID
   * @returns {Promise<boolean>} - True if thumbnail file exists
   */
  async thumbnailExists(entryId) {
    try {
      const thumbnailPath = this.getThumbnailPath(entryId);
      await fs.access(thumbnailPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Map collection thumbnails to their first member (lowest SORT_ORDER)
   * @returns {Promise<{success: boolean, updated: number, error?: string}>}
   */
  async mapCollectionThumbnails() {
    if (!this.metadataStore || !this.databaseService) {
      throw new Error('ThumbnailService not initialized');
    }

    try {
      // Get all collections
      const collections = await this.metadataStore.getAllCollections();
      
      if (collections.length === 0) {
        return { success: true, updated: 0 };
      }

      let updatedCount = 0;

      // Process each collection
      for (const collection of collections) {
        try {
          // Get collection members ordered by SORT_ORDER
          const members = await this.metadataStore.getCollectionMembers(collection.ID);
          
          if (members.length > 0) {
            // Find the first member (lowest SORT_ORDER)
            const firstMember = members[0];
            
            // Update collection's THUMBNAIL_ID to point to first member's ID
            await this.metadataStore.safeUpsertCollection({
              id: collection.ID,
              thumbnailId: firstMember.ID
            });
            
            updatedCount++;
          }
        } catch (error) {
          console.error(`Failed to map thumbnail for collection ${collection.NAME}:`, error);
          // Continue processing other collections
        }
      }

      return { success: true, updated: updatedCount };
    } catch (error) {
      console.error('Error mapping collection thumbnails:', error);
      return { success: false, updated: 0, error: error.message };
    }
  }

  /**
   * Reset cache before processing - delete cache and reset all flags to 0
   */
  async resetCache() {
    // Delete cache directory
    const cachePath = this.databaseService.getCachePath();
    try {
      await fs.rm(cachePath, { recursive: true, force: true });
      await fs.mkdir(cachePath, { recursive: true });
    } catch (error) {
      console.warn('Cache directory reset:', error.message);
    }

    // Reset all ThumbnailProcessed flags to 0
    return new Promise((resolve, reject) => {
      this.databaseService.db.run(
        'UPDATE media_entry SET THUMBNAIL_PROCESSED = 0',
        [],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

module.exports = ThumbnailService;
