// MediaLoader - Media file loading and caching with memory management

class MediaLoader {
  constructor() {
    this.cache = new Map();
    this.loadingQueue = [];
    this.maxConcurrent = 4;
    this.currentLoading = 0;
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalLoaded: 0,
      memoryUsage: 0
    };
    this.loadingPromises = new Map();
  }

  /**
   * Load an image with caching and concurrency control
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Image data URL or blob URL
   */
  async loadImage(imagePath) {
    // Check cache first
    if (this.cache.has(imagePath)) {
      this.cacheStats.hits++;
      return this.cache.get(imagePath);
    }

    // Check if already loading
    if (this.loadingPromises.has(imagePath)) {
      return this.loadingPromises.get(imagePath);
    }

    // Check memory usage and cleanup if needed
    if (this.getCurrentMemoryUsage() > this.memoryThreshold) {
      this.cleanupCache();
    }

    // Check concurrency limit
    if (this.currentLoading >= this.maxConcurrent) {
      return new Promise((resolve) => {
        this.loadingQueue.push({ imagePath, resolve });
      });
    }

    // Create loading promise
    const loadingPromise = this._loadImageInternal(imagePath);
    this.loadingPromises.set(imagePath, loadingPromise);

    try {
      const result = await loadingPromise;
      this.cacheStats.misses++;
      this.cacheStats.totalLoaded++;
      return result;
    } finally {
      this.loadingPromises.delete(imagePath);
      this.currentLoading--;
      this.processQueue();
    }
  }

  /**
   * Internal image loading implementation
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Image data URL
   */
  async _loadImageInternal(imagePath) {
    this.currentLoading++;
    
    try {
      // Use electron API to get image data
      const imageData = await this._getImageData(imagePath);
      
      // Cache the result
      this.cache.set(imagePath, imageData);
      
      return imageData;
    } catch (error) {
      console.error(`Failed to load image: ${imagePath}`, error);
      throw error;
    }
  }

  /**
   * Get image data through system layer
   * @param {string} imagePath - Path to image
   * @returns {Promise<string>} - Image data URL
   */
  async _getImageData(imagePath) {
    // This would typically call through the system layer
    // For now, return a placeholder implementation
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to convert to data URL
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL());
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${imagePath}`));
      img.src = imagePath;
    });
  }

  /**
   * Process queued loading requests
   */
  processQueue() {
    if (this.loadingQueue.length > 0 && this.currentLoading < this.maxConcurrent) {
      const { imagePath, resolve } = this.loadingQueue.shift();
      resolve(this.loadImage(imagePath));
    }
  }

  /**
   * Unload specific image from cache
   * @param {string} imagePath - Path to image to unload
   */
  unloadImage(imagePath) {
    if (this.cache.has(imagePath)) {
      this.cache.delete(imagePath);
      // Revoke blob URLs if they exist
      const cachedUrl = this.cache.get(imagePath);
      if (cachedUrl && cachedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(cachedUrl);
      }
    }
  }

  /**
   * Cleanup cache based on LRU and memory usage
   */
  cleanupCache() {
    const entries = Array.from(this.cache.entries());
    const targetSize = this.memoryThreshold * 0.7; // Reduce to 70% of threshold
    
    // Sort by last accessed time (LRU)
    entries.sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));
    
    let currentSize = this.getCurrentMemoryUsage();
    
    for (const [key, value] of entries) {
      if (currentSize <= targetSize) break;
      
      // Revoke blob URLs
      if (typeof value === 'string' && value.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
      
      this.cache.delete(key);
      currentSize = this.getCurrentMemoryUsage();
    }
  }

  /**
   * Estimate current memory usage of cached images
   * @returns {number} - Estimated memory usage in bytes
   */
  getCurrentMemoryUsage() {
    let totalSize = 0;
    for (const [key, value] of this.cache) {
      if (typeof value === 'string') {
        // Rough estimation: data URL size is roughly the string length
        totalSize += value.length * 2; // Unicode characters are 2 bytes
      }
    }
    return totalSize;
  }

  /**
   * Preload images for better performance
   * @param {string[]} imagePaths - Array of image paths to preload
   * @returns {Promise<void>}
   */
  async preloadImages(imagePaths) {
    const preloadPromises = imagePaths.slice(0, 2).map(path => 
      this.loadImage(path).catch(error => {
        console.warn(`Failed to preload: ${path}`, error);
      })
    );
    
    await Promise.allSettled(preloadPromises);
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache performance statistics
   */
  getCacheStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0 
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100 
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize: this.cache.size,
      memoryUsage: this.getCurrentMemoryUsage(),
      memoryUsageFormatted: this.formatBytes(this.getCurrentMemoryUsage())
    };
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Bytes to format
   * @returns {string} - Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clear all cached images
   */
  clearCache() {
    // Revoke all blob URLs before clearing
    for (const [key, value] of this.cache) {
      if (typeof value === 'string' && value.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
    }
    
    this.cache.clear();
    this.loadingQueue.length = 0;
    this.currentLoading = 0;
    this.loadingPromises.clear();
    
    // Reset stats
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalLoaded: 0,
      memoryUsage: 0
    };
  }

  /**
   * Check if image is cached
   * @param {string} imagePath - Path to check
   * @returns {boolean} - Whether image is cached
   */
  isCached(imagePath) {
    return this.cache.has(imagePath);
  }

  /**
   * Get cached image without loading
   * @param {string} imagePath - Path to get
   * @returns {string|null} - Cached image or null
   */
  getCachedImage(imagePath) {
    const cached = this.cache.get(imagePath);
    if (cached && cached.lastAccessed) {
      cached.lastAccessed = Date.now();
    }
    return cached || null;
  }
}

// Create singleton instance
const mediaLoader = new MediaLoader();

export default mediaLoader;
