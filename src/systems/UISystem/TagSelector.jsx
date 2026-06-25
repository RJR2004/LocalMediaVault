import React, { useState, useEffect } from 'react';

/**
 * Enhanced Tag Selector Component with Preselection Support
 * Provides multi-select tag picker with search functionality and visual indicators
 * Maintains architectural compliance by using props for data
 */
function TagSelector({ 
  availableTags, 
  onSelectionChange,
  multiSelect = true,
  entryId = null, // Entry ID for loading existing tags
  collectionId = null // Collection ID for loading existing tags
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTags, setFilteredTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Load existing tags when component mounts or IDs change
  useEffect(() => {
    const loadExistingTags = async () => {
      if ((entryId || collectionId) && availableTags.length > 0) {
        setLoadingTags(true);
        try {
          let itemTags = [];
          
          if (entryId) {
            // Load entry tags through electronAPI
            const result = await window.electronAPI.getEntryTags(entryId);
            if (result && result.success) {
              itemTags = result.data || [];
            }
          } else if (collectionId) {
            // Load collection tags through electronAPI
            const result = await window.electronAPI.getCollectionTags(collectionId);
            if (result && result.success) {
              itemTags = result.data || [];
            }
          }
          
          // Filter to only include tags that exist in available tags
          const validExistingTags = itemTags.filter(tag => 
            availableTags.includes(tag)
          );
          
          console.log('TagSelector: loaded existing tags:', validExistingTags);
          setSelectedTags(validExistingTags);
          if (onSelectionChange) {
            onSelectionChange(validExistingTags);
          }
        } catch (error) {
          console.error('TagSelector: Error loading existing tags:', error);
        } finally {
          setLoadingTags(false);
        }
      }
    };

    loadExistingTags();
  }, [entryId, collectionId, availableTags]);

  // Filter tags based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = availableTags.filter(tag => 
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTags(filtered);
    } else {
      setFilteredTags(availableTags);
    }
  }, [searchQuery, availableTags]);

  const handleTagToggle = (tag) => {
    if (multiSelect) {
      const newSelection = selectedTags.includes(tag)
        ? selectedTags.filter(t => t !== tag)
        : [...selectedTags, tag];
      setSelectedTags(newSelection);
      onSelectionChange(newSelection);
    } else {
      setSelectedTags([tag]);
      onSelectionChange([tag]);
    }
  };

  const handleSelectAll = () => {
    if (!multiSelect) return;
    
    const allSelected = filteredTags.every(tag => selectedTags.includes(tag));
    if (allSelected) {
      // Deselect all filtered tags
      const newSelection = selectedTags.filter(tag => !filteredTags.includes(tag));
      setSelectedTags(newSelection);
      onSelectionChange(newSelection);
    } else {
      // Select all filtered tags
      const newSelection = [...new Set([...selectedTags, ...filteredTags])];
      setSelectedTags(newSelection);
      onSelectionChange(newSelection);
    }
  };

  return (
    <div className="tag-selector">
      {/* Search Bar */}
      <div className="tag-search-container">
        <input
          type="text"
          className="tag-search-input"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {multiSelect && (
          <button 
            className="select-all-button"
            onClick={handleSelectAll}
          >
            {filteredTags.every(tag => selectedTags.includes(tag)) ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>
      
      {/* Loading State */}
      {loadingTags && (
        <div className="loading-existing-tags">
          Loading existing tags...
        </div>
      )}
      
      {/* Tag Options List */}
      <div className="tag-options-list">
        {filteredTags.length === 0 ? (
          <div className="no-tags-found">
            {searchQuery.trim() ? 'No tags found matching your search.' : 'No tags available.'}
          </div>
        ) : (
          filteredTags.map(tag => {
            const isSelected = selectedTags.includes(tag);
            
            return (
              <label key={tag} className={`tag-option-item ${isSelected ? 'selected' : ''}`}>
                <input
                  type={multiSelect ? "checkbox" : "radio"}
                  checked={isSelected}
                  onChange={() => handleTagToggle(tag)}
                  className="tag-option-input"
                />
                <span className="tag-option-label">{tag}</span>
              </label>
            );
          })
        )}
      </div>

      {/* Selected Tags Summary */}
      {selectedTags.length > 0 && (
        <div className="selected-tags-summary">
          <span className="selected-count">{selectedTags.length} tags selected</span>
          <div className="selected-tags-actions">
            <div className="selected-tags-list">
              {selectedTags.slice(0, 5).map(tag => (
                <span key={tag} className="selected-tag-pill">{tag}</span>
              ))}
              {selectedTags.length > 5 && (
                <span className="selected-tag-more">+{selectedTags.length - 5} more</span>
              )}
            </div>
            <button 
              className="clear-selection"
              onClick={() => {
                setSelectedTags([]);
                onSelectionChange([]);
              }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TagSelector;
