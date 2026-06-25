import React, { useState, useEffect, useRef } from 'react';
import mediaLoader from '../ViewerEngine/MediaLoader.js';

const SinglePageViewer = ({ state, mangaMode = false, onNavigate, onZoom, collectionContext, onNextChapter, onPreviousChapter }) => {
  const [imageSrc, setImageSrc] = useState('');
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Unified navigation handler for both click and keyboard
  const handleNavigation = (direction) => {
    // Check if we should navigate to next/previous chapter instead
    const isAtLastPage = state.currentPage >= state.totalPages - 1;
    const isAtFirstPage = state.currentPage <= 0;
    const hasCollection = collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0;

    if (direction === 'next' && isAtLastPage && hasCollection) {
      // Check if there's a next chapter
      const hasNextChapter = collectionContext.currentChapterIndex < collectionContext.manifest.length - 1;
      if (hasNextChapter && onNextChapter) {
        onNextChapter();
        return;
      }
    }

    if (direction === 'previous' && isAtFirstPage && hasCollection) {
      // Check if there's a previous chapter
      const hasPrevChapter = collectionContext.currentChapterIndex > 0;
      if (hasPrevChapter && onPreviousChapter) {
        onPreviousChapter();
        return;
      }
    }

    if (onNavigate) {
      onNavigate(direction);
    }
  };

  // Calculate navigation direction based on manga mode
  const getNavigationDirection = (clickSide) => {
    if (mangaMode) {
      // In manga mode, navigation is reversed
      // Left side goes to next page, right side goes to previous page
      return clickSide === 'left' ? 'next' : 'previous';
    }
    return clickSide === 'left' ? 'previous' : 'next';
  };

  const handleImageClick = (event) => {
    // Don't navigate if zoomed in and dragging
    if (state.zoom > 1 && isDragging) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    
    const clickSide = x < width / 2 ? 'left' : 'right';
    const direction = getNavigationDirection(clickSide);
    
    handleNavigation(direction);
  };

  const handleMouseDown = (event) => {
    if (state.zoom > 1) {
      event.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: event.clientX - imagePosition.x,
        y: event.clientY - imagePosition.y
      });
    }
  };

  const handleMouseMove = (event) => {
    if (isDragging && state.zoom > 1) {
      const newX = event.clientX - dragStart.x;
      const newY = event.clientY - dragStart.y;
      setImagePosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5.0, state.zoom + delta));
    onZoom(newZoom);
    // Reset position when zooming to keep image centered
    setImagePosition({ x: 0, y: 0 });
  };

  // Reset position when zoom changes
  useEffect(() => {
    if (state.zoom <= 1) {
      setImagePosition({ x: 0, y: 0 });
    }
  }, [state.zoom]);

  // Load actual image using MediaLoader
  useEffect(() => {
    const loadImage = async () => {
      setImageLoading(true);
      setImageError(null);
      setImageSrc('');
      
      console.log('SinglePageViewer: useEffect triggered with state:', {
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        mediaExists: !!state.media
      });
      
      try {
        if (state.media && state.currentPage >= 0 && state.totalPages > 0) {
          console.log('SinglePageViewer: Media data:', state.media);
          console.log('SinglePageViewer: Media PATH:', state.media.PATH);
          console.log('SinglePageViewer: Media path:', state.media.path);
          
          // Get the directory path from media data (try both field names)
          const mediaPath = state.media.PATH || state.media.path;
          console.log('SinglePageViewer: Loading image from path:', mediaPath);
          
          if (!mediaPath) {
            setImageError('No media path available');
            return;
          }
          
          // Get all image files from the directory via IPC
          if (window.electronAPI) {
            const result = await window.electronAPI.getDirectoryFiles(mediaPath);
            if (result.success && result.files && result.files.length > 0) {
              // Sort files alphabetically
              const sortedFiles = result.files.sort((a, b) => a.localeCompare(b));
              
              // Get the current page file
              const currentPageFile = sortedFiles[state.currentPage];
              if (currentPageFile) {
                const imageFilePath = mediaPath + '\\' + currentPageFile;
                const imageFileUrl = `file://${imageFilePath}`;
                
                setImageSrc(imageFileUrl);
                console.log(`SinglePageViewer: Set image src to: ${imageFileUrl} (page ${state.currentPage + 1} of ${sortedFiles.length})`);
              } else {
                setImageError(`No image file found for page ${state.currentPage + 1}`);
              }
            } else {
              setImageError('No image files found in directory');
            }
          } else {
            setImageError('Electron API not available');
          }
        } else {
          console.log('SinglePageViewer: No media data or invalid state:', {
            mediaExists: !!state.media,
            currentPage: state.currentPage,
            totalPages: state.totalPages
          });
          setImageError('No media data available');
        }
      } catch (err) {
        console.error('SinglePageViewer: Failed to load image:', err);
        setImageError('Failed to load image');
      } finally {
        setImageLoading(false);
      }
    };

    loadImage();
  }, [state.media, state.currentPage, state.totalPages]);

  // Add global mouse event listeners
  useEffect(() => {
    const handleGlobalMouseMove = (event) => {
      if (isDragging) {
        handleMouseMove(event);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, imagePosition]);

  const getImageStyle = () => {
    const baseStyle = {
      transform: `scale(${state.zoom}) translate(${imagePosition.x / state.zoom}px, ${imagePosition.y / state.zoom}px)`,
      transition: isDragging ? 'none' : 'transform 0s',
      transformOrigin: 'center center',
      cursor: state.zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none'
    };

    return baseStyle;
  };

  const calculateAutoFitZoom = (imgWidth, imgHeight) => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    // Add padding (40px) to ensure UI elements don't overlap
    const padding = 0;
    const availableWidth = containerWidth - padding;
    const availableHeight = containerHeight - padding;

    // Calculate scale to fit within available space
    const scaleX = availableWidth / imgWidth;
    const scaleY = availableHeight / imgHeight;

    // Use the smaller scale to ensure image fits both dimensions
    const autoFitZoom = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x

    return Math.max(0.1, autoFitZoom); // Ensure minimum zoom
  };


  if (imageError) {
    return (
      <div className="single-page-viewer">
        <div className="image-error">
          <h3>Image Error</h3>
          <p>{imageError}</p>
          <p>Page {state.currentPage + 1} / {state.totalPages}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="single-page-viewer"
      onWheel={handleWheel}
    >
      <div className="image-container">
        {imageLoading || !imageSrc ? (
          <div className="image-loading">
            <div className="loading-spinner"></div>
            <p>Loading page {state.currentPage + 1}...</p>
          </div>
        ) : (
          <div 
            ref={imageRef}
            className="image-wrapper"
            onMouseDown={handleMouseDown}
            onClick={handleImageClick}
            style={getImageStyle()}
          >
            <img
              src={imageSrc}
              alt={`Page ${state.currentPage + 1} / ${state.totalPages}`}
              style={{
               // maxWidth: '100%',
               // maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                //objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none'
              }}
              onLoad={(e) => {
                console.log(`SinglePageViewer: Loaded page ${state.currentPage + 1}`);
                const img = e.target;
                const autoFitZoom = calculateAutoFitZoom(img.naturalWidth, img.naturalHeight);
                console.log(`SinglePageViewer: Auto-fit zoom calculated: ${autoFitZoom.toFixed(3)}`);
                onZoom(autoFitZoom);
                setImagePosition({ x: 0, y: 0 });
              }}
              onError={(e) => {
                console.error(`SinglePageViewer: Failed to load page ${state.currentPage + 1}:`, e);
                setImageError('Failed to load image');
              }}
            />
          </div>
        )}
      </div>
      
      {/* Page info overlay */}
      <div className="page-info-overlay">
        <span className="page-number">
          Page {state.currentPage + 1} / {state.totalPages}
        </span>
        <span className="view-mode">
          {mangaMode ? 'Manga' : 'Single Page'}
        </span>
        {state.zoom > 1 && (
          <span className="zoom-level">
            {Math.round(state.zoom * 100)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default SinglePageViewer;
