import React, { useState, useEffect } from 'react';
import TagSelector from './TagSelector.jsx';
import RatingSlider from './RatingSlider.jsx';
import CollectionSelector from './CollectionSelector.jsx';
import { useTagOperations } from './hooks/useTagOperations';

const ViewerControls = ({
  state,
  collectionContext,
  onJumpToChapter,
  onNextChapter,
  onPreviousChapter,
  onLastReadChapter,
  onNavigate,
  onClose,
  onToggleControls,
  onJumpToPage,
  onModeChange,
  onZoom,
  onModalStateChange
}) => {
  const [pageInputValue, setPageInputValue] = useState(String(state.currentPage + 1));
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showRatingSlider, setShowRatingSlider] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [existingTags, setExistingTags] = useState([]);
  const [entryCollections, setEntryCollections] = useState([]);

  // Notify parent when modal state changes
  useEffect(() => {
    if (onModalStateChange) {
      const hasOpenModal = showTagSelector || showRatingSlider || showCollectionSelector;
      onModalStateChange(hasOpenModal);
    }
  }, [showTagSelector, showRatingSlider, showCollectionSelector, onModalStateChange]);

  // Use shared hook for tag operations
  const { loading, error, addItemTag, addCollectionTag, setEntryRating, setCollectionRating, getAllTagsWithSearch, addMultipleTagsToEntry, addMultipleTagsToCollection, getEntryTags, getCollectionTags, clearError } = useTagOperations();

  // Update page input when current page changes
  React.useEffect(() => {
    setPageInputValue(String(state.currentPage + 1));
  }, [state.currentPage]);

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputBlur = () => {
    const newPage = parseInt(pageInputValue);
    if (!isNaN(newPage) && newPage >= 1 && newPage <= state.totalPages) {
      onJumpToPage(newPage - 1);
    } else {
      // Reset to current page if invalid
      setPageInputValue(String(state.currentPage + 1));
    }
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  };

  const handleZoomChange = (delta) => {
    const newZoom = Math.max(0.1, Math.min(5.0, state.zoom + delta));
    onZoom(newZoom);
  };

  const handleZoomReset = () => {
    onZoom(1.0);
  };

  // Media control handlers
  const handleRating = async () => {
    setShowRatingSlider(true);
  };

  const handleTags = async () => {
    // Load available tags
    const tags = await getAllTagsWithSearch();
    if (tags) {
      setAvailableTags(tags);
    }
    
    // Get existing tags for current media
    if (state.mediaId) {
      const itemTags = await getEntryTags(state.mediaId);
      setExistingTags(itemTags);
    }
    
    setShowTagSelector(true);
  };

  const handleCollection = async () => {
    if (!state.mediaId) return;
    
    // Load current collection memberships for this entry
    try {
      const result = await window.electronAPI.getCollectionMembersForEntry(state.mediaId);
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
      console.error('ViewerControls: error loading collection memberships:', err);
      setEntryCollections([]);
    }
    
    setShowCollectionSelector(true);
  };

  // Modal handlers
  const handleTagSelection = async (selectedTags) => {
    if (state.mediaId && selectedTags.length > 0) {
      const result = await addMultipleTagsToEntry(state.mediaId, selectedTags);
      
      if (result && result.success) {
        console.log(`ViewerControls: ${result.message || 'Tags updated successfully'}`);
      } else if (result && !result.success) {
        console.error(`ViewerControls: Failed to add tags:`, result.error || 'Unknown error');
      }
    }
  };

  const handleRatingChange = async (newRating) => {
    if (state.mediaId) {
      await setEntryRating(state.mediaId, newRating);
    }
  };

  const handleCollectionSelectorUpdate = (newEntryCollections) => {
    setEntryCollections(newEntryCollections);
  };

  const calculateProgress = () => {
    if (state.totalPages <= 1) return 100;
    return Math.round((state.currentPage / (state.totalPages - 1)) * 100);
  };

  // Check if chapter navigation is available
  const hasCollection = collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0;
  const hasNextChapter = hasCollection && collectionContext.currentChapterIndex < collectionContext.manifest.length - 1;
  const hasPrevChapter = hasCollection && collectionContext.currentChapterIndex > 0;

  // In manga mode, navigation directions are flipped for left/right buttons
  const isMangaMode = state.mode === 'manga';

  // Button disabled states - allow navigation if either page navigation or chapter navigation is possible
  const canGoFirst = state.currentPage > 0 || hasPrevChapter;
  const canGoPrevious = (isMangaMode ? state.currentPage < state.totalPages - 1 : state.currentPage > 0) || (isMangaMode ? hasNextChapter : hasPrevChapter);
  const canGoNext = (isMangaMode ? state.currentPage > 0 : state.currentPage < state.totalPages - 1) || (isMangaMode ? hasPrevChapter : hasNextChapter);
  const canGoLast = state.currentPage < state.totalPages - 1 || hasNextChapter;

  return (
    <>
      {/* Control Panel */}
      <div className="viewer-controls">
        {/* Main controls bar */}
        <div className="controls-main">
          {/* Chapter selector - show in all modes when in collection context */}
          {collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 && (
            <div className="controls-section chapter">
              <select
                value={collectionContext.currentChapterIndex}
                onChange={(e) => onJumpToChapter && onJumpToChapter(parseInt(e.target.value))}
                className="chapter-selector"
                title="Select chapter"
              >
                {collectionContext.manifest.map((chapter, index) => (
                  <option key={chapter.ID} value={index}>
                    {index + 1}. {chapter.NAME}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation controls - only show in non-webtoon modes */}
          {state.mode !== 'webtoon' && (
            <div className="controls-section navigation">
              <button
                onClick={() => {
                  if (state.currentPage > 0) {
                    onNavigate('first');
                  } else if (hasPrevChapter && onPreviousChapter) {
                    onPreviousChapter();
                  }
                }}
                disabled={!canGoFirst}
                title="First page (Home)"
                className="nav-button"
              >
                ⏮
              </button>
              <button
                onClick={() => {
                  // In manga mode, previous button goes to next page
                  const direction = state.mode === 'manga' ? 'next' : 'previous';
                  if (direction === 'previous' && state.currentPage > 0) {
                    onNavigate('previous');
                  } else if (direction === 'next' && state.currentPage < state.totalPages - 1) {
                    onNavigate('next');
                  } else if (isMangaMode ? hasNextChapter : hasPrevChapter) {
                    // In manga mode, left button at last page goes to next chapter
                    // In singlepage mode, left button at first page goes to previous chapter
                    if (isMangaMode && hasNextChapter && onNextChapter) {
                      onNextChapter();
                    } else if (!isMangaMode && hasPrevChapter && onPreviousChapter) {
                      onPreviousChapter();
                    }
                  }
                }}
                disabled={!canGoPrevious}
                title="Previous page (←/A)"
                className="nav-button"
              >
                ◀
              </button>

              <div className="page-input-container">
                <input
                  type="number"
                  value={pageInputValue}
                  onChange={handlePageInputChange}
                  onBlur={handlePageInputBlur}
                  onKeyPress={handlePageInputKeyPress}
                  min="1"
                  max={state.totalPages || 1}
                  className="page-input"
                  title="Current page"
                />
                <span className="page-separator">/</span>
                <span className="page-total" title="Total pages">
                  {state.totalPages || 0}
                </span>
              </div>

              <button
                onClick={() => {
                  // In manga mode, next button goes to previous page
                  const direction = state.mode === 'manga' ? 'previous' : 'next';
                  if (direction === 'next' && state.currentPage < state.totalPages - 1) {
                    onNavigate('next');
                  } else if (direction === 'previous' && state.currentPage > 0) {
                    onNavigate('previous');
                  } else if (isMangaMode ? hasPrevChapter : hasNextChapter) {
                    // In manga mode, right button at first page goes to previous chapter
                    // In singlepage mode, right button at last page goes to next chapter
                    if (isMangaMode && hasPrevChapter && onPreviousChapter) {
                      onPreviousChapter();
                    } else if (!isMangaMode && hasNextChapter && onNextChapter) {
                      onNextChapter();
                    }
                  }
                }}
                disabled={!canGoNext}
                title="Next page (→/D)"
                className="nav-button"
              >
                ▶
              </button>
              <button
                onClick={() => {
                  if (state.currentPage < state.totalPages - 1) {
                    onNavigate('last');
                  } else if (hasNextChapter && onNextChapter) {
                    onNextChapter();
                  }
                }}
                disabled={!canGoLast}
                title="Last page (End)"
                className="nav-button"
              >
                ⏭
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <div className="controls-section zoom">
            <button 
              onClick={() => handleZoomChange(-0.1)}
              disabled={state.zoom <= 0.1}
              title="Zoom out (-)"
              className="zoom-button"
            >
              −
            </button>
            <span 
              className="zoom-display"
              title="Click to reset zoom"
              onClick={handleZoomReset}
            >
              {Math.round(state.zoom * 100)}%
            </span>
            <button 
              onClick={() => handleZoomChange(0.1)}
              disabled={state.zoom >= 5.0}
              title="Zoom in (+)"
              className="zoom-button"
            >
              +
            </button>
          </div>
          
          {/* Media controls */}
          <div className="controls-section media">
            <button 
              onClick={handleRating}
              title="Rate this media"
              className="media-control-btn"
            >
              ⭐
            </button>
            <button 
              onClick={handleTags}
              title="Manage tags"
              className="media-control-btn"
            >
              🏷️
            </button>
            <button
              onClick={handleCollection}
              title="Add to collection"
              className="media-control-btn"
            >
              📚
            </button>
            {collectionContext && collectionContext.lastOpenedId && (
              <button
                onClick={onLastReadChapter}
                title="Jump to last read chapter"
                className="media-control-btn"
              >
                📍
              </button>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="controls-section actions">
            <button 
              onClick={onToggleControls}
              title="Hide controls (Right-click/Enter)"
              className="toggle-button"
            >
              🙈
            </button>
            <button 
              onClick={onClose}
              title="Close viewer (ESC)"
              className="close-button"
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Progress indicator - show in all modes but with different content */}
        {state.mode === 'webtoon' ? (
          <div className="controls-progress">
            <span className="progress-display">Webtoon Mode - Scroll to Navigate</span>
          </div>
        ) : (
          <div className="controls-progress">
            <div className={`progress-bar-container${isMangaMode ? ' manga-mode' : ''}`}>
              <div
                className="progress-bar"
                style={{ width: `${calculateProgress()}%` }}
              />
            </div>
            <span className="progress-display">{calculateProgress()}%</span>
          </div>
        )}
      </div>
      
      {/* Modal Components - Rendered outside control panel for independent positioning */}
      {showTagSelector && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="tag-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Tags to Media</h3>
              <button onClick={() => setShowTagSelector(false)}>&times;</button>
            </div>
            <TagSelector
              availableTags={availableTags}
              onSelectionChange={handleTagSelection}
              multiSelect={true}
              entryId={state.mediaId || null}
              collectionId={null}
            />
            <div className="modal-footer">
              <button onClick={() => setShowTagSelector(false)} className="modal-close-button">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showRatingSlider && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="rating-slider-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Set Rating for Media</h3>
              <button onClick={() => setShowRatingSlider(false)}>&times;</button>
            </div>
            <RatingSlider
              initialValue={state.rating || 0}
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

      <CollectionSelector
        visible={showCollectionSelector}
        onClose={() => setShowCollectionSelector(false)}
        targetEntry={{ ID: state.mediaId }}
        onUpdate={handleCollectionSelectorUpdate}
        entryCollections={entryCollections}
      />
    </>
  );
};

export default ViewerControls;
