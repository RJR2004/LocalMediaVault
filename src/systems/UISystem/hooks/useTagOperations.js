import { useState } from 'react';

/**
 * Shared hook for tag operations to eliminate duplication
 * Maintains all current functionality while centralizing logic
 */
export const useTagOperations = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Generic error handler - preserves current behavior
  const handleOperation = async (operation, operationName, successCallback) => {
    if (loading) return { success: false, error: 'Operation in progress' }; // Prevent concurrent operations
    
    try {
      setLoading(true);
      setError('');
      console.log(`useTagOperations: Starting ${operationName}`);
      
      const result = await operation();
      console.log(`useTagOperations: ${operationName} result:`, result);
      
      if (result && !result.success) {
        throw new Error(result.error || `Failed to ${operationName}`);
      }
      
      if (successCallback) {
        successCallback(result);
      }
      
      console.log(`useTagOperations: ${operationName} completed successfully`);
      return result; // Return the result for the caller to use
    } catch (err) {
      console.error(`useTagOperations: ${operationName} error:`, err);
      setError(`Failed to ${operationName}: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Global tag creation (for TagManager)
  const createGlobalTag = async (tagName, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.addTag(tagName.trim()),
      'create global tag',
      onSuccess
    );
  };

  // Item-specific tag creation (for ContextMenu)
  const addItemTag = async (entryId, tagName, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.addTagToEntry(entryId, tagName.trim()),
      'add tag to item',
      onSuccess
    );
  };

  // Tag deletion (for TagManager)
  const deleteGlobalTag = async (tagName, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.removeTag(tagName),
      'delete global tag',
      onSuccess
    );
  };

  // Tag renaming (for TagManager)
  const renameGlobalTag = async (oldName, newName, onSuccess) => {
    return handleOperation(
      async () => {
        await window.electronAPI.renameTag(oldName, newName.trim());
      },
      'rename global tag',
      onSuccess
    );
  };

  // Entry rating (for ContextMenu)
  const setEntryRating = async (entryId, rating, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.setEntryRating(entryId, rating),
      'set entry rating',
      onSuccess
    );
  };

  // Collection rating (for ContextMenu)
  const setCollectionRating = async (collectionId, rating, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.setCollectionRating(collectionId, rating),
      'set collection rating',
      onSuccess
    );
  };

  // Collection tagging operations (for ContextMenu)
  const addCollectionTag = async (collectionId, tagName, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.addTagToCollection(collectionId, tagName.trim()),
      'add tag to collection',
      onSuccess
    );
  };

  const removeCollectionTag = async (collectionId, tagName, onSuccess) => {
    return handleOperation(
      () => window.electronAPI.removeTagFromCollection(collectionId, tagName),
      'remove tag from collection',
      onSuccess
    );
  };

  // NEW: Get all tags with search support
  const getAllTagsWithSearch = async (searchQuery = '') => {
    try {
      const response = await window.electronAPI.getAllTags();
      console.log('useTagOperations: getAllTags response:', response);
      
      if (response && response.success && response.data) {
        // Client-side filtering (maintains IPC boundary)
        const filtered = searchQuery.trim()
          ? response.data.filter(tag => 
              tag.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : response.data;
        console.log('useTagOperations: filtered tags:', filtered);
        return filtered;
      } else {
        console.error('useTagOperations: getAllTags failed:', response);
        return [];
      }
    } catch (err) {
      console.error('useTagOperations: getAllTags error:', err);
      return [];
    }
  };

  // Generic functions to reduce duplication
  const getTags = async (id, type) => {
    const apiCall = type === 'entry' 
      ? () => window.electronAPI.getEntryTags(id)
      : () => window.electronAPI.getCollectionTags(id);
    
    try {
      const response = await apiCall();
      console.log(`useTagOperations: get${type}Tags response:`, response);
      
      if (response && response.success && response.data) {
        return response.data;
      } else {
        console.error(`useTagOperations: get${type}Tags failed:`, response);
        return [];
      }
    } catch (err) {
      console.error(`useTagOperations: get${type}Tags error:`, err);
      return [];
    }
  };

  const addMultipleTags = async (id, tagNames, type) => {
    return handleOperation(
      async () => {
        // Get existing tags first to prevent duplicates
        const existingTagsResult = type === 'entry' 
          ? await window.electronAPI.getEntryTags(id)
          : await window.electronAPI.getCollectionTags(id);
        const existingTags = existingTagsResult.success ? existingTagsResult.data || [] : [];
        
        // Filter out duplicates and trim whitespace
        const newTags = tagNames
          .map(tag => tag.trim())
          .filter(tag => tag && !existingTags.includes(tag));
        
        if (newTags.length === 0) {
          return { 
            success: true, 
            message: 'No new tags to add (all tags already exist)',
            added: 0,
            skipped: tagNames.length 
          };
        }
        
        // Add only new tags
        for (const tagName of newTags) {
          if (type === 'entry') {
            await window.electronAPI.addTagToEntry(id, tagName);
          } else {
            await window.electronAPI.addTagToCollection(id, tagName);
          }
        }
        
        return { 
          success: true, 
          message: `Added ${newTags.length} new tags`,
          added: newTags.length,
          skipped: tagNames.length - newTags.length 
        };
      },
      `add multiple tags to ${type}`,
      (result) => result
    );
  };

  // Add multiple tags to entry with duplicate prevention
  const addMultipleTagsToEntry = (entryId, tagNames) => addMultipleTags(entryId, tagNames, 'entry');

  // Add multiple tags to collection with duplicate prevention
  const addMultipleTagsToCollection = (collectionId, tagNames) => addMultipleTags(collectionId, tagNames, 'collection');

  // Get tags for a specific entry
  const getEntryTags = (entryId) => getTags(entryId, 'entry');

  // Get tags for a specific collection
  const getCollectionTags = (collectionId) => getTags(collectionId, 'collection');

  return {
    loading,
    error,
    createGlobalTag,
    addItemTag,
    addCollectionTag,
    deleteGlobalTag,
    renameGlobalTag,
    setEntryRating,
    setCollectionRating,
    getAllTagsWithSearch,
    addMultipleTagsToEntry,
    addMultipleTagsToCollection,
    getEntryTags,
    getCollectionTags,
    clearError: () => setError('')
  };
};
