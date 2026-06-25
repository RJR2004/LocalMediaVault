import React, { useState, useEffect } from 'react';
import * as SearchEngine from '../SearchEngine';
import { useTagOperations } from './hooks/useTagOperations';

/**
 * Tag Manager Component
 * Provides interface to manage all tags in the library
 * Uses SearchEngine facade for all operations
 */
const TagManager = ({ visible, onClose, onUpdate }) => {
  const [allTags, setAllTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTags, setFilteredTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editTagName, setEditTagName] = useState('');

  // Use shared hook for tag operations
  const { loading, error, createGlobalTag, deleteGlobalTag, renameGlobalTag, getAllTagsWithSearch, clearError } = useTagOperations();

  // Load all tags when component becomes visible
  useEffect(() => {
    if (visible) {
      loadTags();
    }
  }, [visible]);

  // Real-time search filtering
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = allTags.filter(tag => 
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(allTags);
    }
  }, [searchQuery, allTags]);

  const loadTags = async () => {
    // Use the new hook function for consistent error handling
    const tags = await getAllTagsWithSearch();
    if (tags) {
      setAllTags(tags);
      setFilteredTags(tags);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    await createGlobalTag(
      newTagName.trim(),
      () => {
        setNewTagName('');
        loadTags(); // Reload tags
        clearError();
      }
    );
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleDeleteTag = async (tagName) => {
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"?`)) return;

    await deleteGlobalTag(
      tagName,
      () => {
        loadTags(); // Reload tags
        clearError();
      }
    );
  };

  const handleStartEdit = (tag) => {
    setEditingTag(tag);
    setEditTagName(tag);
  };

  const handleSaveEdit = async () => {
    if (!editTagName.trim() || editingTag === editTagName.trim()) {
      setEditingTag(null);
      setEditTagName('');
      return;
    }

    await renameGlobalTag(
      editingTag,
      editTagName.trim(),
      () => {
        setEditingTag(null);
        setEditTagName('');
        loadTags(); // Reload tags
        clearError();
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingTag(null);
    setEditTagName('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddTag();
    }
  };

  if (!visible) return null;

  return (
    <div className="tag-manager-overlay">
      <div className="collection-and-tag-manager-dialog">
        <div className="tag-manager-header">
          <h2>Manage Tags</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="tag-manager-error">
            {error}
          </div>
        )}

        <div className="tag-manager-add">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter new tag name..."
            className="tag-input"
            disabled={loading}
          />
          <button 
            onClick={handleAddTag}
            disabled={loading || !newTagName.trim()}
            className="add-tag-button"
          >
            Add Tag
          </button>
        </div>

        <div className="tag-manager-search">
          <div className="search-input-container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search tags..."
              className="tag-search-input"
              disabled={loading}
            />
            {searchQuery && (
              <button 
                onClick={clearSearch}
                className="clear-search-button"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <div className="search-results-count">
            {filteredTags.length} of {allTags.length} tags
          </div>
        </div>

        <div className="tag-manager-list">
          {loading ? (
            <div className="loading">Loading tags...</div>
          ) : allTags.length === 0 ? (
            <div className="no-tags">No tags found. Create your first tag above!</div>
          ) : (
            <div className="tag-list-compact">
              {filteredTags.map((tag) => (
                <div key={tag} className="tag-item-compact">
                  {editingTag === tag ? (
                    <div className="tag-edit-compact">
                      <input
                        type="text"
                        value={editTagName}
                        onChange={(e) => setEditTagName(e.target.value)}
                        className="tag-input-compact"
                        disabled={loading}
                      />
                      <div className="tag-edit-actions-compact">
                        <button 
                          onClick={handleSaveEdit}
                          disabled={loading}
                          className="save-button-compact"
                          title="Save"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="cancel-button-compact"
                          title="Cancel"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="tag-display-compact">
                      <span className="tag-name-compact">{tag}</span>
                      <div className="tag-actions-compact">
                        <button 
                          onClick={() => handleStartEdit(tag)}
                          className="edit-button-compact"
                          title="Edit tag"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteTag(tag)}
                          className="delete-button-compact"
                          title="Delete tag"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )}
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
  );
};

export default TagManager;
