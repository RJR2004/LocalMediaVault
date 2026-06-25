import React, { useState } from 'react';

/**
 * Refresh Library Modal Component
 * Provides unified interface for library refresh/sync operations
 */
const RefreshLibraryModal = ({ visible, onClose, onExecute, isExecuting }) => {
  const [syncIds, setSyncIds] = useState(true);
  const [refreshLibrary, setRefreshLibrary] = useState(true);
  const [thumbnailMode, setThumbnailMode] = useState('update'); // 'update', 'reset', or 'none'
  const [restartAfter, setRestartAfter] = useState(false);

  if (!visible) return null;

  const handleExecute = () => {
    const operations = [];
    
    if (syncIds) {
      operations.push('syncIds');
    }
    if (refreshLibrary) {
      operations.push('refreshLibrary');
    }
    if (thumbnailMode === 'update') {
      operations.push('updateThumbnailCache');
    } else if (thumbnailMode === 'reset') {
      operations.push('resetThumbnailCache');
    }

    onExecute(operations, restartAfter);
  };

  const handleThumbnailModeChange = (mode) => {
    setThumbnailMode(mode);
  };

  return (
    <div className="tag-manager-overlay">
      <div className="collection-and-tag-manager-dialog" style={{ maxWidth: '500px' }}>
        <div className="tag-manager-header">
          <h2>Refresh/Sync Library</h2>
          <button className="close-button" onClick={onClose} disabled={isExecuting}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <div className="refresh-options">
            {/* Sync IDs Option */}
            <div className="refresh-option-item">
              <label className="refresh-option-label">
                <input
                  type="checkbox"
                  checked={syncIds}
                  onChange={(e) => setSyncIds(e.target.checked)}
                  disabled={isExecuting}
                />
                <span>Create/Sync Library IDs</span>
              </label>
              <div className="refresh-option-description">
                Creates .per_id files in folders missing them (up to depth 2)
              </div>
            </div>

            {/* Refresh Library Option */}
            <div className="refresh-option-item">
              <label className="refresh-option-label">
                <input
                  type="checkbox"
                  checked={refreshLibrary}
                  onChange={(e) => setRefreshLibrary(e.target.checked)}
                  disabled={isExecuting}
                />
                <span>Refresh Library</span>
              </label>
              <div className="refresh-option-description">
                Scans filesystem and updates database with new/changed entries
              </div>
            </div>

            {/* Thumbnail Options */}
            <div className="refresh-option-item">
              <div className="refresh-option-title">Thumbnail Cache</div>
              <div className="refresh-thumbnail-options">
                <label className="refresh-option-label">
                  <input
                    type="radio"
                    name="thumbnailMode"
                    value="update"
                    checked={thumbnailMode === 'update'}
                    onChange={() => handleThumbnailModeChange('update')}
                    disabled={isExecuting}
                  />
                  <span>Update Thumbnail Cache</span>
                </label>
                <div className="refresh-option-description">
                  Generates thumbnails only for unprocessed entries
                </div>

                <label className="refresh-option-label">
                  <input
                    type="radio"
                    name="thumbnailMode"
                    value="reset"
                    checked={thumbnailMode === 'reset'}
                    onChange={() => handleThumbnailModeChange('reset')}
                    disabled={isExecuting}
                  />
                  <span>Reset Thumbnail Cache</span>
                </label>
                <div className="refresh-option-description">
                  Deletes all thumbnails and regenerates them from scratch
                  CAN TAKE A WHILE IF MANY ENTRIES
                </div>

                <label className="refresh-option-label">
                  <input
                    type="radio"
                    name="thumbnailMode"
                    value="none"
                    checked={thumbnailMode === 'none'}
                    onChange={() => handleThumbnailModeChange('none')}
                    disabled={isExecuting}
                  />
                  <span>Skip Thumbnails</span>
                </label>
              </div>
              {(thumbnailMode === 'update' || thumbnailMode === 'reset') && (
                <div className="refresh-warning">
                  ⚠️ App might need to be restarted for thumbnails to show up properly
                </div>
              )}
            </div>

            {/* Restart Option */}
            <div className="refresh-option-item">
              <label className="refresh-option-label">
                <input
                  type="checkbox"
                  checked={restartAfter}
                  onChange={(e) => setRestartAfter(e.target.checked)}
                  disabled={isExecuting}
                />
                <span>Restart app after operations complete</span>
              </label>
            </div>
          </div>
        </div>

        <div className="tag-manager-footer">
          <button 
            onClick={handleExecute} 
            className="close-dialog-button"
            disabled={isExecuting || (!syncIds && !refreshLibrary && thumbnailMode === 'none')}
            style={{ marginRight: '10px' }}
          >
            {isExecuting ? 'Running...' : 'Execute'}
          </button>
          <button 
            onClick={onClose} 
            className="close-dialog-button"
            disabled={isExecuting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefreshLibraryModal;
