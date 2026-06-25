import React, { useState, useEffect, useRef } from 'react';
import * as SearchEngine from '../SearchEngine';
import { useTagOperations } from './hooks/useTagOperations';
import TagSelector from './TagSelector.jsx';
import RatingSlider from './RatingSlider.jsx';
import CollectionSelector from './CollectionSelector.jsx';

/**
 * Context Menu Component
 * Provides Add Tag, Set Rating, and Open Explorer functionality
 * Uses SearchEngine facade for all operations
 */
const ContextMenu = ({ 
  visible, 
  x, 
  y, 
  targetEntry, 
  targetCollection,
  onClose, 
  onUpdate 
}) => {
  // Debug props on every render
  console.log('ContextMenu: Render with props:', { 
    visible, x, y, targetEntry, targetCollection, hasOnUpdate: !!onUpdate 
  });

  const [showTagInput, setShowTagInput] = useState(false);
  const [showRatingInput, setShowRatingInput] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showRatingSlider, setShowRatingSlider] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [ratingInput, setRatingInput] = useState('');
  const [entryCollections, setEntryCollections] = useState([]);
  const menuRef = useRef(null);
  const tagInputRef = useRef(null);
  const ratingInputRef = useRef(null);

  // Use shared hook for tag operations
  const { loading, error, addItemTag, addCollectionTag, setEntryRating, setCollectionRating, getAllTagsWithSearch, addMultipleTagsToEntry, addMultipleTagsToCollection, getEntryTags, getCollectionTags, clearError } = useTagOperations();

  // Reset current rating when target changes
  useEffect(() => {
    setCurrentRating(getInitialRating());
  }, [targetEntry, targetCollection]);

  // Focus management
  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [showTagInput]);

  useEffect(() => {
    if (showRatingInput && ratingInputRef.current) {
      ratingInputRef.current.focus();
      // Pre-fill current rating if available
      const currentRating = getCurrentRating();
      setRatingInput(currentRating.toString());
    }
  }, [showRatingInput]);

  // Close on outside click (but not when clicking inside modals)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking inside any modal or its content
      if (event.target.closest('.modal-overlay') || 
          event.target.closest('.tag-selector-modal') || 
          event.target.closest('.rating-slider-modal')) {
        return;
      }
      
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [visible]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible]);

  const handleClose = () => {
    setShowTagInput(false);
    setShowRatingInput(false);
    setShowTagSelector(false);
    setShowRatingSlider(false);
    setShowCollectionSelector(false);
    setTagInput('');
    setRatingInput('');
    setEntryCollections([]);
    onClose();
  };

  const openCollectionSelector = async () => {
    if (!targetEntry) return;
    
    // Load current collection memberships for this entry
    try {
      const result = await window.electronAPI.getCollectionMembersForEntry(targetEntry.ID);
      console.log('ContextMenu: loaded collection memberships for entry:', result);
      if (result && result.success && result.data) {
        // Convert to collection objects format expected by CollectionSelector
        const currentCollections = result.data.map(membership => ({
          ID: membership.COLLECTION_ID,
          NAME: membership.collection_name
        }));
        setEntryCollections(currentCollections);
      } else {
        setEntryCollections([]);
      }
    } catch (err) {
      console.error('ContextMenu: error loading collection memberships:', err);
      setEntryCollections([]);
    }
    
    setShowCollectionSelector(true);
  };

  const handleCollectionSelectorUpdate = (newEntryCollections) => {
    setEntryCollections(newEntryCollections);
    if (onUpdate) onUpdate();
  };

  const [currentRating, setCurrentRating] = useState(getInitialRating());

  function getInitialRating() {
    if (targetEntry) {
      return targetEntry.RATING || 0; // Use uppercase as shown in console
    }
    if (targetCollection) {
      return targetCollection.RATING || 0; // Use uppercase as shown in console
    }
    return 0;
  }

  const getCurrentRating = () => {
    return currentRating;
  };

  const getItemDisplayName = () => {
    if (targetEntry) {
      // Try different possible name properties
      return targetEntry.NAME || targetEntry.name || targetEntry.TITLE || targetEntry.title || 
             targetEntry.filename || `Entry ${targetEntry.ID}` || 'Item';
    }
    if (targetCollection) {
      // Try different possible name properties
      return targetCollection.NAME || targetCollection.name || targetCollection.TITLE || targetCollection.title || 
             targetCollection.filename || `Collection ${targetCollection.ID}` || 'Collection';
    }
    return 'Item';
  };

  // Load available tags when tag selector opens
  const openTagSelector = async () => {
    const tags = await getAllTagsWithSearch();
    if (tags) {
      setAvailableTags(tags);
    }
    
    // Get existing tags for the item
    let itemTags = [];
    if (targetEntry) {
      itemTags = await getEntryTags(targetEntry.ID);
    } else if (targetCollection) {
      itemTags = await getCollectionTags(targetCollection.ID);
    }
    setExistingTags(itemTags);
    
    console.log('ContextMenu: existing tags for item:', itemTags);
    setShowTagSelector(true);
  };

  const handleTagSelection = async (selectedTags) => {
    if (targetEntry && selectedTags.length > 0) {
      const result = await addMultipleTagsToEntry(targetEntry.ID, selectedTags);
      
      if (result.success) {
        console.log(`ContextMenu: ${result.message || 'Tags updated successfully'}`);
        console.log(`ContextMenu: Added ${result.added || 0} new tags, skipped ${result.skipped || 0} duplicates`);
      }
      
      if (onUpdate) onUpdate();
    } else if (targetCollection && selectedTags.length > 0) {
      const result = await addMultipleTagsToCollection(targetCollection.ID, selectedTags);
      
      if (result.success) {
        console.log(`ContextMenu: ${result.message || 'Tags updated successfully'}`);
        console.log(`ContextMenu: Added ${result.added || 0} new tags, skipped ${result.skipped || 0} duplicates`);
      }
      
      if (onUpdate) onUpdate();
    }
  };

  const handleRatingChange = async (newRating) => {
    // Update local state immediately for real-time display
    setCurrentRating(newRating);
    
    if (targetEntry) {
      await setEntryRating(targetEntry.ID, newRating);
      // Don't close immediately - let user see the success and close manually
      if (onUpdate) onUpdate();
    } else if (targetCollection) {
      await setCollectionRating(targetCollection.ID, newRating);
      // Don't close immediately - let user see the success and close manually
      if (onUpdate) onUpdate();
    }
  };

  const handleSetRating = async () => {
    console.log('ContextMenu: handleSetRating called');
    console.log('ContextMenu: ratingInput:', ratingInput);
    console.log('ContextMenu: targetEntry:', targetEntry);
    console.log('ContextMenu: targetCollection:', targetCollection);
    
    const rating = parseInt(ratingInput);
    if (isNaN(rating) || rating < 0 || rating > 100) {
      alert('Rating must be a number between 0 and 100');
      return;
    }

    await handleRatingChange(rating);
  };

  const handleAddTag = async () => {
    console.log('ContextMenu: handleAddTag called');
    console.log('ContextMenu: tagInput:', tagInput);
    console.log('ContextMenu: targetEntry:', targetEntry);
    console.log('ContextMenu: targetCollection:', targetCollection);
    
    if (!tagInput.trim()) {
      console.log('ContextMenu: Empty tag input, returning');
      return;
    }

    const entryId = targetEntry?.ID;
    
    if (targetEntry && entryId) {
      await addItemTag(
        entryId,
        tagInput.trim(),
        () => {
          console.log('ContextMenu: Tag added successfully, calling onUpdate');
          if (onUpdate) onUpdate();
          setTagInput('');
          setShowTagInput(false);
          clearError();
        }
      );
    } else if (targetCollection) {
      const collectionId = targetCollection?.ID;
      await addCollectionTag(
        collectionId,
        tagInput.trim(),
        () => {
          console.log('ContextMenu: Collection tag added successfully, calling onUpdate');
          if (onUpdate) onUpdate();
          setTagInput('');
          setShowTagInput(false);
          clearError();
        }
      );
    } else {
      console.error('ContextMenu: No valid target entry or collection');
      alert('No valid item selected for tagging');
      return;
    }
  };

  const handleOpenExplorer = () => {
    const targetPath = targetEntry?.path || targetEntry?.PATH || 
                      targetCollection?.path || targetCollection?.PATH;
    
    if (!targetPath) {
      alert('No path available for this item');
      return;
    }

    try {
      // Use window.electronAPI to open file explorer
      if (window.electronAPI && window.electronAPI.openExplorer) {
        window.electronAPI.openExplorer(targetPath);
      } else {
        console.warn('Electron API not available');
        alert('File explorer functionality not available');
      }
    } catch (error) {
      console.error('Error opening explorer:', error);
      alert('Failed to open file explorer');
    }
    
    handleClose();
  };

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleAddTag();
    } else if (event.key === 'Escape') {
      setShowTagInput(false);
      setTagInput('');
    }
  };

  const handleRatingKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSetRating();
    } else if (event.key === 'Escape') {
      setShowRatingInput(false);
      setRatingInput('');
    }
  };

  if (!visible || (!targetEntry && !targetCollection)) {
    return null;
  }

  const menuStyle = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 9999,
    backgroundColor: 'var(--background-secondary, #2d2d2d)', // Fallback color
    border: '1px solid var(--border-color, #444)',
    borderRadius: '4px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    minWidth: '200px',
    padding: '4px 0',
    color: 'var(--text-primary, #fff)' // Ensure text color
  };

  const menuItemStyle = {
    padding: '8px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: 'var(--text-primary)'
  };

  const menuItemHoverStyle = {
    ...menuItemStyle,
    backgroundColor: 'var(--background-hover)'
  };

  const inputStyle = {
    width: '100%',
    padding: '4px 8px',
    border: '1px solid var(--border-color)',
    borderRadius: '3px',
    fontSize: '13px',
    backgroundColor: 'var(--background-primary)',
    color: 'var(--text-primary)'
  };

  const buttonStyle = {
    padding: '4px 8px',
    margin: '4px',
    border: '1px solid var(--border-color)',
    borderRadius: '3px',
    fontSize: '12px',
    cursor: 'pointer',
    backgroundColor: 'var(--background-primary)',
    color: 'var(--text-primary)'
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {/* Error Display */}
      {error && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: 'var(--error-background, #ff4444)',
          color: 'var(--error-text, #fff)',
          fontSize: '12px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {error}
        </div>
      )}

      {/* Add Tag Option */}
      {!showTagInput && !showRatingInput && !showTagSelector && !showRatingSlider && !showCollectionSelector && (
        <div
          style={menuItemStyle}
          onClick={(e) => {
            console.log('ContextMenu: Add Tags clicked');
            e.stopPropagation();
            openTagSelector();
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--background-hover)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          🏷️ Add Tags
        </div>
      )}

      {/* Add to Collection Option - Only for entries */}
      {targetEntry && !showTagInput && !showRatingInput && !showTagSelector && !showRatingSlider && !showCollectionSelector && (
        <div
          style={menuItemStyle}
          onClick={(e) => {
            console.log('ContextMenu: Add to Collection clicked');
            e.stopPropagation();
            openCollectionSelector();
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--background-hover)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          📁 Add to Collection
        </div>
      )}

      {/* Tag Input */}
      {showTagInput && (
        <div style={{ padding: '8px 16px' }}>
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Enter tag name..."
            style={inputStyle}
          />
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
            <button 
              onClick={(e) => {
                console.log('ContextMenu: Add Tag button clicked');
                e.stopPropagation();
                handleAddTag();
              }} 
              style={buttonStyle}
            >
              Add
            </button>
            <button 
              onClick={() => { setShowTagInput(false); setTagInput(''); }} 
              style={buttonStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Set Rating Option */}
      {!showTagInput && !showRatingInput && !showTagSelector && !showRatingSlider && !showCollectionSelector && (
        <div
          style={menuItemStyle}
          onClick={(e) => {
            console.log('ContextMenu: Set Rating clicked');
            e.stopPropagation();
            setShowRatingSlider(true);
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--background-hover)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ⭐ Set Rating ({getCurrentRating()})
        </div>
      )}

      {/* Rating Input */}
      {showRatingInput && (
        <div style={{ padding: '8px 16px' }}>
          <input
            ref={ratingInputRef}
            type="number"
            min="0"
            max="100"
            value={ratingInput}
            onChange={(e) => setRatingInput(e.target.value)}
            onKeyDown={handleRatingKeyDown}
            placeholder="Rating (0-100)"
            style={inputStyle}
          />
          <div style={{ marginTop: '4px', display: 'flex', gap: '4px' }}>
            <button 
              onClick={(e) => {
                console.log('ContextMenu: Set Rating button clicked');
                e.stopPropagation();
                handleSetRating();
              }} 
              style={buttonStyle}
            >
              Set
            </button>
            <button 
              onClick={() => { setShowRatingInput(false); setRatingInput(''); }} 
              style={buttonStyle}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Open Explorer Option */}
      {!showTagInput && !showRatingInput && !showTagSelector && !showRatingSlider && !showCollectionSelector && (
        <div
          style={menuItemStyle}
          onClick={handleOpenExplorer}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--background-hover)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          📁 Open in Explorer
        </div>
      )}

      {/* Tag Selector Modal */}
      {showTagSelector && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="tag-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Tags to {getItemDisplayName()}</h3>
              <button onClick={() => setShowTagSelector(false)}>&times;</button>
            </div>
            <TagSelector
              availableTags={availableTags}
              onSelectionChange={handleTagSelection}
              multiSelect={true}
              entryId={targetEntry?.ID || null}
              collectionId={targetCollection?.ID || null}
            />
            <div className="modal-footer">
              <button onClick={() => setShowTagSelector(false)} className="modal-close-button">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Slider Modal */}
      {showRatingSlider && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="rating-slider-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Set Rating for {getItemDisplayName()}</h3>
              <button onClick={() => setShowRatingSlider(false)}>&times;</button>
            </div>
            <RatingSlider
              initialValue={getCurrentRating()}
              onRatingChange={handleRatingChange}
            />
            <div className="modal-footer">
              <button onClick={() => setShowRatingSlider(false)} className="modal-close-button">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Selector Modal */}
      <CollectionSelector
        visible={showCollectionSelector}
        onClose={() => setShowCollectionSelector(false)}
        targetEntry={targetEntry}
        onUpdate={handleCollectionSelectorUpdate}
        entryCollections={entryCollections}
      />
    </div>
  );
};

export default ContextMenu;
