import React, { useState, useEffect } from 'react';
import TagSelector from './TagSelector';
import RatingSlider from './RatingSlider';
import './collection-editor.css';

function CollectionEditor({ collectionId, onClose, onSave }) {
  const [collection, setCollection] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [sortMode, setSortMode] = useState('manual'); // manual, alphabetic, alphanumeric
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [collectionTags, setCollectionTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [thumbnailImage, setThumbnailImage] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Load collection data
  useEffect(() => {
    const loadCollection = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get collection details
        const collectionResult = await window.electronAPI.getCollection(collectionId);
        if (collectionResult.success) {
          setCollection(collectionResult.data);
        } else {
          throw new Error(collectionResult.error || 'Failed to load collection');
        }

        // Get collection members
        const membersResult = await window.electronAPI.getCollectionMembers(collectionId);
        if (membersResult.success) {
          setMembers(membersResult.data || []);
        } else {
          throw new Error(membersResult.error || 'Failed to load collection members');
        }

        // Get collection tags
        const tagsResult = await window.electronAPI.getCollectionTags(collectionId);
        if (tagsResult.success) {
          setCollectionTags(tagsResult.data || []);
        }

        // Get all available tags
        const allTagsResult = await window.electronAPI.getAllTags();
        if (allTagsResult.success) {
          setAvailableTags(allTagsResult.data || []);
        }
      } catch (err) {
        console.error('CollectionEditor: Error loading collection:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (collectionId) {
      loadCollection();
    }
    }, [collectionId]);

  // Load thumbnail image when collection or thumbnail changes
  useEffect(() => {
    const loadThumbnailImage = async () => {
      console.log('loadThumbnailImage: Starting');
      console.log('collection?.THUMBNAIL_ID:', collection?.THUMBNAIL_ID);
      console.log('members.length:', members.length);

      if (collection?.THUMBNAIL_ID && members.length > 0) {
        const thumbnailMember = members.find(m => m.ID === collection.THUMBNAIL_ID);
        console.log('thumbnailMember:', thumbnailMember);

        if (thumbnailMember?.PATH) {
          console.log('thumbnailMember.PATH:', thumbnailMember.PATH);
          try {
            const filesResult = await window.electronAPI.getDirectoryFiles(thumbnailMember.PATH);
            console.log('filesResult:', filesResult);

            if (filesResult.success && filesResult.files && filesResult.files.length > 0) {
              console.log('filesResult.files:', filesResult.files);
              const imageFiles = filesResult.files.filter(f =>
                f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.gif') || f.endsWith('.webp')
              );
              console.log('imageFiles:', imageFiles);

              if (imageFiles.length > 0) {
                const imagePath = `file:///${thumbnailMember.PATH}/${imageFiles[0]}`;
                console.log('Setting thumbnailImage to:', imagePath);
                setThumbnailImage(imagePath);
              } else {
                console.log('No image files found in directory');
              }
            } else {
              console.log('No files found or failed to get directory files');
            }
          } catch (err) {
            console.error('Error loading thumbnail image:', err);
          }
        } else {
          console.log('thumbnailMember has no PATH');
        }
      } else {
        console.log('No THUMBNAIL_ID or no members');
        setThumbnailImage(null);
      }
    };

    loadThumbnailImage();
  }, [collection?.THUMBNAIL_ID, members]);

    useEffect(() => {
      // 1. Freeze the background
      document.body.style.overflow = 'hidden';

      // 2. This cleanup runs when you close the editor
      return () => {
        document.body.style.overflow = 'unset';
      };
    }, []);

  // Handle entry selection
  const handleEntrySelect = (entryId) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(entryId)) {
      newSelected.delete(entryId);
    } else {
      newSelected.add(entryId);
    }
    setSelectedEntries(newSelected);
  };

  // Handle remove selected entries from collection
  const handleRemoveFromCollection = async () => {
    if (selectedEntries.size === 0) return;

    try {
      const selectedIds = Array.from(selectedEntries);
      
      // Remove each selected entry from the collection
      for (const entryId of selectedIds) {
        const result = await window.electronAPI.removeEntryFromCollection(entryId, collectionId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to remove entry from collection');
        }
      }

      // Refresh members list
      const membersResult = await window.electronAPI.getCollectionMembers(collectionId);
      if (membersResult.success) {
        setMembers(membersResult.data || []);
      } else {
        throw new Error(membersResult.error || 'Failed to refresh collection members');
      }

      // Clear selection
      setSelectedEntries(new Set());
    } catch (err) {
      console.error('CollectionEditor: Error removing entries from collection:', err);
      setError(err.message);
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedEntries.size === members.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(members.map(member => member.ID)));
    }
  };

  // Move selected entries to top
  const handleMoveToTop = () => {
    if (selectedEntries.size === 0) return;

    const selectedIds = Array.from(selectedEntries);
    const selectedMembers = members.filter(member => selectedIds.includes(member.ID));
    const otherMembers = members.filter(member => !selectedIds.includes(member.ID));
    
    const updatedMembers = [...selectedMembers, ...otherMembers].map((member, index) => ({
      ...member,
      SORT_ORDER: index
    }));

    setMembers(updatedMembers);
    setSelectedEntries(new Set());
  };

  // Move selected entries to bottom
  const handleMoveToBottom = () => {
    if (selectedEntries.size === 0) return;

    const selectedIds = Array.from(selectedEntries);
    const otherMembers = members.filter(member => !selectedIds.includes(member.ID));
    const selectedMembers = members.filter(member => selectedIds.includes(member.ID));

    const updatedMembers = [...otherMembers, ...selectedMembers].map((member, index) => ({
      ...member,
      SORT_ORDER: index
    }));

    setMembers(updatedMembers);
    setSelectedEntries(new Set());
  };

  // Move selected entries up by one
  const handleMoveUp = () => {
    if (selectedEntries.size === 0) return;

    const selectedIds = Array.from(selectedEntries);
    const newMembers = [...members];

    // Move each selected entry up by one position
    selectedIds.forEach(id => {
      const currentIndex = newMembers.findIndex(m => m.ID === id);
      if (currentIndex > 0) {
        // Swap with the entry above
        [newMembers[currentIndex], newMembers[currentIndex - 1]] = [newMembers[currentIndex - 1], newMembers[currentIndex]];
      }
    });

    const updatedMembers = newMembers.map((member, index) => ({
      ...member,
      SORT_ORDER: index
    }));

    setMembers(updatedMembers);
  };

  // Move selected entries down by one
  const handleMoveDown = () => {
    if (selectedEntries.size === 0) return;

    const selectedIds = Array.from(selectedEntries);
    const newMembers = [...members];

    // Move each selected entry down by one position (in reverse order to avoid conflicts)
    [...selectedIds].reverse().forEach(id => {
      const currentIndex = newMembers.findIndex(m => m.ID === id);
      if (currentIndex < newMembers.length - 1) {
        // Swap with the entry below
        [newMembers[currentIndex], newMembers[currentIndex + 1]] = [newMembers[currentIndex + 1], newMembers[currentIndex]];
      }
    });

    const updatedMembers = newMembers.map((member, index) => ({
      ...member,
      SORT_ORDER: index
    }));

    setMembers(updatedMembers);
  };

  // Automatic sorting
  const handleAutoSort = (mode) => {
    setSortMode(mode);
    
    let sortedMembers = [...members];
    
    if (mode === 'alphabetic') {
      sortedMembers.sort((a, b) => a.NAME.localeCompare(b.NAME));
    } else if (mode === 'alphanumeric') {
      sortedMembers.sort((a, b) => {
        // Extract numbers and compare numerically, then compare text
        const aMatch = a.NAME.match(/(\d+)|(\D+)/g);
        const bMatch = b.NAME.match(/(\d+)|(\D+)/g);
        
        for (let i = 0; i < Math.max(aMatch?.length || 0, bMatch?.length || 0); i++) {
          const aPart = aMatch?.[i];
          const bPart = bMatch?.[i];
          
          if (!aPart) return -1;
          if (!bPart) return 1;
          
          const aNum = parseInt(aPart);
          const bNum = parseInt(bPart);
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            if (aNum !== bNum) return aNum - bNum;
          } else {
            const compare = aPart.localeCompare(bPart);
            if (compare !== 0) return compare;
          }
        }
        return 0;
      });
    }

    const updatedMembers = sortedMembers.map((member, index) => ({
      ...member,
      SORT_ORDER: index
    }));

    setMembers(updatedMembers);
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder the array
    const newMembers = [...members];
    const [draggedItem] = newMembers.splice(draggedIndex, 1);
    newMembers.splice(dropIndex, 0, draggedItem);

    // Update SORT_ORDER values
    const updatedMembers = newMembers.map((member, index) => ({
      ...member,
      SORT_ORDER: index
    }));

    setMembers(updatedMembers);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle collection rating change
  const handleRatingChange = async (rating) => {
    try {
      const result = await window.electronAPI.setCollectionRating(collectionId, rating);
      if (result.success) {
        setCollection(prev => ({ ...prev, RATING: rating }));
      } else {
        throw new Error(result.error || 'Failed to update rating');
      }
    } catch (err) {
      console.error('CollectionEditor: Error updating rating:', err);
      setError(err.message);
    }
  };

  // Handle tag selection
  const handleTagSelection = async (selectedTags) => {
    try {
      // Get current tags
      const currentTags = new Set(collectionTags);
      
      // Add new tags
      for (const tag of selectedTags) {
        if (!currentTags.has(tag)) {
          await window.electronAPI.addTagToCollection(collectionId, tag);
        }
      }
      
      // Remove tags that are no longer selected
      for (const tag of currentTags) {
        if (!selectedTags.includes(tag)) {
          await window.electronAPI.removeTagFromCollection(collectionId, tag);
        }
      }

      // Refresh tags
      const tagsResult = await window.electronAPI.getCollectionTags(collectionId);
      if (tagsResult.success) {
        setCollectionTags(tagsResult.data || []);
      }
    } catch (err) {
      console.error('CollectionEditor: Error updating tags:', err);
      setError(err.message);
    }
  };

  // Handle cover thumbnail change
  const handleCoverChange = async (entryId) => {
    try {
      const result = await window.electronAPI.setCollectionThumbnail(collectionId, entryId);
      if (result.success) {
        setCollection(prev => ({ ...prev, THUMBNAIL_ID: entryId }));
      } else {
        throw new Error(result.error || 'Failed to update thumbnail');
      }
    } catch (err) {
      console.error('CollectionEditor: Error updating thumbnail:', err);
      setError(err.message);
    }
  };

  // Save collection changes
  const handleSave = async () => {
    try {
      // Update member sort orders
      for (const member of members) {
        await window.electronAPI.updateCollectionMemberSortOrder(
          collectionId, 
          member.ID, 
          member.SORT_ORDER
        );
      }

      if (onSave) {
        onSave();
      }
      onClose();
    } catch (err) {
      console.error('CollectionEditor: Error saving collection:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="collection-editor-overlay">
        <div className="collection-editor-modal">
          <div className="collection-editor-loading">
            <div className="loading-spinner"></div>
            <p>Loading collection...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collection-editor-overlay">
        <div className="collection-editor-modal">
          <div className="collection-editor-error">
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={onClose} className="collection-editor-button">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-editor-overlay" onClick={onClose}>
      <div className="collection-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="collection-editor-header">
          <div className="collection-info">
            <h2>Edit Collection: {collection?.NAME || 'Unknown'}</h2>
            <p className="collection-stats">
              {members.length} {members.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <button onClick={onClose} className="collection-editor-close">&times;</button>
        </div>

        {/* Collection Properties */}
        <div className="collection-properties">
          <div className="property-section">
            <h3>Thumbnail</h3>
            <div className="thumbnail-preview">
              {thumbnailImage ? (
                <img
                  src={thumbnailImage}
                  alt="Collection thumbnail"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : (
                <div className="no-thumbnail">No thumbnail</div>
              )}
            </div>
          </div>

          <div className="property-section">
            <h3>Rating</h3>
            <RatingSlider
              value={collection?.RATING || 0}
              onChange={handleRatingChange}
              max={100}
            />
          </div>

          <div className="property-section">
            <h3>Tags</h3>
            <button
              onClick={() => setShowTagSelector(true)}
              className="collection-editor-button"
            >
              Manage Tags ({collectionTags.length})
            </button>
            {showTagSelector && (
              <div className="tag-selector-overlay">
                <div className="tag-selector-modal">
                  <div className="tag-selector-header">
                    <h3>Select Tags for Collection</h3>
                    <button onClick={() => setShowTagSelector(false)}>&times;</button>
                  </div>
                  <TagSelector
                    availableTags={availableTags}
                    onSelectionChange={handleTagSelection}
                    multiSelect={true}
                    entryId={null}
                    collectionId={collectionId}
                  />
                  <div className="tag-selector-footer">
                    <button onClick={() => setShowTagSelector(false)} className="collection-editor-button">
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sorting Controls */}
        <div className="sorting-controls">
          <h3>Sorting</h3>
          <div className="sort-buttons">
            <button 
              onClick={() => handleAutoSort('manual')}
              className={`collection-editor-button ${sortMode === 'manual' ? 'active' : ''}`}
            >
              Manual Order
            </button>
            <button 
              onClick={() => handleAutoSort('alphabetic')}
              className={`collection-editor-button ${sortMode === 'alphabetic' ? 'active' : ''}`}
            >
              Alphabetic
            </button>
            <button 
              onClick={() => handleAutoSort('alphanumeric')}
              className={`collection-editor-button ${sortMode === 'alphanumeric' ? 'active' : ''}`}
            >
              Alphanumeric
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="bulk-actions">
          <h3>Bulk Actions</h3>
          <div className="action-buttons">
            <button onClick={handleSelectAll} className="collection-editor-button">
              {selectedEntries.size === members.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleMoveUp}
              disabled={selectedEntries.size === 0}
              className="collection-editor-button"
            >
              Move Up
            </button>
            <button
              onClick={handleMoveDown}
              disabled={selectedEntries.size === 0}
              className="collection-editor-button"
            >
              Move Down
            </button>
            <button
              onClick={handleMoveToTop}
              disabled={selectedEntries.size === 0}
              className="collection-editor-button"
            >
              Move to Top
            </button>
            <button
              onClick={handleMoveToBottom}
              disabled={selectedEntries.size === 0}
              className="collection-editor-button"
            >
              Move to Bottom
            </button>
            {!collection?.AUTO_GENERATED && (
              <button
                onClick={handleRemoveFromCollection}
                disabled={selectedEntries.size === 0}
                className="collection-editor-button danger"
              >
                Remove from Collection
              </button>
            )}
          </div>
        </div>

        {/* Collection Entries */}
        <div className="collection-entries">
          <h3>Entries</h3>
          <div className="entries-list">
            {members.map((member, index) => (
              <div
                key={member.ID}
                draggable
                className={`collection-entry ${selectedEntries.has(member.ID) ? 'selected' : ''} ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                onClick={() => handleEntrySelect(member.ID)}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onWheel={(e) => {
                  // Allow mousewheel scrolling during drag
                  if (draggedIndex !== null) {
                    e.stopPropagation();
                  }
                }}
              >
                <div className="drag-handle">⋮⋮</div>
                <div className="entry-number">{index + 1}</div>
                <div className="entry-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedEntries.has(member.ID)}
                    onChange={() => handleEntrySelect(member.ID)}
                  />
                </div>
                <div className="entry-info">
                  <div className="entry-name">{member.NAME}</div>
                  <div className="entry-details">
                    {member.TYPE && <span className="entry-type">{member.TYPE}</span>}
                    {member.RATING > 0 && <span className="entry-rating">★ {member.RATING}</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCoverChange(member.ID);
                  }}
                  className={`cover-button ${collection?.THUMBNAIL_ID === member.ID ? 'current-cover' : ''}`}
                  title={collection?.THUMBNAIL_ID === member.ID ? 'Current Cover' : 'Set as Cover'}
                >
                  {collection?.THUMBNAIL_ID === member.ID ? '📖' : '🖼️'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="collection-editor-footer">
          <button onClick={onClose} className="collection-editor-button secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="collection-editor-button primary">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default CollectionEditor;
