// TagGenerator - Ghost tag generation logic
// Generate series:ghost tags and type:image/video/audio tags

/**
 * Generate ghost tags for a media entry based on collections and file type
 * @param {object} entry - Media entry object
 * @param {object[]} collections - Array of collections
 * @returns {string[]} Array of ghost tag strings
 */
function generateGhostTags(entry, collections = []) {
  if (!entry) return [];
  
  const ghostTags = [];
  
  // Generate series ghost tags
  const seriesTags = generateSeriesGhostTags(entry, collections);
  ghostTags.push(...seriesTags);
  
  // Generate type ghost tags
  const typeTags = generateTypeGhostTags(entry);
  ghostTags.push(...typeTags);
  
  return ghostTags;
}

/**
 * Generate series ghost tags based on entry's collection membership
 * @param {object} entry - Media entry object
 * @param {object[]} collections - Array of collections
 * @returns {string[]} Array of series ghost tags
 */
function generateSeriesGhostTags(entry, collections = []) {
  if (!entry || !collections || !Array.isArray(collections)) {
    return [];
  }
  
  const seriesTags = [];
  
  // Find collections this entry belongs to
  collections.forEach(collection => {
    if (!collection || !collection.name) return;
    
    // Check if entry belongs to this collection
    if (isEntryInCollection(entry, collection)) {
      // Generate series:collection_name tag
      const seriesTag = `series:${sanitizeTagName(collection.name)}`;
      seriesTags.push(seriesTag);
      
      // If collection has a parent path structure, generate hierarchy tags
      const hierarchyTags = generateHierarchyTags(collection.name);
      seriesTags.push(...hierarchyTags);
    }
  });
  
  return seriesTags;
}

/**
 * Generate type ghost tags based on entry's file type
 * @param {object} entry - Media entry object
 * @returns {string[]} Array of type ghost tags
 */
function generateTypeGhostTags(entry) {
  if (!entry || !entry.path) return [];
  
  const typeTags = [];
  const filePath = entry.path.toLowerCase();
  const entryType = (entry.type || '').toLowerCase();
  
  // Image types
  if (entryType.includes('image') || 
      /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico|heic|heif)$/i.test(filePath)) {
    typeTags.push('type:image');
    
    // Specific image formats
    if (/\.(jpg|jpeg)$/i.test(filePath)) typeTags.push('type:jpeg');
    else if (/\.png$/i.test(filePath)) typeTags.push('type:png');
    else if (/\.gif$/i.test(filePath)) typeTags.push('type:gif');
    else if (/\.svg$/i.test(filePath)) typeTags.push('type:svg');
    else if (/\.webp$/i.test(filePath)) typeTags.push('type:webp');
  }
  
  // Video types
  else if (entryType.includes('video') || 
           /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|3gp|ogv)$/i.test(filePath)) {
    typeTags.push('type:video');
    
    // Specific video formats
    if (/\.mp4$/i.test(filePath)) typeTags.push('type:mp4');
    else if (/\.avi$/i.test(filePath)) typeTags.push('type:avi');
    else if (/\.mkv$/i.test(filePath)) typeTags.push('type:mkv');
    else if (/\.mov$/i.test(filePath)) typeTags.push('type:mov');
    else if (/\.webm$/i.test(filePath)) typeTags.push('type:webm');
  }
  
  // Audio types
  else if (entryType.includes('audio') || 
           /\.(mp3|wav|flac|aac|ogg|wma|m4a|opus)$/i.test(filePath)) {
    typeTags.push('type:audio');
    
    // Specific audio formats
    if (/\.mp3$/i.test(filePath)) typeTags.push('type:mp3');
    else if (/\.wav$/i.test(filePath)) typeTags.push('type:wav');
    else if (/\.flac$/i.test(filePath)) typeTags.push('type:flac');
    else if (/\.aac$/i.test(filePath)) typeTags.push('type:aac');
    else if (/\.ogg$/i.test(filePath)) typeTags.push('type:ogg');
  }
  
  // Document types
  else if (/\.(pdf|doc|docx|txt|rtf|md)$/i.test(filePath)) {
    typeTags.push('type:document');
    
    if (/\.pdf$/i.test(filePath)) typeTags.push('type:pdf');
    else if (/\.(doc|docx)$/i.test(filePath)) typeTags.push('type:word');
    else if (/\.(txt|md)$/i.test(filePath)) typeTags.push('type:text');
  }
  
  // Archive types
  else if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(filePath)) {
    typeTags.push('type:archive');
  }
  
  return typeTags;
}

/**
 * Check if an entry belongs to a collection
 * @param {object} entry - Media entry object
 * @param {object} collection - Collection object
 * @returns {boolean} True if entry belongs to collection
 */
function isEntryInCollection(entry, collection) {
  if (!entry || !collection) return false;
  
  // Check if entry is explicitly marked as in collection
  if (entry.inCollection || entry.IN_COLLECTION) {
    return true;
  }
  
  // Check if entry path is within collection path
  if (entry.path && collection.path) {
    const normalizedEntryPath = normalizePath(entry.path);
    const normalizedCollectionPath = normalizePath(collection.path);
    return normalizedEntryPath.startsWith(normalizedCollectionPath);
  }
  
  return false;
}

/**
 * Generate hierarchy tags from collection name
 * @param {string} collectionName - Collection name
 * @returns {string[]} Array of hierarchy tags
 */
function generateHierarchyTags(collectionName) {
  if (!collectionName) return [];
  
  const hierarchyTags = [];
  const parts = collectionName.split(/[\/\\]/).filter(part => part.trim());
  
  // Generate tags for each level of hierarchy
  for (let i = 0; i < parts.length; i++) {
    const hierarchyLevel = parts.slice(0, i + 1).join(':');
    hierarchyTags.push(`series:${sanitizeTagName(hierarchyLevel)}`);
  }
  
  return hierarchyTags;
}

/**
 * Sanitize collection name for use as tag name
 * @param {string} name - Original collection name
 * @returns {string} Sanitized tag name
 */
function sanitizeTagName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/[^\w\s-.:]/g, '') // Remove special characters except word chars, spaces, hyphens, dots, colons
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[_-]+/g, '_') // Collapse multiple underscores/hyphens
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
}

/**
 * Normalize file path for comparison
 * @param {string} path - File path
 * @returns {string} Normalized path
 */
function normalizePath(path) {
  if (!path) return '';
  
  return path
    .replace(/\\/g, '/') // Convert backslashes to forward slashes
    .toLowerCase()
    .replace(/\/+$/, ''); // Remove trailing slashes
}

/**
 * Get all unique ghost tags from a collection of entries
 * @param {object[]} entries - Array of media entries
 * @param {object[]} collections - Array of collections
 * @returns {object} Object with categorized ghost tags
 */
function getAllGhostTags(entries, collections = []) {
  if (!entries || !Array.isArray(entries)) {
    return { series: [], types: [], all: [] };
  }
  
  const seriesSet = new Set();
  const typesSet = new Set();
  const allSet = new Set();
  
  entries.forEach(entry => {
    const ghostTags = generateGhostTags(entry, collections);
    
    ghostTags.forEach(tag => {
      allSet.add(tag);
      
      if (tag.startsWith('series:')) {
        seriesSet.add(tag);
      } else if (tag.startsWith('type:')) {
        typesSet.add(tag);
      }
    });
  });
  
  return {
    series: Array.from(seriesSet).sort(),
    types: Array.from(typesSet).sort(),
    all: Array.from(allSet).sort()
  };
}

export {
  generateGhostTags,
  generateSeriesGhostTags,
  generateTypeGhostTags,
  isEntryInCollection,
  generateHierarchyTags,
  sanitizeTagName,
  normalizePath,
  getAllGhostTags
};
