import React, { useState, useEffect, useCallback } from 'react';
import SinglePageViewer from './SinglePageViewer.jsx';
import WebtoonViewer from './WebtoonViewer.jsx';
import ViewerControls from './ViewerControls.jsx';
import TagSelector from './TagSelector.jsx';
import RatingSlider from './RatingSlider.jsx';
import CollectionSelector from './CollectionSelector.jsx';
import { useTagOperations } from './hooks/useTagOperations';

const WebtoonControls = ({ state, onModalStateChange }) => {
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
      console.error('WebtoonControls: error loading collection memberships:', err);
      setEntryCollections([]);
    }
    
    setShowCollectionSelector(true);
  };

  const closeViewer = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.closeViewer();
      }
    } catch (err) {
      console.error('Failed to close viewer:', err);
      window.close();
    }
  };

  // Modal handlers
  const handleTagSelection = async (selectedTags) => {
    if (state.mediaId && selectedTags.length > 0) {
      const result = await addMultipleTagsToEntry(state.mediaId, selectedTags);
      
      if (result && result.success) {
        console.log(`WebtoonControls: ${result.message || 'Tags updated successfully'}`);
      } else if (result && !result.success) {
        console.error(`WebtoonControls: Failed to add tags:`, result.error || 'Unknown error');
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

  return (
    <>
      <div className="webtoon-controls">
        <div className="media-controls">
          <button onClick={handleRating} title="Rate this media">⭐</button>
          <button onClick={handleTags} title="Manage tags">🏷️</button>
          <button onClick={handleCollection} title="Add to collection">📚</button>
          <button onClick={closeViewer} title="Close Viewer">✕</button>
        </div>
      </div>

      {/* Modal Components */}
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

const ViewerFrame = ({ mediaId, mode, collectionId }) => {
  const [viewerState, setViewerState] = useState({
    mode: mode || 'singlepage',
    currentPage: 0,
    totalPages: 0,
    zoom: 1.0,
    showControls: false,
    isFullscreen: true,
    mediaId: mediaId,
    rating: 0,
    progress: 0,
    hasMedia: false
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Collection context state
  const [collectionContext, setCollectionContext] = useState({
    collectionId: collectionId || null,
    manifest: [],
    currentChapterIndex: 0,
    startAtLastPage: false
  });

  useEffect(() => {
    // Request initial data from main process
    const initializeViewer = async () => {
      try {
        if (window.electronAPI && mediaId) {
          console.log('ViewerFrame: Initializing with mediaId:', mediaId);

          // Get media data first
          const mediaResult = await window.electronAPI.getViewerData(mediaId);
          if (mediaResult.success) {
            console.log('ViewerFrame: Media data loaded:', mediaResult.data);

            const initialMode = mode || 'singlepage';
            const defaultZoom = initialMode === 'webtoon' ? 0.7 : 1.0; // 70% for Webtoon,

            setViewerState(prev => ({
              ...prev,
              media: mediaResult.data,
              mediaId: mediaId,
              mode: initialMode,
              zoom: defaultZoom,
              totalPages: mediaResult.data.pageCount || 1,
              rating: mediaResult.data.rating || 0,
              progress: mediaResult.data.progress || 0,
              hasMedia: true
            }));
            setLoading(false);
          } else {
            console.error('ViewerFrame: Failed to load media data:', mediaResult.error);
            setError(mediaResult.error || 'Failed to load media data');
            setLoading(false);
          }
        } else {
          setError('Electron API not available or no media ID');
          setLoading(false);
        }
      } catch (err) {
        console.error('ViewerFrame: Failed to initialize', err);
        setError(err.message || 'Initialization failed');
        setLoading(false);
      }
    };

    initializeViewer();
  }, [mediaId, mode]);

  // Load collection manifest if collectionId is provided
  useEffect(() => {
    const loadCollectionManifest = async () => {
      if (collectionId && window.electronAPI) {
        try {
          console.log('ViewerFrame: Loading collection manifest for:', collectionId);
          const manifestResult = await window.electronAPI.getCollectionManifest(collectionId);
          if (manifestResult.success && manifestResult.data) {
            console.log('ViewerFrame: Collection manifest loaded:', manifestResult.data);

            // Get collection info to access LAST_OPENED_ID
            const collectionResult = await window.electronAPI.getCollection(collectionId);
            const lastOpenedId = collectionResult.success && collectionResult.data ? collectionResult.data.LAST_OPENED_ID : null;

            // Find current media index in manifest
            const currentIndex = manifestResult.data.findIndex(entry => entry.ID === mediaId);

            setCollectionContext(prev => ({
              ...prev,
              collectionId: collectionId,
              manifest: manifestResult.data,
              currentChapterIndex: currentIndex >= 0 ? currentIndex : 0,
              lastOpenedId: lastOpenedId,
              startAtLastPage: false,
              scrollToBottom: false
            }));
          } else {
            console.error('ViewerFrame: Failed to load collection manifest:', manifestResult.error);
          }
        } catch (err) {
          console.error('ViewerFrame: Error loading collection manifest:', err);
        }
      }
    };

    loadCollectionManifest();
  }, [collectionId, mediaId]);

  // Reset scrollToBottom flag after it's been used
  useEffect(() => {
    if (collectionContext.scrollToBottom) {
      const timeout = setTimeout(() => {
        setCollectionContext(prev => ({
          ...prev,
          scrollToBottom: false
        }));
      }, 500); // Reset after 500ms to give WebtoonViewer time to scroll
      return () => clearTimeout(timeout);
    }
  }, [collectionContext.scrollToBottom]);

  // Navigation and control functions (must be defined before useEffect that uses them)
  const navigateViewer = async (direction) => {
    try {
      console.log('ViewerFrame: navigateViewer called with:', direction);
      console.log('ViewerFrame: Current state before navigation:', {
        currentPage: viewerState.currentPage,
        totalPages: viewerState.totalPages,
        mode: viewerState.mode
      });

      if (window.electronAPI) {
        const result = await window.electronAPI.navigateViewer(direction);
        console.log('ViewerFrame: navigateViewer result:', result);
        if (result.success) {
          // State will be updated via IPC listener
        } else {
          console.error('Failed to navigate:', result.error);
        }
      }
    } catch (error) {
      console.error('Failed to navigate:', error);
    }
  };

  const closeViewer = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.closeViewer();
      }
    } catch (err) {
      console.error('Failed to close viewer:', err);
      window.close();
    }
  };

  const toggleControls = () => {
    setViewerState(prev => ({ ...prev, showControls: !prev.showControls }));
  };

  const updateZoom = async (newZoom) => {
    const clampedZoom = Math.max(0.1, Math.min(5.0, newZoom));
    setViewerState(prev => ({ ...prev, zoom: clampedZoom }));
  };

  const updateRating = async (rating) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.updateViewerProgress(rating);
        setViewerState(prev => ({ ...prev, rating }));
      }
    } catch (err) {
      console.error('Failed to update rating:', err);
    }
  };

  const jumpToPage = async (pageNumber) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.jumpToPage(pageNumber);
        if (result.success) {
          // State will be updated via IPC listener
        } else {
          console.error('Failed to jump to page:', result.error);
        }
      }
    } catch (error) {
      console.error('Error jumping to page:', error);
    }
  };

  const setViewerMode = async (newMode) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.setViewerMode(newMode);
        if (result.success) {
          setViewerState(prev => ({ ...prev, mode: newMode }));
        } else {
          console.error('Set mode failed:', result.error);
        }
      }
    } catch (err) {
      console.error('Failed to set mode:', err);
    }
  };

  // Chapter navigation handlers for collection viewing
  const handleNextChapter = useCallback(async () => {
    if (!collectionContext.manifest || collectionContext.manifest.length === 0) return;

    const nextIndex = collectionContext.currentChapterIndex + 1;
    if (nextIndex >= collectionContext.manifest.length) {
      console.log('ViewerFrame: Already at last chapter');
      return;
    }

    const nextChapter = collectionContext.manifest[nextIndex];
    console.log('ViewerFrame: Navigating to next chapter:', nextChapter);

    // Mark current chapter as completed
    const currentChapter = collectionContext.manifest[collectionContext.currentChapterIndex];
    if (window.electronAPI && collectionContext.collectionId && currentChapter) {
      try {
        await window.electronAPI.markCollectionMemberCompleted(collectionContext.collectionId, currentChapter.ID);
        console.log('ViewerFrame: Marked current chapter as completed:', currentChapter.ID);
      } catch (err) {
        console.error('ViewerFrame: Failed to mark chapter as completed:', err);
      }
    }

    // Update collection context
    setCollectionContext(prev => ({
      ...prev,
      currentChapterIndex: nextIndex,
      startAtLastPage: false,
      scrollToBottom: false
    }));

    // Update last read chapter
    if (window.electronAPI && collectionContext.collectionId) {
      await window.electronAPI.updateCollectionLastOpened(collectionContext.collectionId, nextChapter.ID);
    }

    // Switch media in main process to ensure navigation works correctly
    if (window.electronAPI) {
      await window.electronAPI.switchViewerMedia(nextChapter.ID);
    }

    // Restore the mode after switching media
    await window.electronAPI.setViewerMode(viewerState.mode);

    // Reload viewer with new media
    setLoading(true);
    try {
      const mediaResult = await window.electronAPI.getViewerData(nextChapter.ID);
      if (mediaResult.success) {
        setViewerState(prev => ({
          ...prev,
          media: mediaResult.data,
          mediaId: nextChapter.ID,
          currentPage: 0,
          totalPages: mediaResult.data.pageCount || 1,
          rating: mediaResult.data.rating || 0,
          progress: mediaResult.data.progress || 0
        }));
        setLoading(false);
      }
    } catch (err) {
      console.error('ViewerFrame: Failed to load next chapter:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [collectionContext]);

  const handlePreviousChapter = useCallback(async () => {
    if (!collectionContext.manifest || collectionContext.manifest.length === 0) return;

    const prevIndex = collectionContext.currentChapterIndex - 1;
    if (prevIndex < 0) {
      console.log('ViewerFrame: Already at first chapter');
      return;
    }

    const prevChapter = collectionContext.manifest[prevIndex];
    console.log('ViewerFrame: Navigating to previous chapter:', prevChapter);

    // Update collection context with startAtLastPage flag
    setCollectionContext(prev => ({
      ...prev,
      currentChapterIndex: prevIndex,
      startAtLastPage: true,
      scrollToBottom: true // For webtoon mode
    }));

    // Update last read chapter
    if (window.electronAPI && collectionContext.collectionId) {
      await window.electronAPI.updateCollectionLastOpened(collectionContext.collectionId, prevChapter.ID);
    }

    // Switch media in main process to ensure navigation works correctly
    if (window.electronAPI) {
      await window.electronAPI.switchViewerMedia(prevChapter.ID);
    }

    // Restore the mode after switching media
    await window.electronAPI.setViewerMode(viewerState.mode);

    // Navigate to last page after switching media
    await navigateViewer('last');

    // Reload viewer with new media
    setLoading(true);
    try {
      const mediaResult = await window.electronAPI.getViewerData(prevChapter.ID);
      if (mediaResult.success) {
        const newTotalPages = mediaResult.data.pageCount || 1;
        setViewerState(prev => ({
          ...prev,
          media: mediaResult.data,
          mediaId: prevChapter.ID,
          totalPages: newTotalPages,
          rating: mediaResult.data.rating || 0,
          progress: mediaResult.data.progress || 0
        }));
        setLoading(false);
      }
    } catch (err) {
      console.error('ViewerFrame: Failed to load previous chapter:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [collectionContext]);

  const handleJumpToChapter = async (index) => {
    if (!collectionContext.manifest || index < 0 || index >= collectionContext.manifest.length) return;

    const chapter = collectionContext.manifest[index];
    console.log('ViewerFrame: Jumping to chapter:', chapter);

    // Update collection context
    setCollectionContext(prev => ({
      ...prev,
      currentChapterIndex: index,
      startAtLastPage: false,
      scrollToBottom: false
    }));

    // Update last read chapter
    if (window.electronAPI && collectionContext.collectionId) {
      await window.electronAPI.updateCollectionLastOpened(collectionContext.collectionId, chapter.ID);
    }

    // Switch media in main process to ensure navigation works correctly
    if (window.electronAPI) {
      await window.electronAPI.switchViewerMedia(chapter.ID);
    }

    // Restore the mode after switching media
    await window.electronAPI.setViewerMode(viewerState.mode);

    // Reload viewer with new media
    setLoading(true);
    try {
      const mediaResult = await window.electronAPI.getViewerData(chapter.ID);
      if (mediaResult.success) {
        setViewerState(prev => ({
          ...prev,
          media: mediaResult.data,
          mediaId: chapter.ID,
          currentPage: 0,
          totalPages: mediaResult.data.pageCount || 1,
          rating: mediaResult.data.rating || 0,
          progress: mediaResult.data.progress || 0
        }));
        setLoading(false);
      }
    } catch (err) {
      console.error('ViewerFrame: Failed to load chapter:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLastReadChapter = useCallback(async () => {
    if (!collectionContext.lastOpenedId || !collectionContext.manifest) {
      console.log('ViewerFrame: No last read chapter available');
      return;
    }

    const lastReadIndex = collectionContext.manifest.findIndex(entry => entry.ID === collectionContext.lastOpenedId);
    if (lastReadIndex === -1) {
      console.log('ViewerFrame: Last read chapter not found in manifest');
      return;
    }

    await handleJumpToChapter(lastReadIndex);
  }, [collectionContext, handleJumpToChapter]);

  useEffect(() => {
    // Set up keyboard and mouse listeners
    const handleKeydown = (event) => {
      // Check if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
      );

      // Allow typing in input fields even when modals are open
      if (isInputField) {
        return;
      }

      // Prevent navigation keys when modals are open (but allow ESC to close)
      if (modalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          // Let the modal handle ESC close
        }
        // Block all navigation keys when modal is open
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Home', 'End'].includes(event.key) ||
            ['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
          event.preventDefault();
        }
        return;
      }

      // Prevent navigation in webtoon mode - only allow zoom, close, and toggle
      if (viewerState.mode === 'webtoon') {
        switch(event.key) {
          case 'Escape':
            event.preventDefault();
            closeViewer();
            break;
          case 'Enter':
            event.preventDefault();
            toggleControls();
            break;
          case '+':
          case '=':
            event.preventDefault();
            updateZoom(viewerState.zoom + 0.1);
            break;
          case '-':
          case '_':
            event.preventDefault();
            updateZoom(viewerState.zoom - 0.1);
            break;
        }
        return; // Don't process navigation keys in webtoon mode
      }

      // Navigation keys for single page and manga modes
      switch(event.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          event.preventDefault();
          // In manga mode, left arrow goes to next page, otherwise previous
          const leftDirection = viewerState.mode === 'manga' ? 'next' : 'previous';
          // Check for chapter navigation at first page
          if (leftDirection === 'previous' && viewerState.currentPage <= 0 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex > 0) {
            handlePreviousChapter();
          } else if (leftDirection === 'next' && viewerState.currentPage >= viewerState.totalPages - 1 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex < collectionContext.manifest.length - 1) {
            handleNextChapter();
          } else {
            navigateViewer(leftDirection);
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          event.preventDefault();
          // In manga mode, right arrow goes to previous page, otherwise next
          const rightDirection = viewerState.mode === 'manga' ? 'previous' : 'next';
          // Check for chapter navigation at first page
          if (rightDirection === 'previous' && viewerState.currentPage <= 0 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex > 0) {
            handlePreviousChapter();
          } else if (rightDirection === 'next' && viewerState.currentPage >= viewerState.totalPages - 1 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex < collectionContext.manifest.length - 1) {
            handleNextChapter();
          } else {
            navigateViewer(rightDirection);
          }
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          event.preventDefault();
          // Check for chapter navigation at first page
          if (viewerState.currentPage <= 0 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex > 0) {
            handlePreviousChapter();
          } else {
            navigateViewer('previous');
          }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          event.preventDefault();
          // Check for chapter navigation at last page
          if (viewerState.currentPage >= viewerState.totalPages - 1 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex < collectionContext.manifest.length - 1) {
            handleNextChapter();
          } else {
            navigateViewer('next');
          }
          break;
        case 'Home':
          event.preventDefault();
          navigateViewer('first');
          break;
        case 'End':
          event.preventDefault();
          navigateViewer('last');
          break;
        case ' ':
          event.preventDefault();
          // Check for chapter navigation at last page
          if (viewerState.currentPage >= viewerState.totalPages - 1 &&
              collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 &&
              collectionContext.currentChapterIndex < collectionContext.manifest.length - 1) {
            handleNextChapter();
          } else {
            navigateViewer('next');
          }
          break;
        case 'Escape':
          event.preventDefault();
          closeViewer();
          break;
        case 'Enter':
          event.preventDefault();
          toggleControls();
          break;
        case '+':
        case '=':
          event.preventDefault();
          updateZoom(viewerState.zoom + 0.1);
          break;
        case '-':
        case '_':
          event.preventDefault();
          updateZoom(viewerState.zoom - 0.1);
          break;
      }
    };

    const handleContextMenu = (event) => {
      event.preventDefault();
      toggleControls();
    };
    
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [viewerState.zoom, viewerState.mode, modalOpen, collectionContext, handleNextChapter, handlePreviousChapter, viewerState.currentPage, viewerState.totalPages]);

  useEffect(() => {
    // Listen for state updates from main process
    if (window.electronAPI) {
      const handleStateUpdate = (state) => {
        console.log('ViewerFrame: Received state update:', state);
        setViewerState(prev => ({
          ...prev,
          ...state,
          // Preserve local showControls and zoom state - don't let main process override them
          showControls: prev.showControls,
          zoom: prev.zoom
        }));
      };

      window.electronAPI.onViewerStateUpdate(handleStateUpdate);

      return () => {
        window.electronAPI.removeViewerStateUpdateListener();
      };
    }
  }, []);

  // Render different viewer modes
  const renderViewerMode = () => {
    if (!viewerState.hasMedia) {
      return (
        <div className="viewer-placeholder">
          <div className="placeholder-content">
            <h2>No Media Loaded</h2>
            <p>Media ID: {viewerState.mediaId}</p>
            <p>Mode: {viewerState.mode}</p>
          </div>
        </div>
      );
    }

    switch(viewerState.mode) {
      case 'webtoon':
        return (
          <div className="viewer-with-controls">
            <WebtoonViewer
              state={viewerState}
              collectionContext={collectionContext}
              onNextChapter={handleNextChapter}
              onPreviousChapter={handlePreviousChapter}
              onNavigate={navigateViewer}
              onZoom={updateZoom}
            />
            <WebtoonControls state={viewerState} onModalStateChange={setModalOpen} />
          </div>
        );
      case 'singlepage':
        return (
          <div className="viewer-with-controls">
            <SinglePageViewer
              key={`singlepage-${viewerState.currentPage}`}
              state={viewerState}
              collectionContext={collectionContext}
              onNextChapter={handleNextChapter}
              onPreviousChapter={handlePreviousChapter}
              mangaMode={false}
              onNavigate={navigateViewer}
              onZoom={updateZoom}
            />
          </div>
        );
      case 'manga':
        return (
          <div className="viewer-with-controls">
            <SinglePageViewer
              key={`manga-${viewerState.currentPage}`}
              state={viewerState}
              collectionContext={collectionContext}
              onNextChapter={handleNextChapter}
              onPreviousChapter={handlePreviousChapter}
              mangaMode={true}
              onNavigate={navigateViewer}
              onZoom={updateZoom}
            />
          </div>
        );
      default:
        return (
          <div className="viewer-with-controls">
            <SinglePageViewer
              key={`default-${viewerState.currentPage}`}
              state={viewerState}
              collectionContext={collectionContext}
              onNextChapter={handleNextChapter}
              onPreviousChapter={handlePreviousChapter}
              mangaMode={false}
              onNavigate={navigateViewer}
              onZoom={updateZoom}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="viewer-loading">
        <div className="loading-content">
          <h2>Loading PeraPera Viewer...</h2>
          <p>Initializing viewer engine</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-error">
        <div className="error-content">
          <h2>Viewer Error</h2>
          <p>{error}</p>
          <button onClick={closeViewer}>Close Viewer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-frame">
      <div className="viewer-content">
        {renderViewerMode()}
      </div>
      {viewerState.showControls && (
        <ViewerControls
          state={viewerState}
          collectionContext={collectionContext}
          onJumpToChapter={handleJumpToChapter}
          onNextChapter={handleNextChapter}
          onPreviousChapter={handlePreviousChapter}
          onLastReadChapter={handleLastReadChapter}
          onNavigate={navigateViewer}
          onClose={closeViewer}
          onToggleControls={toggleControls}
          onJumpToPage={jumpToPage}
          onModeChange={setViewerMode}
          onZoom={updateZoom}
          onModalStateChange={setModalOpen}
        />
      )}
    </div>
  );
};

export default ViewerFrame;