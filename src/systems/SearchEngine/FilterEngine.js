// FilterEngine - Filter application logic
// Apply parsed queries to entry arrays with ghost tags support

import * as TagGenerator from './TagGenerator.js';

/**
 * Apply a parsed query and filters to an array of entries
 * @param {object} parsedQuery - Parsed query AST
 * @param {object[]} entries - Array of media entries
 * @param {object} filters - Additional filter options
 * @returns {object[]} Filtered entries array
 */
function apply(parsedQuery, entries, filters = {}) {
  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  let filteredEntries = [...entries];

  // Apply query filter
  if (parsedQuery && parsedQuery.type !== 'empty') {
    filteredEntries = filteredEntries.filter(entry => evaluateQuery(parsedQuery, entry, filters));
  }

  // Apply additional filters
  if (filters.contentType && filters.contentType !== 'all') {
    filteredEntries = applyContentTypeFilter(filteredEntries, filters.contentType);
  }

  if (filters.inCollection !== undefined) {
    filteredEntries = filteredEntries.filter(entry => {
      const inCollection = entry.inCollection || entry.IN_COLLECTION || 0;
      return Boolean(inCollection) === Boolean(filters.inCollection);
    });
  }

  return filteredEntries;
}

/**
 * Evaluate a query AST node against an entry
 * @param {object} queryNode - Query AST node
 * @param {object} entry - Media entry
 * @param {object} filters - Filter context
 * @returns {boolean} True if entry matches query
 */
function evaluateQuery(queryNode, entry, filters = {}) {
  if (!queryNode) return true;

  switch (queryNode.type) {
    case 'empty':
      return true;

    case 'error':
      return false;

    case 'AND':
      return evaluateQuery(queryNode.left, entry, filters) && 
             evaluateQuery(queryNode.right, entry, filters);

    case 'OR':
      return evaluateQuery(queryNode.left, entry, filters) || 
             evaluateQuery(queryNode.right, entry, filters);

    case 'NOT':
      return !evaluateQuery(queryNode.operand, entry, filters);

    case 'TERM':
      return evaluateTermQuery(queryNode.value, entry, filters);

    case 'RATING':
      return evaluateRatingQuery(queryNode.operator, queryNode.value, entry);

    case 'SERIES':
      return evaluateSeriesQuery(queryNode.value, entry);

    default:
      return false;
  }
}

/**
 * Evaluate a series query against an entry
 * @param {string} collectionName - Collection name to match
 * @param {object} entry - Entry object with collections array
 * @returns {boolean} - Whether entry matches the series query
 */
function evaluateSeriesQuery(collectionName, entry) {
  if (!entry.collections || !Array.isArray(entry.collections)) {
    return false;
  }
  
  const targetName = collectionName.toLowerCase();
  
  // Check if entry is in the specified collection
  return entry.collections.some(collection => 
    collection.name && collection.name.toLowerCase() === targetName
  );
}

/**
 * Evaluate a term query against an entry
 * @param {string} term - Search term
 * @param {object} entry - Media entry
 * @param {object} filters - Filter context with collections
 * @returns {boolean} True if entry matches term
 */

  function evaluateTermQuery(term, entry, filters = {}) {
  if (!term || !entry) return false;

  const lowerTerm = term.toLowerCase();

  // 1. Check Name - ONLY if searchNames is not explicitly set to false
  if (filters.searchNames !== false) {
    const name = entry.NAME || entry.name;
    if (name && name.toLowerCase().includes(lowerTerm)) {
      return true;
    }
  }

  // 2. Check Explicit Tags (Handle both TAGS and tags)
  const tags = entry.TAGS || entry.tags;
  if (tags && Array.isArray(tags)) {
    if (tags.some(tag => tag.toLowerCase().includes(lowerTerm))) {
      return true;
    }
  }

  /* 3. Check Path (Handle both PATH and path)
  const path = entry.PATH || entry.path;
  if (path && path.toLowerCase().includes(lowerTerm)) {
    return true;
  }*/

  // 4. Check Ghost Tags
  const collections = filters.collections || [];
  const ghostTags = TagGenerator.generateGhostTags(entry, collections);
  if (ghostTags.some(tag => tag.toLowerCase().includes(lowerTerm))) {
    return true;
  }

  return false;
}

/*function evaluateTermQuery(term, entry, filters = {}) {
  if (!term || !entry) return false;

  const lowerTerm = term.toLowerCase();
  console.log(`Searching for "${lowerTerm}" in item:`, entry);

  // Check entry name (Handle both NAME and name)
  const name = entry.NAME || entry.name;
  if (name && name.toLowerCase().includes(lowerTerm)) {
    return true;
  }
 If you want to add the path to search paramaters
  // Check entry path (Handle both PATH and path)
  const path = entry.PATH || entry.path;
  if (path && path.toLowerCase().includes(lowerTerm)) {
    return true;
  }

  // Check explicit tags (Handle both TAGS and tags)
  const tags = entry.TAGS || entry.tags;
  if (tags && Array.isArray(tags)) {
    if (tags.some(tag => tag.toLowerCase().includes(lowerTerm))) {
      return true;
    }
  }
  // Check entry name
  if (entry.name && entry.name.toLowerCase().includes(lowerTerm)) {
    return true;
  }

  // Check entry path
  if (entry.path && entry.path.toLowerCase().includes(lowerTerm)) {
    return true;
  }

  // Check explicit tags
  if (entry.tags && Array.isArray(entry.tags)) {
    if (entry.tags.some(tag => tag.toLowerCase().includes(lowerTerm))) {
      return true;
    }
  }

  // Check ghost tags
  const collections = filters.collections || [];
  const ghostTags = TagGenerator.generateGhostTags(entry, collections);
  if (ghostTags.some(tag => tag.toLowerCase().includes(lowerTerm))) {
    return true;
  }

  return false;
}*/


/**
 * Evaluate a rating query against an entry
 * @param {string} operator - Rating operator (>, <, =, ?)
 * @param {number|null} value - Rating value
 * @param {object} entry - Media entry
 * @returns {boolean} True if entry matches rating condition
 */
function evaluateRatingQuery(operator, value, entry) {
  const entryRating = entry.rating || entry.RATING || 0;

  switch (operator) {
    case '>':
      return value !== null && entryRating > value;
    case '<':
      return value !== null && entryRating < value;
    case '=':
      return value !== null && entryRating === value;
    case '?':
      // No rating set (rating = 0)
      return entryRating === 0;
    default:
      return false;
  }
}

/**
 * Apply content type filter to entries
 * @param {object[]} entries - Array of entries
 * @param {string} contentType - Content type filter
 * @returns {object[]} Filtered entries
 */
function applyContentTypeFilter(entries, contentType) {
  if (!contentType || contentType === 'all') {
    return entries;
  }

  return entries.filter(entry => {
    const entryType = (entry.type || '').toLowerCase();
    const inCollection = entry.inCollection || entry.IN_COLLECTION || 0;
    const isCollection = entry.itemType === 'collection' || entry.members !== undefined;

    switch (contentType) {
      case 'collections':
        // Show manual collections (AUTO_GENERATED = 0)
        return isCollection && entry.AUTO_GENERATED === 0;
      case 'series':
        // Show auto-generated series (AUTO_GENERATED = 1)
        return isCollection && entry.AUTO_GENERATED === 1;
      case 'chapters':
        // Show all media entries that are in collections
        return !isCollection && Boolean(inCollection);
      case 'standalone':
        // Show media entries that are not in any collection
        return !isCollection && !Boolean(inCollection);
      case 'images':
        return !isCollection && (entryType.includes('image') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(entry.path || ''));
      case 'videos':
        return !isCollection && (entryType.includes('video') || /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(entry.path || ''));
      case 'audio':
        return !isCollection && (entryType.includes('audio') || /\.(mp3|wav|flac|aac|ogg|wma)$/i.test(entry.path || ''));
      default:
        return true;
    }
  });
}

/**
 * Get available content type filters with counts
 * @param {object[]} entries - Array of entries
 * @returns {object} Content type filters with counts
 */
function getContentTypeFilters(entries) {
  if (!entries || !Array.isArray(entries)) {
    return {};
  }

  const counts = {
    all: entries.length,
    collections: 0,
    series: 0,
    chapters: 0,
    standalone: 0,
    images: 0,
    videos: 0,
    audio: 0
  };

  entries.forEach(entry => {
    const entryType = (entry.type || '').toLowerCase();
    const inCollection = entry.inCollection || entry.IN_COLLECTION || 0;
    const isCollection = entry.itemType === 'collection' || entry.members !== undefined;

    if (isCollection) {
      // This is a collection object
      if (entry.AUTO_GENERATED === 1) {
        counts.series++;
      } else {
        counts.collections++;
      }
    } else {
      // This is a media entry
      if (Boolean(inCollection)) {
        counts.chapters++;
      } else {
        counts.standalone++;
      }

      if (entryType.includes('image') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(entry.path || '')) {
        counts.images++;
      } else if (entryType.includes('video') || /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(entry.path || '')) {
        counts.videos++;
      } else if (entryType.includes('audio') || /\.(mp3|wav|flac|aac|ogg|wma)$/i.test(entry.path || '')) {
        counts.audio++;
      }
    }
  });

  return counts;
}

export {
  apply,
  evaluateQuery,
  evaluateTermQuery,
  evaluateRatingQuery,
  evaluateSeriesQuery,
  applyContentTypeFilter,
  getContentTypeFilters
};
