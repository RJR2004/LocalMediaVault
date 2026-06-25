import React, { useState, useEffect, useRef } from 'react';
import './collection-viewer.css';

function CollectionViewer({ collectionId, onClose, onContinueReading, onEditCollection }) {
  const [collection, setCollection] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [contextMenu, setContextMenu] = useState(null);
  const modalRef = useRef(null);
  const itemRefs = useRef([]);

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
      } catch (err) {
        console.error('CollectionViewer: Error loading collection:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (collectionId) {
      loadCollection();
    }
  }, [collectionId]);

  useEffect(() => {
        // 1. Freeze the background
        document.body.style.overflow = 'hidden';

        // 2. This cleanup runs when you close the editor
        return () => {
          document.body.style.overflow = 'unset';
        };
      }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (loading || error) return;

      // ESC always closes the viewer
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Calculate total focusable items: 2 buttons + members
      const totalItems = 2 + members.length;

      // Start focus on arrow keys if not already focused
      if (focusedIndex === -1 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (totalItems > 0) {
          e.preventDefault();
          setFocusedIndex(0);
          return;
        }
      }

      if (focusedIndex === -1) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(totalItems - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex === 0) {
            // Continue Reading button
            handleContinueReading();
          } else if (focusedIndex === 1) {
            // Edit Collection button
            onEditCollection(collectionId);
          } else if (focusedIndex >= 2) {
            // Collection entry
            const entryIndex = focusedIndex - 2;
            if (entryIndex < members.length) {
              handleEntryClick(members[entryIndex]);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, members, loading, error, collection, onContinueReading, onEditCollection, onClose, collectionId]);

  // Reset focus when members change
  useEffect(() => {
    setFocusedIndex(-1);
    itemRefs.current = [];
  }, [members]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'instant'
      });
    }
  }, [focusedIndex]);

  // Handle continue reading
  const handleContinueReading = () => {
    if (collection?.LAST_OPENED_ID) {
      onContinueReading(collection.LAST_OPENED_ID);
    }
  };

  // Handle entry double-click
  const handleEntryClick = (entry) => {
    if (onContinueReading) {
      onContinueReading(entry.ID);
    }
  };

  // Find last read entry
  const getLastReadEntry = () => {
    return members.find(member => member.ID === collection?.LAST_OPENED_ID);
  };

  // Handle right-click on entry
  const handleEntryRightClick = (e, member) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      member: member
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Handle mark as completed
  const handleMarkCompleted = async (member) => {
    try {
      const result = await window.electronAPI.markCollectionMemberCompleted(collectionId, member.ID);
      if (result.success) {
        // Refresh members
        const membersResult = await window.electronAPI.getCollectionMembers(collectionId);
        if (membersResult.success) {
          setMembers(membersResult.data || []);
        }
      }
    } catch (err) {
      console.error('Error marking as completed:', err);
    }
    closeContextMenu();
  };

  // Handle mark as not completed
  const handleMarkNotCompleted = async (member) => {
    try {
      const result = await window.electronAPI.markCollectionMemberNotCompleted(collectionId, member.ID);
      if (result.success) {
        // Refresh members
        const membersResult = await window.electronAPI.getCollectionMembers(collectionId);
        if (membersResult.success) {
          setMembers(membersResult.data || []);
        }
      }
    } catch (err) {
      console.error('Error marking as not completed:', err);
    }
    closeContextMenu();
  };

  // Handle reset all completed
  const handleResetAllCompleted = async () => {
    if (window.confirm('Are you sure you want to reset all entries in this collection to not completed?')) {
      try {
        const result = await window.electronAPI.resetAllCollectionMembersCompleted(collectionId);
        if (result.success) {
          // Refresh members
          const membersResult = await window.electronAPI.getCollectionMembers(collectionId);
          if (membersResult.success) {
            setMembers(membersResult.data || []);
          }
        }
      } catch (err) {
        console.error('Error resetting all completed:', err);
      }
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        closeContextMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  if (loading) {
    return (
      <div className="collection-viewer-overlay">
        <div className="collection-viewer-modal">
          <div className="collection-viewer-loading">
            <div className="loading-spinner"></div>
            <p>Loading collection...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collection-viewer-overlay">
        <div className="collection-viewer-modal">
          <div className="collection-viewer-error">
            <h3>Error</h3>
            <p>{error}</p>
            <button onClick={onClose} className="collection-viewer-button">Close</button>
          </div>
        </div>
      </div>
    );
  }

  const lastReadEntry = getLastReadEntry();

  return (
    <div className="collection-viewer-overlay" onClick={onClose}>
      <div className="collection-viewer-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="collection-viewer-header">
          <div className="collection-info">
            <h2>{collection?.NAME || 'Unknown Collection'}</h2>
            <p className="collection-stats">
              {members.length} {members.length === 1 ? 'entry' : 'entries'}
              {collection?.RATING > 0 && ` • Rating: ${collection.RATING}/100`}
            </p>
          </div>
          <button onClick={onClose} className="collection-viewer-close">&times;</button>
        </div>

        {/* Action Buttons */}
        <div className="collection-viewer-actions">
          <button
            ref={el => itemRefs.current[0] = el}
            onClick={handleContinueReading}
            disabled={!lastReadEntry}
            className={`collection-viewer-button primary ${focusedIndex === 0 ? 'focused' : ''}`}
          >
            {lastReadEntry ? 'Continue Reading' : 'No Reading History'}
          </button>
          <button
            ref={el => itemRefs.current[1] = el}
            onClick={() => onEditCollection(collectionId)}
            className={`collection-viewer-button secondary ${focusedIndex === 1 ? 'focused' : ''}`}
          >
            Edit Collection
          </button>
          <button
            onClick={handleResetAllCompleted}
            className="collection-viewer-button secondary"
          >
            Reset All Completed
          </button>
        </div>

        {/* Last Read Indicator */}
        {lastReadEntry && (
          <div className="last-read-indicator">
            <span className="last-read-label">Last Read:</span>
            <span className="last-read-title">{lastReadEntry.NAME}</span>
          </div>
        )}

        {/* Collection Entries */}
        <div className="collection-entries">
          <h3>Collection Entries</h3>
          <div className="entries-list">
            {members.map((member, index) => (
              <div
                key={member.ID}
                ref={el => itemRefs.current[index + 2] = el}
                className={`collection-entry ${member.ID === collection?.LAST_OPENED_ID ? 'last-read' : ''} ${member.IS_COMPLETED === 1 ? 'completed' : ''} ${focusedIndex === index + 2 ? 'focused' : ''}`}
                onClick={() => handleEntryClick(member)}
                onContextMenu={(e) => handleEntryRightClick(e, member)}
              >
                <div className="entry-number">{index + 1}</div>
                <div className="entry-info">
                  <div className="entry-name">{member.NAME}</div>
                  <div className="entry-details">
                    {member.TYPE && <span className="entry-type">{member.TYPE}</span>}
                    {member.RATING > 0 && <span className="entry-rating">★ {member.RATING}</span>}
                  </div>
                </div>
                {member.ID === collection?.LAST_OPENED_ID && (
                  <div className="last-read-badge">Last Read</div>
                )}
                {member.IS_COMPLETED === 1 && (
                  <div className="completed-badge">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 9999
            }}
          >
            <div
              className="context-menu-item"
              onClick={() => handleMarkCompleted(contextMenu.member)}
            >
              Mark as Completed
            </div>
            <div
              className="context-menu-item"
              onClick={() => handleMarkNotCompleted(contextMenu.member)}
            >
              Mark as Not Completed
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CollectionViewer;
