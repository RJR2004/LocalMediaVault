import React, { useRef, useEffect, useState, useCallback } from 'react';
import TagSelector from './TagSelector.jsx';
import CollectionSelector from './CollectionSelector.jsx';

/**
 * ThumbnailImage component with lazy loading
 */
function ThumbnailImage({ entryId, isCollection, thumbnailId }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '300px' // Load images 300px before they come into view
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  // Determine the image source: use thumbnailId for collections, entryId for media entries
  const imageSource = isCollection && thumbnailId ? `pera-cache://${thumbnailId}` : `pera-cache://${entryId}`;

  return (
    <div 
      className={`media-grid-thumbnail ${!isCollection ? 'clickable' : ''}`} 
      ref={imgRef}
    >
      {isVisible && !hasError && (
        <>
          <img
            src={imageSource}
            alt="Thumbnail"
            onLoad={handleLoad}
            onError={handleError}
            style={{
              opacity: isLoaded ? 1 : 0,
              transition: 'opacity 0.3s ease',
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          {isCollection && !thumbnailId && (
            <span className="media-grid-collection-badge">📁</span>
          )}
        </>
      )}
      {(!isVisible || hasError) && (
        <div className="media-grid-fallback-icon">
          {isCollection ? '📁' : '📄'}
        </div>
      )}
      {isVisible && !isLoaded && !hasError && (
        <div className="media-grid-loading">
          Loading...
        </div>
      )}
    </div>
  );
}

/**
 * MediaGrid - CSS Grid display of library entries and collections.
 * Styling is fully driven by CSS variables; no hardcoded pixel values.
 * Enhanced with thumbnail lazy loading using IntersectionObserver.
 * Enhanced with keyboard navigation support.
 */
function MediaGrid({ items, onContextMenu, onOpenViewer, onOpenCollection, totalCount, currentPage, itemsPerPage, viewerMode, disableKeyboardNav = false, onPageChange, showCaptions = true, showRatings = false, showPageCount = false, showEntryCount = false, externalFocusedIndex = null }) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [bumpedBottom, setBumpedBottom] = useState(false);
  const [bumpedTop, setBumpedTop] = useState(false);
  // Multi-select state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [selectionType, setSelectionType] = useState(null); // 'media' or 'collection'
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [entryCollections, setEntryCollections] = useState([]);
  const [pendingTags, setPendingTags] = useState([]);

  const gridRef = useRef(null);
  const itemRefs = useRef([]);
  const pendingFocusIndex = useRef(null);
  const itemsRef = useRef(items);
  const bumpTimeoutRef = useRef(null);

  // Reset bump states after 1.5 seconds
  useEffect(() => {
    if (bumpedBottom) {
      if (bumpTimeoutRef.current) {
        clearTimeout(bumpTimeoutRef.current);
      }
      bumpTimeoutRef.current = setTimeout(() => {
        setBumpedBottom(false);
      }, 1500);
    }
    return () => {
      if (bumpTimeoutRef.current) {
        clearTimeout(bumpTimeoutRef.current);
      }
    };
  }, [bumpedBottom]);

  useEffect(() => {
    if (bumpedTop) {
      if (bumpTimeoutRef.current) {
        clearTimeout(bumpTimeoutRef.current);
      }
      bumpTimeoutRef.current = setTimeout(() => {
        setBumpedTop(false);
      }, 1500);
    }
    return () => {
      if (bumpTimeoutRef.current) {
        clearTimeout(bumpTimeoutRef.current);
      }
    };
  }, [bumpedTop]);

  // Calculate number of columns in the grid
  const getColumns = () => {
    if (!gridRef.current) return 1;
    const gridStyle = window.getComputedStyle(gridRef.current);
    const gridColumns = gridStyle.gridTemplateColumns;
    return gridColumns.split(' ').length;
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (disableKeyboardNav) return;

      // Start focus on arrow keys if not already focused
      if (focusedIndex === -1 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (items.length > 0) {
          e.preventDefault();
          setFocusedIndex(0);
          return;
        }
      }

      if (focusedIndex === -1) return;

      const columns = getColumns();
      const maxIndex = items.length - 1;
      const totalPages = Math.ceil(totalCount / itemsPerPage);

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          const newUpIndex = focusedIndex - columns;
          if (bumpedTop) {
            // Confirm: Go to previous page
            if (currentPage > 1 && onPageChange) {
              pendingFocusIndex.current = 'last';
              onPageChange(currentPage - 1);
            }
            setBumpedTop(false);
          } else if (newUpIndex < 0 && currentPage > 1 && onPageChange) {
            // Bump: Set bumpedTop state instead of immediately changing page
            setBumpedTop(true);
          } else {
            setFocusedIndex(prev => Math.max(0, newUpIndex));
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          const newDownIndex = focusedIndex + columns;
          if (bumpedBottom) {
            // Confirm: Go to next page
            if (currentPage < totalPages && onPageChange) {
              pendingFocusIndex.current = 0;
              onPageChange(currentPage + 1);
            }
            setBumpedBottom(false);
          } else if (newDownIndex > maxIndex && currentPage < totalPages && onPageChange) {
            // Bump: Set bumpedBottom state instead of immediately changing page
            setBumpedBottom(true);
          } else {
            setFocusedIndex(prev => Math.min(maxIndex, newDownIndex));
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // Reset bump states on lateral movement
          if (bumpedTop || bumpedBottom) {
            setBumpedTop(false);
            setBumpedBottom(false);
          }
          setFocusedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Reset bump states on lateral movement
          if (bumpedTop || bumpedBottom) {
            setBumpedTop(false);
            setBumpedBottom(false);
          }
          setFocusedIndex(prev => Math.min(maxIndex, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < items.length) {
            const item = items[focusedIndex];
            // Open viewer/collection on Enter (same as normal click)
            if (item.itemType === 'collection' && onOpenCollection) {
              onOpenCollection(item.ID);
            } else if (item.itemType === 'entry') {
              const isImage = item.TYPE === 'image' || item.type === 'image';
              if (isImage && onOpenViewer) {
                onOpenViewer(item.ID, viewerMode);
              }
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setFocusedIndex(-1);
          // Clear selection on Escape
          if (selectedItems.size > 0) {
            setSelectedItems(new Set());
            setSelectionType(null);
            setLastClickedIndex(null);
            setShowBulkActions(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, items, disableKeyboardNav, currentPage, totalCount, itemsPerPage, onPageChange, bumpedTop, bumpedBottom]);
  // Clear selection when items change (page change, filter change, etc.)
  useEffect(() => {
    const itemsChanged = itemsRef.current !== items;
    // Only clear selection if the actual data changed (length or IDs), not just reference
    const dataChanged = itemsChanged && (
      itemsRef.current.length !== items.length ||
      (items.length > 0 && itemsRef.current[0]?.ID !== items[0]?.ID)
    );

    if (dataChanged) {
      setSelectedItems(new Set());
      setSelectionType(null);
      setLastClickedIndex(null);
      setShowBulkActions(false);
    }
  }, [items]);

  // Update items ref and handle focus reset when items actually change
  useEffect(() => {
    const itemsChanged = itemsRef.current !== items;
    console.log('MediaGrid: items changed?', itemsChanged, 'focusedIndex:', focusedIndex);
    itemsRef.current = items;

    // Reset bump states when page changes (items change)
    if (itemsChanged) {
      setBumpedTop(false);
      setBumpedBottom(false);
    }

    itemRefs.current = [];

    if (pendingFocusIndex.current !== null) {
      // Page change - use pending focus
      if (pendingFocusIndex.current === 'last') {
        // Focus on last row of new page
        const columns = gridRef.current ? window.getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length : 1;
        const lastRowIndex = Math.floor((items.length - 1) / columns) * columns;
        setFocusedIndex(Math.min(items.length - 1, lastRowIndex + (columns - 1)));
      } else {
        // Focus on specific index
        setFocusedIndex(pendingFocusIndex.current);
      }
      pendingFocusIndex.current = null;
    } else if (itemsChanged) {
      // Items actually changed - clamp focus to valid range instead of resetting
      setFocusedIndex(prev => {
        console.log('MediaGrid: clamping focus from', prev, 'to max', items.length - 1);
        if (prev < 0) return -1;
        if (items.length === 0) return -1;
        return Math.min(prev, items.length - 1);
      });
    }
    // If items didn't change (just re-render), preserve focus
  }, [items]);

  // Sync focusedIndex with externalFocusedIndex when it changes
  useEffect(() => {
    if (externalFocusedIndex !== null && externalFocusedIndex !== focusedIndex) {
      console.log('MediaGrid: Setting focusedIndex from external:', externalFocusedIndex);
      setFocusedIndex(externalFocusedIndex);
    }
  }, [externalFocusedIndex]);

  // Show/hide bulk actions based on selection
  useEffect(() => {
    const shouldShow = selectedItems.size > 0;
    setShowBulkActions(shouldShow);
  }, [selectedItems, selectionType]);

  // Clear selection handlers
  const clearSelection = () => {
    setSelectedItems(new Set());
    setSelectionType(null);
    setLastClickedIndex(null);
    setShowBulkActions(false);
  };

  // Bulk tag operations
  const openBulkTagSelector = async () => {
    try {
      const response = await window.electronAPI.getAllTags();
      if (response && response.success && response.data) {
        setAvailableTags(response.data);
      }
    } catch (err) {
      console.error('MediaGrid: Error loading tags:', err);
    }
    setShowTagSelector(true);
  };

  const handleBulkTagSelection = (selectedTags) => {
    setPendingTags(selectedTags);
  };

  const applyBulkTags = async () => {
    if (pendingTags.length === 0) return;

    try {
      if (selectionType === 'media') {
        // Add tags to all selected media entries (skip duplicates)
        for (const itemId of selectedItems) {
          // Get current tags for this entry
          const tagsResult = await window.electronAPI.getEntryTags(itemId);
          const currentTags = tagsResult.success && tagsResult.data 
            ? tagsResult.data.map(t => t.TAG_NAME) 
            : [];
          
          // Only add tags that don't already exist
          for (const tagName of pendingTags) {
            if (!currentTags.includes(tagName)) {
              await window.electronAPI.addTagToEntry(itemId, tagName);
            }
          }
        }
      } else if (selectionType === 'collection') {
        // Add tags to all selected collections (skip duplicates)
        for (const itemId of selectedItems) {
          // Get current tags for this collection
          const tagsResult = await window.electronAPI.getCollectionTags(itemId);
          const currentTags = tagsResult.success && tagsResult.data 
            ? tagsResult.data.map(t => t.TAG_NAME) 
            : [];
          
          // Only add tags that don't already exist
          for (const tagName of pendingTags) {
            if (!currentTags.includes(tagName)) {
              await window.electronAPI.addTagToCollection(itemId, tagName);
            }
          }
        }
      }

      setShowTagSelector(false);
      setPendingTags([]);
      clearSelection();

      // Trigger refresh if callback exists
      if (onContextMenu) {
        try {
          onContextMenu({ preventDefault: () => {} }, {});
        } catch (refreshError) {
          console.debug('Refresh hack side-effect handled:', refreshError);
        }
      }
    } catch (err) {
      console.error('MediaGrid: Error adding bulk tags:', err);
      alert('Failed to add tags to selected items');
    }
  };

  // Bulk collection operations
  const openBulkCollectionSelector = async () => {
    // Don't pre-load current collections - show all as available
    // The backend will skip duplicates when adding
    setEntryCollections([]);
    setShowCollectionSelector(true);
  };

  const handleBulkCollectionUpdate = async (newCollections) => {
    try {
      // For each selected entry, add to new collections (skip duplicates)
      for (const itemId of selectedItems) {
        // Get current collections for this entry
        const currentResult = await window.electronAPI.getCollectionMembersForEntry(itemId);
        const currentCollectionIds = currentResult.success && currentResult.data 
          ? currentResult.data.map(m => m.COLLECTION_ID) 
          : [];

        const newCollectionIds = newCollections.map(c => c.ID);

        // Add to new collections (skip if already there)
        for (const collectionId of newCollectionIds) {
          if (!currentCollectionIds.includes(collectionId)) {
            await window.electronAPI.addEntryToCollection(itemId, collectionId);
          }
        }
      }

      setShowCollectionSelector(false);
      clearSelection();

      // Trigger refresh
      if (onContextMenu) {
        try {
          onContextMenu({ preventDefault: () => {} }, {});
        } catch (refreshError) {
          console.debug('Refresh hack side-effect handled:', refreshError);
        }
      }
    } catch (err) {
      console.error('MediaGrid: Error updating bulk collections:', err);
      alert('Failed to update collection memberships');
    }
  };

  // Cleanup bump timeout on unmount
  useEffect(() => {
    return () => {
      if (bumpTimeoutRef.current) {
        clearTimeout(bumpTimeoutRef.current);
      }
    };
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      const element = itemRefs.current[focusedIndex];
      const elementRect = element.getBoundingClientRect();
      const controlPanel = document.querySelector('.control-bar');
      const controlPanelHeight = controlPanel ? controlPanel.offsetHeight : 0;

      // Check if element is above the control panel
      if (elementRect.top < controlPanelHeight) {
        // Scroll to show element below control panel
        window.scrollTo({
          top: window.scrollY + elementRect.top - controlPanelHeight - 10,
          behavior: 'instant'
        });
      } else {
        element.scrollIntoView({
          block: 'nearest',
          behavior: 'instant'
        });
      }
    }
  }, [focusedIndex]);

  // Scroll focused item into view when keyboard navigation is re-enabled (collection viewer closes)
  useEffect(() => {
    if (!disableKeyboardNav && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const element = itemRefs.current[focusedIndex];
        if (element) {
          const elementRect = element.getBoundingClientRect();
          const controlPanel = document.querySelector('.control-bar');
          const controlPanelHeight = controlPanel ? controlPanel.offsetHeight : 0;

          if (elementRect.top < controlPanelHeight) {
            window.scrollTo({
              top: window.scrollY + elementRect.top - controlPanelHeight - 10,
              behavior: 'instant'
            });
          } else {
            element.scrollIntoView({
              block: 'nearest',
              behavior: 'instant'
            });
          }
        }
      }, 50);
    }
  }, [disableKeyboardNav, focusedIndex]);

  const handleClick = (item, index, event) => {
    // Set focus on click
    setFocusedIndex(index);

    // Determine item type for selection
    const itemType = item.itemType === 'collection' ? 'collection' : 'media';
    const itemId = item.ID || item.per_id;

    // Handle multi-selection with keyboard modifiers
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + Click: Toggle selection
      event.preventDefault();

      // Type isolation: if clicking different type, reset selection
      if (selectionType && selectionType !== itemType) {
        setSelectedItems(new Set([itemId]));
        setSelectionType(itemType);
        setLastClickedIndex(index);
      } else {
        // Toggle selection
        const newSelection = new Set(selectedItems);
        if (newSelection.has(itemId)) {
          newSelection.delete(itemId);
          if (newSelection.size === 0) {
            setSelectionType(null);
          }
        } else {
          newSelection.add(itemId);
          setSelectionType(itemType);
        }
        setSelectedItems(newSelection);
        setLastClickedIndex(index);
      }
    } else if (event.shiftKey) {
      // Shift + Click: Select range (or start new selection if first shift-click)
      event.preventDefault();
      
      // Check if Ctrl/Cmd is also held (Ctrl+Shift+Click)
      const isAdditiveRange = event.ctrlKey || event.metaKey;
      
      // Type isolation: if clicking different type, reset selection
      if (selectionType && selectionType !== itemType) {
        setSelectedItems(new Set([itemId]));
        setSelectionType(itemType);
        setLastClickedIndex(index);
      } else if (lastClickedIndex !== null) {
        // Range selection
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        
        if (isAdditiveRange) {
          // Add range to current selection
          const newSelection = new Set(selectedItems);
          
          for (let i = start; i <= end; i++) {
            if (items[i]) {
              const loopItem = items[i];
              const loopType = loopItem.itemType === 'collection' ? 'collection' : 'media';
              // Only select items of the same type
              if (loopType === itemType) {
                newSelection.add(loopItem.ID || loopItem.per_id);
              }
            }
          }
          
          setSelectedItems(newSelection);
        } else {
          // Replace selection with range
          const newSelection = new Set();
          
          for (let i = start; i <= end; i++) {
            if (items[i]) {
              const loopItem = items[i];
              const loopType = loopItem.itemType === 'collection' ? 'collection' : 'media';
              // Only select items of the same type as the first clicked item
              if (loopType === itemType) {
                newSelection.add(loopItem.ID || loopItem.per_id);
              }
            }
          }
          
          setSelectedItems(newSelection);
        }
        
        setSelectionType(itemType);
        setLastClickedIndex(index);
      } else {
        // First shift-click: select this item as starting point
        setSelectedItems(new Set([itemId]));
        setSelectionType(itemType);
        setLastClickedIndex(index);
      }
    } else {
      // Normal click: Open viewer/collection (don't select)
      // Open viewer/collection on normal click
      if (item.itemType === 'collection' && onOpenCollection) {
        onOpenCollection(item.ID);
      } else if (item.itemType === 'entry') {
        // Only open viewer for entries that are images
        // Check both TYPE (database field) and type (normalized field)
        const isImage = item.TYPE === 'image' || item.type === 'image';

        if (isImage && onOpenViewer) {
          onOpenViewer(item.ID, viewerMode);
        }
      }
    }
  };

  const getDisplayName = (item) => {
    if (item.NAME) return item.NAME;
    if (item.name) return item.name;
    if (item.title) return item.title;
    if (item.PATH) {
      // Extract filename from path
      const parts = item.PATH.split(/[/\\]/);
      return parts[parts.length - 1] || 'Untitled';
    }
    return 'Untitled';
  };

  if (!items || items.length === 0) {
    return (
      <div className="media-grid-empty">
        No items to display.
      </div>
    );
  }

  return (
    <>
      <div className="media-grid" ref={gridRef}>
        {items.map((item, index) => {
          const isCollection = item.type === 'collection' || item.members !== undefined;
          const isAuto = isCollection && item.auto === true;

          let borderVar = 'var(--theme-border-color)';
          if (isCollection) {
            borderVar = isAuto
              ? 'var(--theme-collection-auto-border)'
              : 'var(--theme-collection-manual-border)';
          }

          return (
            <div
              key={item.ID || item.per_id}
              ref={el => itemRefs.current[index] = el}
              className={`media-grid-item ${isCollection ? 'collection' : 'entry'} ${!isCollection ? 'clickable' : ''} ${focusedIndex === index ? 'focused' : ''} ${selectedItems.has(item.ID || item.per_id) ? 'is-selected' : ''}`}
              style={{ borderColor: borderVar }}
              onContextMenu={(e) => onContextMenu && onContextMenu(e, item)}
              onClick={(e) => handleClick(item, index, e)}
            >
              <div className="media-grid-card">
                <ThumbnailImage
                  entryId={item.ID || item.per_id}
                  isCollection={isCollection}
                  thumbnailId={isCollection ? (item.THUMBNAIL_ID || item.thumbnailId) : null}
                />
                {showRatings && (item.RATING !== undefined && item.RATING !== null) && (
                  <div className="media-grid-rating-badge">
                    {item.RATING}/100
                  </div>
                )}
                {showPageCount && !isCollection && (item.PAGE_COUNT !== undefined && item.PAGE_COUNT !== null && item.PAGE_COUNT > 0) && (
                  <div className="media-grid-page-count-badge">
                    {item.PAGE_COUNT}p
                  </div>
                )}
                {showEntryCount && isCollection && item.members && (
                  <div className="media-grid-entry-count-badge">
                    {item.members.length}
                  </div>
                )}
                {showCaptions && (
                  <div className="media-grid-caption">
                    {getDisplayName(item)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Info */}
      {totalCount > 0 && (
        <div className="media-grid-pagination-info">
          Showing {items.length} of {totalCount} items
          {currentPage && itemsPerPage && (
            <span> (Page {currentPage} of {Math.ceil(totalCount / itemsPerPage)})</span>
          )}
        </div>
      )}

      {/* Bump Toast Indicators */}
      {bumpedBottom && (
        <div className="bump-toast bump-toast-bottom">
          ↓ Press again for Next Page
        </div>
      )}

      {bumpedTop && (
        <div className="bump-toast bump-toast-top">
          ↑ Press again for Previous Page
        </div>
      )}

      {/* Bulk Action Bar */}
      {showBulkActions && (
        <div className="bulk-action-bar">
          <div className="bulk-action-info">
            <span className="bulk-action-count">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
          </div>
          <div className="bulk-action-buttons">
            <button className="bulk-action-button" onClick={openBulkTagSelector}>
              🏷️ Add Tags
            </button>
            {selectionType === 'media' && (
              <button className="bulk-action-button" onClick={openBulkCollectionSelector}>
                📁 Add to Collection
              </button>
            )}
            <button className="bulk-action-button bulk-action-clear" onClick={clearSelection}>
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* Tag Selector Modal */}
      {showTagSelector && (
        <div className="modal-overlay" onClick={() => setShowTagSelector(false)}>
          <div className="tag-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Tags to {selectedItems.size} Selected Items</h3>
              <button onClick={() => setShowTagSelector(false)}>&times;</button>
            </div>
            <TagSelector
              availableTags={availableTags}
              onSelectionChange={handleBulkTagSelection}
              multiSelect={true}
              entryId={null}
              collectionId={null}
            />
            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowTagSelector(false);
                  setPendingTags([]);
                }} 
                className="modal-close-button"
              >
                Cancel
              </button>
              <button 
                onClick={applyBulkTags} 
                className="modal-apply-button"
                disabled={pendingTags.length === 0}
              >
                Apply Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Selector Modal */}
      <CollectionSelector
        visible={showCollectionSelector}
        onClose={() => setShowCollectionSelector(false)}
        targetEntry={{ ID: Array.from(selectedItems)[0] }} // Use first item for UI
        onUpdate={handleBulkCollectionUpdate}
        entryCollections={entryCollections}
      />
    </>
  );
}

export default MediaGrid;
