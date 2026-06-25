// SearchEngine Public API
import * as QueryParser from './QueryParser.js';
import * as FilterEngine from './FilterEngine.js';
import * as TagGenerator from './TagGenerator.js';
import * as SortEngine from './SortEngine.js';

/*
interface SearchEngine {
  execute(query: string, entries: MediaEntry[], filters: FilterState): SearchResult
  parseQuery(query: string): ParsedQuery
  getGhostTags(entry: MediaEntry, collections: CollectionEntry[]): string[]
  getAllTags(entries: MediaEntry[]): string[]
}
*/

/**
 * Execute a search query against media entries with filters
 * @param {string} query - Search query string
 * @param {object[]} entries - Array of media entries
 * @param {object} filters - Filter state object
 * @returns {object} SearchResult with filtered and sorted entries
 */
function execute(query, entries, filters = {}) {
  try {
    // Parse the query into an AST
    const parsedQuery = QueryParser.parse(query);
    
    // Apply filters to entries
    const filteredEntries = FilterEngine.apply(parsedQuery, entries, filters);
    
    // Sort the results
    const sortedEntries = SortEngine.sort(filteredEntries, filters.sortBy || 'name', filters.sortOrder || 'asc');
    
    return {
      entries: sortedEntries,
      totalCount: sortedEntries.length,
      query: parsedQuery,
      filters: filters
    };
  } catch (error) {
    console.error('SearchEngine.execute error:', error);
    return {
      entries: [],
      totalCount: 0,
      query: { type: 'error', error: error.message },
      filters: filters
    };
  }
}

/**
 * Parse a query string into an Abstract Syntax Tree
 * @param {string} query - Query string to parse
 * @returns {object} ParsedQuery AST
 */
function parseQuery(query) {
  return QueryParser.parse(query);
}

/**
 * Generate ghost tags for a media entry based on collections
 * @param {object} entry - Media entry object
 * @param {object[]} collections - Array of collections
 * @returns {string[]} Array of ghost tag strings
 */
function getGhostTags(entry, collections = []) {
  return TagGenerator.generateGhostTags(entry, collections);
}

/**
 * Get all unique tags from a list of entries (includes ghost tags)
 * @param {object[]} entries - Array of media entries
 * @param {object[]} collections - Array of collections (optional)
 * @returns {string[]} Array of unique tag names
 */
function getAllTags(entries, collections = []) {
  const tagSet = new Set();
  
  // Add explicit tags from entries
  entries.forEach(entry => {
    if (entry.tags && Array.isArray(entry.tags)) {
      entry.tags.forEach(tag => tagSet.add(tag));
    }
    
    // Add ghost tags
    const ghostTags = TagGenerator.generateGhostTags(entry, collections);
    ghostTags.forEach(tag => tagSet.add(tag));
  });
  
  return Array.from(tagSet).sort();
}


export {
  execute,
  parseQuery,
  getGhostTags,
  getAllTags
};
