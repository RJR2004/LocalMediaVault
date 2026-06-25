import React, { useState, useEffect } from 'react';

/**
 * Collection Manager Component
 * Provides interface to create and manage user-created collections
 * Uses electronAPI for all IPC operations (facade pattern)
 */
const CollectionManager = ({ visible, onClose, onUpdate }) => {
  const [collections, setCollections] = useState([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load user collections when component becomes visible
  useEffect(() => {
    if (visible) {
      loadCollections();
      // Reset search query when modal opens
      setSearchQuery('');
    }
  }, [visible]);

  const loadCollections = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.getUserCollections();
      console.log('CollectionManager: loaded collections:', result);
      if (result && result.success && result.data) {
        setCollections(result.data);
      } else {
        setError(result?.error || 'Failed to load collections');
        setCollections([]);
      }
    } catch (err) {
      console.error('CollectionManager: error loading collections:', err);
      setError(`Failed to load collections: ${err.message}`);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.createUserCollection(newCollectionName.trim());
      console.log('CollectionManager: create result:', result);
      if (result && result.success) {
        setNewCollectionName('');
        await loadCollections();
        if (onUpdate) onUpdate();
      } else {
        setError(result?.error || 'Failed to create collection');
      }
    } catch (err) {
      console.error('CollectionManager: error creating collection:', err);
      setError(`Failed to create collection: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async (collectionId, collectionName) => {
    if (!confirm(`Are you sure you want to delete the collection "${collectionName}"?`)) return;

    setLoading(true);
    setError('');
    try {
      const result = await window.electronAPI.deleteUserCollection(collectionId);
      console.log('CollectionManager: delete result:', result);
      if (result && result.success) {
        await loadCollections();
        if (onUpdate) onUpdate();
      } else {
        setError(result?.error || 'Failed to delete collection');
      }
    } catch (err) {
      console.error('CollectionManager: error deleting collection:', err);
      setError(`Failed to delete collection: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  
  // Filter collections based on search query
  const filteredCollections = collections.filter(collection =>
    collection.NAME.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateCollection();
    }
  };

  if (!visible) return null;

  return (
    <div className="tag-manager-overlay">
      <div className="collection-and-tag-manager-dialog">
        <div className="tag-manager-header">
          <h2>Manage Collections</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="tag-manager-error">
            {error}
          </div>
        )}

        <div className="modal-body">
          <div className="tag-manager-add">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter new collection name..."
            className="tag-input"
            disabled={loading}
          />
          <button
            onClick={handleCreateCollection}
            disabled={loading || !newCollectionName.trim()}
            className="add-tag-button"
          >
            Create Collection
          </button>
        </div>

        <div className="tag-search-container">
          <input
            type="text"
            className="tag-search-input"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <div className="search-results-count">
              {filteredCollections.length} of {collections.length} collections
            </div>
          )}
        </div>

        <div className="tag-manager-list">
          {loading ? (
            <div className="loading">Loading collections...</div>
          ) : filteredCollections.length === 0 ? (
            <div className="no-tags">
              {searchQuery ? 'No collections match your search.' : 'No user collections found. Create your first collection above!'}
            </div>
          ) : (
            <div className="tag-list-compact">
              {filteredCollections.map((collection) => (
                <div key={collection.ID} className="tag-item-compact">
                  <div className="tag-display-compact">
                    <span className="tag-name-compact">
                      {collection.NAME}
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: 'var(--text-secondary, #888)',
                        backgroundColor: 'var(--background-tertiary, #3d3d3d)',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        User
                      </span>
                    </span>
                    <div className="tag-actions-compact">
                      <button
                        onClick={() => handleDeleteCollection(collection.ID, collection.NAME)}
                        className="delete-button-compact"
                        title="Delete collection"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tag-manager-footer">
          <button onClick={onClose} className="close-dialog-button">
            Close
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionManager;
