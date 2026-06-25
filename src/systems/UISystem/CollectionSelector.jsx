import React, { useState, useEffect } from 'react';

/**
 * Collection Selector Component
 * Provides a proper modal window for adding entries to collections
 * Uses electronAPI for all IPC operations (facade pattern)
 */
const CollectionSelector = ({ 
  visible, 
  onClose, 
  targetEntry, 
  onUpdate,
  entryCollections = []
}) => {
  const [userCollections, setUserCollections] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load user collections and initialize selection when component becomes visible
  useEffect(() => {
    if (visible && targetEntry) {
      loadUserCollections();
      // Initialize selected collections from entryCollections
      const selected = new Set(entryCollections.map(col => col.ID));
      setSelectedCollections(selected);
      // Reset search query when modal opens
      setSearchQuery('');
    }
  }, [visible, targetEntry, entryCollections]);

  // Filter collections based on search query
  const filteredCollections = userCollections.filter(collection =>
    collection.NAME.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadUserCollections = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getUserCollections();
      console.log('CollectionSelector: loaded collections:', result);
      if (result && result.success && result.data) {
        setUserCollections(result.data);
      } else {
        setError(result?.error || 'Failed to load collections');
        setUserCollections([]);
      }
    } catch (err) {
      console.error('CollectionSelector: error loading collections:', err);
      setError(`Failed to load collections: ${err.message}`);
      setUserCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCollection = (collectionId) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelectedCollections(newSelected);
  };

  const handleApplyChanges = async () => {
    if (!targetEntry) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Get current collection memberships for this entry
      const currentMemberships = new Set(entryCollections.map(col => col.ID));
      
      // Find collections to add (selected but not current)
      const toAdd = Array.from(selectedCollections).filter(id => !currentMemberships.has(id));
      
      // Find collections to remove (current but not selected)
      const toRemove = Array.from(currentMemberships).filter(id => !selectedCollections.has(id));
      
      console.log('CollectionSelector: applying changes:', { toAdd, toRemove });
      
      // Add to new collections
      for (const collectionId of toAdd) {
        const result = await window.electronAPI.addEntryToCollection(targetEntry.ID, collectionId);
        if (!result || !result.success) {
          throw new Error(`Failed to add to collection: ${result?.error || 'Unknown error'}`);
        }
      }
      
      // Remove from old collections
      for (const collectionId of toRemove) {
        const result = await window.electronAPI.removeEntryFromCollection(targetEntry.ID, collectionId);
        if (!result || !result.success) {
          throw new Error(`Failed to remove from collection: ${result?.error || 'Unknown error'}`);
        }
      }
      
      // Update entryCollections with new state
      const newEntryCollections = userCollections.filter(col => selectedCollections.has(col.ID));
      
      if (onUpdate) {
        onUpdate(newEntryCollections);
      }
      
      onClose();
    } catch (err) {
      console.error('CollectionSelector: error applying changes:', err);
      setError(`Failed to update collections: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || !targetEntry) return null;

  return (
    <div className="tag-manager-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="collection-selector-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="tag-manager-header">
          <h2>Add to Collections</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '16px' }}>
            Select collections for: <strong style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{targetEntry.NAME}</strong>
          </div>

          {error && (
            <div className="tag-manager-error">
              {error}
            </div>
          )}

          <div className="tag-search-container">
            <input
              type="text"
              className="tag-search-input"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="tag-manager-list">
            {loading ? (
              <div className="loading">Loading collections...</div>
            ) : filteredCollections.length === 0 ? (
              <div className="no-tags">
                {searchQuery ? 'No collections match your search.' : 'No user collections found. Create collections in Manage Collections first.'}
              </div>
            ) : (
              <div className="tag-list-compact">
                {filteredCollections.map((collection) => (
                  <div key={collection.ID} className="tag-item-compact">
                    <div className="tag-display-compact">
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedCollections.has(collection.ID)}
                          onChange={() => handleToggleCollection(collection.ID)}
                          style={{ marginRight: '12px' }}
                          disabled={loading}
                        />
                        <span className="tag-name-compact">
                          {collection.NAME}
                          <span className="selected-tag-more" style={{ marginLeft: '8px' }}>
                            User
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="tag-manager-footer">
          <button 
            onClick={onClose} 
            className="close-dialog-button"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            onClick={handleApplyChanges}
            className="add-tag-button"
            disabled={loading}
          >
            {loading ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollectionSelector;
