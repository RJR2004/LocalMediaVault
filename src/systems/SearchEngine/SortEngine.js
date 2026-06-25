// SortEngine - Natural sorting algorithms for ratings and names

/**
 * Sort entries based on criteria and order
 * @param {object[]} entries - Array of entries to sort
 * @param {string} sortBy - Sort criteria ('name', 'rating', 'dateAdded', 'type', 'path')
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @returns {object[]} Sorted entries array
 */
function sort(entries, sortBy = 'name', sortOrder = 'asc') {
  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  if (entries.length <= 1) {
    return [...entries];
  }

  const sortedEntries = [...entries];
  
  sortedEntries.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = naturalCompare(getName(a), getName(b));
        break;
        
      case 'rating':
        comparison = compareRating(a, b, sortOrder);
        break;
        
      case 'dateAdded':
        comparison = compareDateAdded(a, b, sortOrder);
        break;
        
      case 'type':
        comparison = compareType(a, b, sortOrder);
        break;
        
      case 'path':
        comparison = naturalCompare(getPath(a), getPath(b));
        break;
        
      case 'size':
        comparison = compareSize(a, b, sortOrder);
        break;
        
      default:
        comparison = naturalCompare(getName(a), getName(b));
        break;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return sortedEntries;
}

/**
 * Natural string comparison with numeric sorting
 * @param {string} a - First string
 * @param {string} b - Second string  
 * @returns {number} Comparison result (-1, 0, 1)
 */
function naturalCompare(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  
  const aStr = String(a).toLowerCase();
  const bStr = String(b).toLowerCase();
  
  // Split strings into parts (text and numbers)
  const aParts = aStr.match(/(\d+|\D+)/g) || [];
  const bParts = bStr.match(/(\d+|\D+)/g) || [];
  
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    // Check if both parts are numeric
    const aIsNum = /^\d+$/.test(aPart);
    const bIsNum = /^\d+$/.test(bPart);
    
    if (aIsNum && bIsNum) {
      // Compare as numbers
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    } else {
      // Compare as strings
      if (aPart !== bPart) {
        return aPart.localeCompare(bPart);
      }
    }
  }
  
  return 0;
}

/**
 * Compare entries by rating
 * @param {object} a - First entry
 * @param {object} b - Second entry
 * @param {string} sortOrder - Overall sort order ('asc' or 'desc')
 * @returns {number} Comparison result
 */
function compareRating(a, b, sortOrder = 'asc') {
  const aRating = getRating(a);
  const bRating = getRating(b);
  
  if (aRating === bRating) {
    // Secondary sort by name, respecting the overall sort order
    const nameComparison = naturalCompare(getName(a), getName(b));
    return sortOrder === 'desc' ? -nameComparison : nameComparison;
  }
  
  return aRating - bRating;
}

/**
 * Compare entries by date added
 * @param {object} a - First entry
 * @param {object} b - Second entry
 * @param {string} sortOrder - Overall sort order ('asc' or 'desc')
 * @returns {number} Comparison result
 */
function compareDateAdded(a, b, sortOrder = 'asc') {
  const aDate = getDateAdded(a);
  const bDate = getDateAdded(b);
  
  if (aDate === bDate) {
    // Secondary sort by name, respecting the overall sort order
    const nameComparison = naturalCompare(getName(a), getName(b));
    return sortOrder === 'desc' ? -nameComparison : nameComparison;
  }
  
  return aDate - bDate;
}

/**
 * Compare entries by type
 * @param {object} a - First entry
 * @param {object} b - Second entry
 * @param {string} sortOrder - Overall sort order ('asc' or 'desc')
 * @returns {number} Comparison result
 */
function compareType(a, b, sortOrder = 'asc') {
  const aType = getType(a);
  const bType = getType(b);
  
  if (aType === bType) {
    // Secondary sort by name, respecting the overall sort order
    const nameComparison = naturalCompare(getName(a), getName(b));
    return sortOrder === 'desc' ? -nameComparison : nameComparison;
  }
  
  return aType.localeCompare(bType);
}

/**
 * Compare entries by file size
 * @param {object} a - First entry
 * @param {object} b - Second entry
 * @param {string} sortOrder - Overall sort order ('asc' or 'desc')
 * @returns {number} Comparison result
 */
function compareSize(a, b, sortOrder = 'asc') {
  const aSize = getSize(a);
  const bSize = getSize(b);
  
  if (aSize === bSize) {
    // Secondary sort by name, respecting the overall sort order
    const nameComparison = naturalCompare(getName(a), getName(b));
    return sortOrder === 'desc' ? -nameComparison : nameComparison;
  }
  
  return aSize - bSize;
}

/**
 * Get entry name with fallbacks
 * @param {object} entry - Entry object
 * @returns {string} Entry name
 */
function getName(entry) {
  return entry?.name || entry?.NAME || '';
}

/**
 * Get entry path with fallbacks
 * @param {object} entry - Entry object
 * @returns {string} Entry path
 */
function getPath(entry) {
  return entry?.path || entry?.PATH || '';
}

/**
 * Get entry rating with fallbacks
 * @param {object} entry - Entry object
 * @returns {number} Entry rating
 */
function getRating(entry) {
  return entry?.rating || entry?.RATING || 0;
}

/**
 * Get entry date added with fallbacks
 * @param {object} entry - Entry object
 * @returns {number} Date added timestamp
 */
function getDateAdded(entry) {
  return entry?.dateAdded || entry?.DATE_ADDED || 0;
}

/**
 * Get entry type with fallbacks
 * @param {object} entry - Entry object
 * @returns {string} Entry type
 */
function getType(entry) {
  return entry?.type || entry?.TYPE || '';
}

/**
 * Get entry size with fallbacks
 * @param {object} entry - Entry object
 * @returns {number} Entry size in bytes
 */
function getSize(entry) {
  return entry?.size || entry?.SIZE || 0;
}

/**
 * Get available sort options
 * @returns {object[]} Array of sort option objects
 */
function getSortOptions() {
  return [
    { key: 'name', label: 'Name', description: 'Sort by entry name (natural order)' },
    { key: 'rating', label: 'Rating', description: 'Sort by rating (0-100)' },
    { key: 'dateAdded', label: 'Date Added', description: 'Sort by date when entry was added' },
    { key: 'type', label: 'Type', description: 'Sort by file type' },
    { key: 'path', label: 'Path', description: 'Sort by file path' },
    { key: 'size', label: 'Size', description: 'Sort by file size' }
  ];
}

/**
 * Multi-level sort with multiple criteria
 * @param {object[]} entries - Array of entries to sort
 * @param {object[]} sortCriteria - Array of {sortBy, sortOrder} objects
 * @returns {object[]} Sorted entries array
 */
function multiSort(entries, sortCriteria) {
  if (!entries || !Array.isArray(entries) || !sortCriteria || !Array.isArray(sortCriteria)) {
    return sort(entries);
  }

  if (entries.length <= 1 || sortCriteria.length === 0) {
    return [...entries];
  }

  const sortedEntries = [...entries];
  
  sortedEntries.sort((a, b) => {
    for (const criterion of sortCriteria) {
      let comparison = 0;
      
      switch (criterion.sortBy) {
        case 'name':
          comparison = naturalCompare(getName(a), getName(b));
          break;
        case 'rating':
          comparison = compareRating(a, b);
          break;
        case 'dateAdded':
          comparison = compareDateAdded(a, b);
          break;
        case 'type':
          comparison = compareType(a, b);
          break;
        case 'path':
          comparison = naturalCompare(getPath(a), getPath(b));
          break;
        case 'size':
          comparison = compareSize(a, b);
          break;
        default:
          comparison = naturalCompare(getName(a), getName(b));
          break;
      }
      
      if (comparison !== 0) {
        return criterion.sortOrder === 'desc' ? -comparison : comparison;
      }
    }
    
    return 0;
  });
  
  return sortedEntries;
}

export {
  sort,
  naturalCompare,
  compareRating,
  compareDateAdded,
  compareType,
  compareSize,
  getSortOptions,
  multiSort
};
