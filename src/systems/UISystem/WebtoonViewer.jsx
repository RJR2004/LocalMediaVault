import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';

const WebtoonViewer = ({ state, collectionContext, onNextChapter, onPreviousChapter }) => {
  const [images, setImages] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [holdAtTop, setHoldAtTop] = useState(false);
  const [holdAtBottom, setHoldAtBottom] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [refsReady, setRefsReady] = useState(false);
  const [initialScrollBottom, setInitialScrollBottom] = useState(false);
  const [scrollTimeMs, setScrollTimeMs] = useState(300);
  const [scrollDistanceMultiplier, setScrollDistanceMultiplier] = useState(0.5);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const holdProgressIntervalRef = useRef(null);
  const pageRefs = useRef([]);
  const activeKeysRef = useRef(new Set());
  const continuousScrollRef = useRef(null);
  const scrollIntentTimeoutRef = useRef(null);

  // Initialize pages from media data
  useEffect(() => {
    const loadPages = async () => {
      if (state.media && state.totalPages > 0) {
        console.log('WebtoonViewer: Media data:', state.media);
        console.log('WebtoonViewer: Media PATH:', state.media.PATH);
        console.log('WebtoonViewer: Media path:', state.media.path);
        
        // Get the directory path from media data
        const mediaPath = state.media.PATH || state.media.path;
        
        if (!mediaPath) {
          console.error('WebtoonViewer: No media path available');
          return;
        }
        
        try {
          // Get all image files from the directory via IPC
          if (window.electronAPI) {
            const result = await window.electronAPI.getDirectoryFiles(mediaPath);
            if (result.success && result.files && result.files.length > 0) {
              // Sort files alphabetically
              const sortedFiles = result.files.sort((a, b) => a.localeCompare(b));
              
              // Create page objects for each file
              const pages = sortedFiles.map((file, index) => ({
                index: index,
                path: mediaPath + '\\' + file,
                filename: file,
                loaded: false,
                element: null,
                aspectRatio: null
              }));
              
              // Batch the initialScrollBottom state with the images payload
              // to prevent the browser from painting an intermediate state at the top.
              setImages(pages);
              pageRefs.current = new Array(pages.length).fill(null);
              setRefsReady(false);

              const shouldScrollToBottom = Boolean(collectionContext?.scrollToBottom);
              setInitialScrollBottom(shouldScrollToBottom);
              
              console.log(`WebtoonViewer: Initialized with ${pages.length} pages`);
            } else {
              console.error('WebtoonViewer: No image files found in directory');
            }
          } else {
            console.error('WebtoonViewer: Electron API not available');
          }
        } catch (error) {
          console.error('WebtoonViewer: Failed to load pages:', error);
        }
      }
    };

    loadPages();
  }, [state.media?.PATH, state.totalPages]);

  // Set refs ready after render
  useEffect(() => {
    if (images.length > 0) {
      setRefsReady(true);
    }
  }, [images.length]);

  // Load scroll settings from config
  useEffect(() => {
    const loadScrollSettings = async () => {
      if (window.electronAPI) {
        try {
          const config = await window.electronAPI.getConfig();
          if (config) {
            if (config.scrollTimeMs) {
              setScrollTimeMs(config.scrollTimeMs);
            }
            if (config.scrollDistanceMultiplier) {
              setScrollDistanceMultiplier(config.scrollDistanceMultiplier);
            }
          }
        } catch (error) {
          console.error('WebtoonViewer: Failed to load scroll settings:', error);
        }
      }
    };

    loadScrollSettings();
  }, []);

  // Set initial scroll position to bottom BEFORE the browser paints the screen
  useLayoutEffect(() => {
    if (initialScrollBottom && containerRef.current && images.length > 0) {
      console.log('WebtoonViewer: Setting initial scroll to bottom instantly');
      const container = containerRef.current;
      
      // Temporarily bypass any smooth scrolling from CSS to ensure an instant snap
      const originalBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = 'auto';
      
      container.scrollTop = container.scrollHeight;
      
      // Restore original scroll behavior immediately after snapping
      container.style.scrollBehavior = originalBehavior;
      
      setInitialScrollBottom(false);
    }
  }, [initialScrollBottom, images.length]);

  // Helper function to preload image dimensions
  const preloadImageDimensions = useCallback((imagePath) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight
        });
      };
      img.onerror = reject;
      img.src = `file://${imagePath}`;
    });
  }, []);

  // Setup IntersectionObserver for lazy loading
  useEffect(() => {
    if (!refsReady) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const index = parseInt(entry.target.dataset.index);
          if (entry.isIntersecting) {
            // Page is visible, load it
            setImages(prevImages => {
              const newImages = [...prevImages];
              if (newImages[index] && !newImages[index].loaded) {
                // First preload dimensions if not already done
                if (!newImages[index].aspectRatio) {
                  preloadImageDimensions(newImages[index].path)
                    .then(dimensions => {
                      setImages(currentImages => {
                        const updated = [...currentImages];
                        if (updated[index]) {
                          updated[index] = {
                            ...updated[index],
                            ...dimensions
                          };
                        }
                        return updated;
                      });
                    })
                    .catch(err => {
                      console.error(`Failed to preload dimensions for page ${index + 1}:`, err);
                    });
                }
                // Then load the image
                newImages[index] = {
                  ...newImages[index],
                  loaded: true
                };
              }
              return newImages;
            });
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '200px',
        threshold: 0.1
      }
    );

    // Delay observation to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      pageRefs.current.forEach((ref, index) => {
        if (ref) {
          ref.dataset.index = index;
          observer.observe(ref);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [refsReady, preloadImageDimensions]);

  // Smooth scrolling
  /**
 * @param {number} targetPosition - Where to scroll to (pixels)
 * @param {number} duration - How long the scroll takes (ms)
 * @param {number} distance - (Optional) Force a relative distance move
 */
const scrollToPosition = useCallback((targetPosition, duration = 300) => {
  const container = containerRef.current;
  if (!container) return;

  // Kill any existing scroll animations to stop jittering
  if (scrollTimeoutRef.current) {
    cancelAnimationFrame(scrollTimeoutRef.current);
  }

  const startPosition = container.scrollTop;
  const startTime = performance.now();

  // The Easing Math: Ease-In-Out Cubic
  // t is the raw progress (from 0 to 1)
  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    // rawProgress is strictly linear (0.0 -> 1.0)
    const rawProgress = Math.min(elapsed / duration, 1);
    
    // Apply the easing math to bend the straight line into a curve
    const easedProgress = easeInOutCubic(rawProgress);
    
    // Calculate new position using the EASED progress, not the linear one
    const newPosition = startPosition + (targetPosition - startPosition) * easedProgress;
    
    container.scrollTop = newPosition;

    if (rawProgress < 1) {
      scrollTimeoutRef.current = requestAnimationFrame(animate);
    }
  };

  scrollTimeoutRef.current = requestAnimationFrame(animate);
}, []);

  // Hold-to-navigate detection
  const handleHoldStart = useCallback((atTop) => {
    setHoldProgress(0);
    const holdDuration = 600; // 600ms hold duration

    if (atTop) {
      setHoldAtTop(true);
      holdTimeoutRef.current = setTimeout(() => {
        // Navigate to previous chapter
        if (onPreviousChapter) {
          onPreviousChapter();
        }
      }, holdDuration);

      // Progress bar animation
      holdProgressIntervalRef.current = setInterval(() => {
        setHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(holdProgressIntervalRef.current);
            return 100;
          }
          return prev + (100 / (holdDuration / 50)); // Update every 50ms
        });
      }, 50);
    } else {
      setHoldAtBottom(true);
      holdTimeoutRef.current = setTimeout(() => {
        // Navigate to next chapter
        if (onNextChapter) {
          onNextChapter();
        }
      }, holdDuration);

      // Progress bar animation
      holdProgressIntervalRef.current = setInterval(() => {
        setHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(holdProgressIntervalRef.current);
            return 100;
          }
          return prev + (100 / (holdDuration / 50)); // Update every 50ms
        });
      }, 50);
    }
  }, [onPreviousChapter, onNextChapter]);

  const handleHoldEnd = useCallback(() => {
    setHoldAtTop(false);
    setHoldAtBottom(false);
    setHoldProgress(0);
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    if (holdProgressIntervalRef.current) {
      clearInterval(holdProgressIntervalRef.current);
    }
  }, []);

  const startContinuousScroll = useCallback((direction) => {
    const container = containerRef.current;
    if (!container) return;

    const distanceToCover = container.clientHeight * scrollDistanceMultiplier;
    const velocity = distanceToCover / scrollTimeMs;

    let lastTime = performance.now();

    const loop = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      const currentScroll = container.scrollTop;
      const maxScroll = container.scrollHeight - container.clientHeight;

      let moveAmount = velocity * deltaTime*1.5;
      if (direction === 'up') moveAmount *= -1;

      let nextScroll = currentScroll + moveAmount;

      if (nextScroll <= 0 && direction === 'up') {
        container.scrollTop = 0;
        if (collectionContext?.currentChapterIndex > 0) {
          handleHoldStart(true);
        }
        return;
      }

      if (nextScroll >= maxScroll && direction === 'down') {
        container.scrollTop = maxScroll;
        if (collectionContext?.currentChapterIndex < collectionContext?.manifest?.length - 1) {
          handleHoldStart(false);
        }
        return;
      }

      container.scrollTop = nextScroll;
      continuousScrollRef.current = requestAnimationFrame(loop);
    };

    continuousScrollRef.current = requestAnimationFrame(loop);
  }, [scrollDistanceMultiplier, scrollTimeMs, collectionContext, handleHoldStart]);

  const stopContinuousScroll = useCallback(() => {
    if (continuousScrollRef.current) {
      cancelAnimationFrame(continuousScrollRef.current);
      continuousScrollRef.current = null;
    }
    if (scrollIntentTimeoutRef.current) {
      clearTimeout(scrollIntentTimeoutRef.current);
    }
  }, []);

  // Edge detection for hold-to-navigate
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    // Check if at top edge (< 120px)
    if (scrollTop < 120) {
      // Show hold indicator for previous
      if (!holdAtTop) {
        // Could trigger visual indicator
      }
    }
    
    // Check if at bottom edge (within 10px)
    if (scrollTop + containerHeight >= scrollHeight - 10) {
      // Show hold indicator for next
      if (!holdAtBottom) {
        // Could trigger visual indicator
      }
    }
    
    setScrollPosition(scrollTop);
  }, [holdAtTop, holdAtBottom]);

  // Progress calculation
  const getScrollProgress = useCallback(() => {
    const container = containerRef.current;
    if (!container || images.length === 0) return 0;
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    return scrollHeight > 0 ? (scrollTop / scrollHeight) * 10000 : 0;
  }, [images.length]);


  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const container = containerRef.current;
      if (!container) return;

      const SCROLL_DISTANCE = container.clientHeight * scrollDistanceMultiplier;

      if (e.repeat) return;

      activeKeysRef.current.add(e.key);

      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;
      const isAtTop = scrollTop < 10;
      const isAtBottom = scrollTop + containerHeight >= scrollHeight - 10;

      const isArrowUp = ['ArrowUp', 'w', 'W'].includes(e.key);
      const isArrowDown = ['ArrowDown', 's', 'S'].includes(e.key);

      if (isArrowUp || isArrowDown) {
        e.preventDefault();
        const direction = isArrowUp ? 'up' : 'down';

        if (isArrowUp && isAtTop && collectionContext?.currentChapterIndex > 0) {
          handleHoldStart(true);
          return;
        }
        if (isArrowDown && isAtBottom && collectionContext?.currentChapterIndex < collectionContext?.manifest?.length - 1) {
          handleHoldStart(false);
          return;
        }

        const targetPos = isArrowUp
          ? Math.max(0, scrollTop - SCROLL_DISTANCE)
          : Math.min(scrollHeight, scrollTop + SCROLL_DISTANCE);

        scrollToPosition(targetPos, scrollTimeMs);

        scrollIntentTimeoutRef.current = setTimeout(() => {
          if (activeKeysRef.current.has(e.key)) {
             startContinuousScroll(direction);
          }
        }, scrollTimeMs + 20);
      }

      switch (e.key) {
        case 'PageUp':
          e.preventDefault();
          scrollToPosition(Math.max(0, scrollTop - containerHeight), scrollTimeMs);
          break;
        case 'PageDown':
          e.preventDefault();
          scrollToPosition(Math.min(scrollHeight, scrollTop + containerHeight), scrollTimeMs);
          break;
        case 'Home':
          e.preventDefault();
          scrollToPosition(0, scrollTimeMs);
          break;
        case 'End':
          e.preventDefault();
          scrollToPosition(scrollHeight, scrollTimeMs);
          break;
      }
    };

    const handleKeyUp = (e) => {
      activeKeysRef.current.delete(e.key);

      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(e.key)) {
        handleHoldEnd();
        stopContinuousScroll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [scrollToPosition, collectionContext, handleHoldStart, handleHoldEnd, scrollTimeMs, scrollDistanceMultiplier, startContinuousScroll, stopContinuousScroll]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
      if (holdProgressIntervalRef.current) {
        clearInterval(holdProgressIntervalRef.current);
      }
      if (scrollIntentTimeoutRef.current) clearTimeout(scrollIntentTimeoutRef.current);
      if (continuousScrollRef.current) cancelAnimationFrame(continuousScrollRef.current);
    };
  }, []);

  if (images.length === 0) {
    return (
      <div className="webtoon-viewer loading">
        <div className="loading-message">Loading pages...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="webtoon-viewer"
      onScroll={handleScroll}
      style={{ height: '100vh', overflowY: 'auto', position: 'relative' }}
    >
      {/* Top hold indicator */}
      <div
        className={`hold-indicator top ${holdAtTop ? 'active' : ''}`}
        onMouseDown={() => handleHoldStart(true)}
        onMouseUp={handleHoldEnd}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          handleHoldEnd();
        }}
        style={{
          padding: '12px 20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          cursor: 'pointer',
          marginBottom: '10px',
          borderRadius: '8px',
          transition: 'background-color 0.2s',
          textAlign: 'center'
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
      >
        
        {holdAtTop && (
          <div
            style={{
              width: '100%',
              height: '3px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${holdProgress}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.05s linear'
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom hold indicator */}
      <div
        className={`hold-indicator bottom ${holdAtBottom ? 'active' : ''}`}
        onMouseDown={() => handleHoldStart(false)}
        onMouseUp={handleHoldEnd}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
          handleHoldEnd();
        }}
        style={{
          padding: '12px 20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          cursor: 'pointer',
          marginTop: '10px',
          borderRadius: '8px',
          transition: 'background-color 0.2s',
          textAlign: 'center'
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
      >
        {holdAtBottom && (
          <div
            style={{
              width: '100%',
              height: '3px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${holdProgress}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                transition: 'width 0.05s linear'
              }}
            />
          </div>
        )}
      </div>

      {/* Pages - wrapped in zoom container for continuous strip */}
      <div
        className="webtoon-zoom-container"
        style={{
          width: `${80 * state.zoom}%`,
          margin: '0 auto',
          transformOrigin: 'top center'
        }}
      >
        {/* Previous Chapter Banner */}
        {collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 && collectionContext.currentChapterIndex > 0 && (
          <div
            className="chapter-banner previous-chapter"
            onClick={() => onPreviousChapter && onPreviousChapter()}
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              cursor: 'pointer',
              marginBottom: '20px',
              borderRadius: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
          >
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>⬆ Previous Chapter</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              {collectionContext.manifest[collectionContext.currentChapterIndex - 1]?.NAME || 'Previous'}
            </div>
          </div>
        )}

        {images.map((image, index) => (
          <div
            key={index}
            ref={el => pageRefs.current[index] = el}
            className="webtoon-page"
            style={{
              lineHeight: 0,
              aspectRatio: image.aspectRatio ? `${image.aspectRatio}` : '0.7 / 1',
              contain: 'size layout'
            }}
          >
            {image.loaded ? (
              <img
                src={`file://${image.path}`}
                alt={`Page ${index + 1}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
                onLoad={() => {
                  console.log(`WebtoonViewer: Loaded page ${index + 1}`);
                }}
                onError={() => {
                  console.error(`WebtoonViewer: Failed to load page ${index + 1}`);
                  setImages(prevImages => {
                    const newImages = [...prevImages];
                    if (newImages[index]) {
                      newImages[index] = {
                        ...newImages[index],
                        loaded: false,
                        error: true
                      };
                    }
                    return newImages;
                  });
                }}
              />
            ) : (
              <div className="page-placeholder">
                <div className="placeholder-content">
                  {image.error ? (
                    <div className="error-message">Failed to load page {index + 1}</div>
                  ) : (
                    <div className="loading-text">Loading Page {index + 1}...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Next Chapter Banner */}
        {collectionContext && collectionContext.manifest && collectionContext.manifest.length > 0 && collectionContext.currentChapterIndex < collectionContext.manifest.length - 1 && (
          <div
            className="chapter-banner next-chapter"
            onClick={() => onNextChapter && onNextChapter()}
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              cursor: 'pointer',
              marginTop: '20px',
              borderRadius: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'}
          >
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Next Chapter ⬇</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              {collectionContext.manifest[collectionContext.currentChapterIndex + 1]?.NAME || 'Next'}
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator - simple display like single page mode */}
      <div className="progress-info">
        Page {Math.floor((getScrollProgress() / 10000) * images.length) + 1} / {images.length} ({Math.round(getScrollProgress() / 100)}%)
      </div>

      {/* Navigation hints */}
      <div className="navigation-hints">
        <div className="hint">↑↓ or W/S: Scroll • PageUp/PageDown: Jump • Home/End: Top/Bottom</div>
      </div>
    </div>
  );
};

export default WebtoonViewer;