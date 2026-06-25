import React, { useState, useEffect } from 'react';

import './LibraryTabs.css';

function LibraryTabs({ config, onLibrarySwitch, onRemoveLibrary, onRenameLibrary }) {
  const [libraries, setLibraries] = useState([]);
  const [activeLibraryId, setActiveLibraryId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    if (config) {
      setLibraries(config.libraries || []);
      setActiveLibraryId(config.activeLibraryId);
    }
  }, [config]);

  const handleTabClick = async (libraryId) => {
    if (libraryId === activeLibraryId) return;

    try {
      const result = await window.electronAPI.switchLibraryTab(libraryId);
      if (!result.success) {
        console.error('Failed to switch library:', result.error);
      }
    } catch (error) {
      console.error('Error switching library:', error);
    }
  };

  const handleRightClick = (e, library) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      library
    });
  };

  const handleContextMenuAction = async (action) => {
    if (!contextMenu) return;

    if (action === 'remove' && onRemoveLibrary) {
      onRemoveLibrary(contextMenu.library.id);
    } else if (action === 'rename' && onRenameLibrary) {
      onRenameLibrary(contextMenu.library.id);
    }

    setContextMenu(null);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  if (!libraries || libraries.length === 0) {
    return null;
  }

  return (
    <div className="library-tabs">
      <div className="library-tabs-container">
        {libraries.map((library) => (
          <button
            key={library.id}
            className={`library-tab ${library.id === activeLibraryId ? 'active' : ''}`}
            onClick={() => handleTabClick(library.id)}
            onContextMenu={(e) => handleRightClick(e, library)}
          >
            {library.name}
          </button>
        ))}
      </div>

      {contextMenu && (
        <div
          className="library-tab-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="context-menu-item" onClick={() => handleContextMenuAction('rename')}>
            Rename
          </div>
          {libraries.length > 1 && (
            <div className="context-menu-item context-menu-danger" onClick={() => handleContextMenuAction('remove')}>
              Remove
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LibraryTabs;
