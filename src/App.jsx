import React, { useEffect, useState, useRef } from 'react';

import './App.css';
import { applyTheme } from './systems/UISystem';

import ControlBar from './systems/UISystem/ControlBar.jsx';
import MediaGrid from './systems/UISystem/MediaGrid.jsx';

import ContextMenu from './systems/UISystem/ContextMenu.jsx';
import TagManager from './systems/UISystem/TagManager.jsx';

import CollectionManager from './systems/UISystem/CollectionManager.jsx';
import CollectionViewer from './systems/UISystem/CollectionViewer.jsx';

import CollectionEditor from './systems/UISystem/CollectionEditor.jsx';
import RefreshLibraryModal from './systems/UISystem/RefreshLibraryModal.jsx';

import LibraryTabs from './systems/UISystem/LibraryTabs.jsx';

import * as SearchEngine from './systems/SearchEngine';

function App() {
  const [showMenu, setShowMenu] = useState(false);
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  const [isRefreshingLibrary, setIsRefreshingLibrary] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingCache, setIsUpdatingCache] = useState(false);

  const [isResettingCache, setIsResettingCache] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);

  const [cacheProgress, setCacheProgress] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const [config, setConfig] = useState(null);
  const [showLibraryTabs, setShowLibraryTabs] = useState(true);

  const [showAddLibraryDialog, setShowAddLibraryDialog] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');

  const [showRemoveLibraryDialog, setShowRemoveLibraryDialog] = useState(false);
  const [libraryToRemove, setLibraryToRemove] = useState(null);

  const [deleteUserData, setDeleteUserData] = useState(false);
  const [showRenameLibraryDialog, setShowRenameLibraryDialog] = useState(false);

  const [libraryToRename, setLibraryToRename] = useState(null);
  const [renameLibraryName, setRenameLibraryName] = useState('');

  const settingsMenuRef = useRef(null);
  const [openSubmenu, setOpenSubmenu] = useState(null); // 'sort', 'itemsPerPage', 'viewerMode', or null
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, right: 0 });
  const sortMenuRef = useRef(null);
  const itemsPerPageMenuRef = useRef(null);
  const viewerModeMenuRef = useRef(null);
  const sortTriggerRef = useRef(null);
  const itemsPerPageTriggerRef = useRef(null);
  const viewerModeTriggerRef = useRef(null);
  const mediaGridTriggerRef = useRef(null);
  const mediaGridMenuRef = useRef(null);

  // Library & grid state

  const [libraryData, setLibraryData] = useState({ entries: [], collections: [] });
  const [searchQuery, setSearchQuery] = useState('');

  const [tagQuery, setTagQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState(['standalone', 'collections', 'series']);

  const [pageNum, setPageNum] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [externalFocusedIndex, setExternalFocusedIndex] = useState(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });

  // Tag manager state
  const [showTagManager, setShowTagManager] = useState(false);

  // Collection manager state
  const [showCollectionManager, setShowCollectionManager] = useState(false);

  // Collection viewing state
  const [showCollectionViewer, setShowCollectionViewer] = useState(false);

  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [showCollectionEditor, setShowCollectionEditor] = useState(false);

  // Refs for collection viewer state (to use in IPC callbacks)

  const showCollectionViewerRef = useRef(showCollectionViewer);
  const selectedCollectionIdRef = useRef(selectedCollectionId);

  // Update refs when state changes
  useEffect(() => {
    showCollectionViewerRef.current = showCollectionViewer;
  }, [showCollectionViewer]);

  useEffect(() => {
    selectedCollectionIdRef.current = selectedCollectionId;
  }, [selectedCollectionId]);

  // Filtered results state

  const [filteredResults, setFilteredResults] = useState([]);

  // Viewer state
  const [viewerState, setViewerState] = useState(null);

  //viewer mode

  const [viewerMode, setViewerMode] = useState('singlepage');

  // Webtoon viewer scroll settings
  const [scrollTimeMs, setScrollTimeMs] = useState(300);

  const [scrollDistanceMultiplier, setScrollDistanceMultiplier] = useState(0.5);

  // Media grid display settings
  const [showGridCaptions, setShowGridCaptions] = useState(true);

  const [showGridRatings, setShowGridRatings] = useState(false);

  const [showPageCount, setShowPageCount] = useState(false);

  const [showEntryCount, setShowEntryCount] = useState(false);

  useEffect(() => {
    startUp();

    // Set up sync progress listener
    window.electronAPI.onSyncProgress((progress) => {
      setSyncProgress(progress);
    });

    // Set up cache progress listener

    window.electronAPI.onCacheProgress((progress) => {

      setCacheProgress(progress);

    });

    // Set up viewer IPC listeners
    window.electronAPI.onViewerClosed(() => {
      setViewerState(null);

      // Close and reopen collection viewer to refresh it
      console.log('Viewer closed, showCollectionViewerRef.current:', showCollectionViewerRef.current, 'selectedCollectionIdRef.current:', selectedCollectionIdRef.current);

      if (showCollectionViewerRef.current && selectedCollectionIdRef.current) {

        console.log('Closing and reopening collection viewer');

        setShowCollectionViewer(false);

        setTimeout(() => setShowCollectionViewer(true), 50);
      }
    });

    window.electronAPI.onViewerStateUpdate((state) => {

      // Sync with main app if needed

      console.log('Viewer state update:', state);

    });

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeSyncProgressListener();
      window.electronAPI.removeCacheProgressListener();
      window.electronAPI.removeViewerClosedListener();
      window.electronAPI.removeViewerStateUpdateListener();
    };

  }, []);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowMenu(false);
        setOpenSubmenu(null);
      }
    };

    if (showMenu) {

      document.addEventListener('mousedown', handleClickOutside);

      return () => document.removeEventListener('mousedown', handleClickOutside);

    }

  }, [showMenu]);

  // ESC key handler for closing menus
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (openSubmenu) {
          setOpenSubmenu(null);
        } else if (showMenu) {
          setShowMenu(false);
        }
      }
    };

    if (showMenu || openSubmenu) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showMenu, openSubmenu]);

  // Calculate submenu position when opening
  const handleSubmenuOpen = (submenuType, triggerRef) => {
    if (openSubmenu === submenuType) {
      setOpenSubmenu(null);
    } else {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setSubmenuPosition({
          top: rect.top,
          right: window.innerWidth - rect.left
        });
      }
      setOpenSubmenu(submenuType);
    }
  };

  // Apply search and filters whenever search/filter state changes
  useEffect(() => {
    applySearchAndFilters();
  }, [libraryData, searchQuery, tagQuery, selectedFilters, sortBy, sortOrder]);

  // Reset to page 1 when filters or items per page change
  useEffect(() => {
    setPageNum(1);
  }, [searchQuery, tagQuery, selectedFilters, sortBy, sortOrder, itemsPerPage]);

  // Calculate paginated items
  const paginatedItems = filteredResults.slice(
    (pageNum - 1) * itemsPerPage,
    pageNum * itemsPerPage
  );

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);

  // Helper function to save config changes
  const saveConfig = async (configUpdates) => {
    try {
      await window.electronAPI.updateConfig(configUpdates);
      console.log('Config saved:', configUpdates);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  async function startUp() {
    console.log("Starting up...");
    const startupConfig = await window.electronAPI.getConfig();
    setConfig(startupConfig);

    if(startupConfig.sortOrder){
      setSortOrder(startupConfig.sortOrder);
    }

    if(startupConfig.sortBy){

      setSortBy(startupConfig.sortBy);

    }

    if(startupConfig.itemsPerPage){

      setItemsPerPage(startupConfig.itemsPerPage);

    }

    if(startupConfig.viewerMode){

      setViewerMode(startupConfig.viewerMode);

    }

    if(startupConfig.filters){
      setSelectedFilters(startupConfig.filters);
    }

    if(startupConfig.scrollTimeMs){

      setScrollTimeMs(startupConfig.scrollTimeMs);

    }

    if(startupConfig.scrollDistanceMultiplier){
      setScrollDistanceMultiplier(startupConfig.scrollDistanceMultiplier);
    }

    if(startupConfig.showGridCaptions !== undefined){
      setShowGridCaptions(startupConfig.showGridCaptions);
    }

    if(startupConfig.showGridRatings !== undefined){
      setShowGridRatings(startupConfig.showGridRatings);
    }

    if(startupConfig.showPageCount !== undefined){
      setShowPageCount(startupConfig.showPageCount);
    }

    if(startupConfig.showEntryCount !== undefined){
      setShowEntryCount(startupConfig.showEntryCount);
    }

    await applyTheme();

    await loadLibraryData();

  }

  async function loadLibraryData() {
    try {
      const data = await window.electronAPI.getLibrarySnapshot();

      if (data) {

        // Load collections with members to attach to entries

        let collectionsWithMembers = [];
        try {
          const collectionsResult = await window.electronAPI.getCollectionsWithMembers();
          collectionsWithMembers = collectionsResult.success ? collectionsResult.data : [];

        } catch (collectionsError) {

          console.warn('Failed to load collections with members, using empty array:', collectionsError);

          collectionsWithMembers = data.collections || [];

        }

        

        // Attach collection info to entries for series search

        const entriesWithCollections = data.entries.map(entry => ({

          ...entry,

          collections: Array.isArray(collectionsWithMembers) 

            ? collectionsWithMembers

                .filter(collection => 

                  collection.members && Array.isArray(collection.members) && 

                  collection.members.some(member => member.ID === entry.ID)

                )

                .map(collection => ({

                  id: collection.ID,

                  name: collection.NAME

                }))

            : []

        }));

        

        setLibraryData({ 

          entries: entriesWithCollections, 

          collections: Array.isArray(collectionsWithMembers) ? collectionsWithMembers : []

        });

        // Don't set displayItems here - let applySearchAndFilters handle it

      }

    } catch (error) {

      console.error('Error loading library snapshot:', error);

      // Set empty data to prevent blank screen

      setLibraryData({ entries: [], collections: [] });

    }

  }

  function applySearchAndFilters() {

  if (!libraryData.entries && !libraryData.collections) {

    setFilteredResults([]);

    return;

  }

  try {

    const allEntries = [

      ...(libraryData.entries || []).map(e => ({ ...e, itemType: 'entry' })),

      ...(libraryData.collections || []).map(c => ({ ...c, itemType: 'collection' }))

    ];

    // --- PHASE 1: NAME FILTERING ---

    const nameQuery = searchQuery.trim().toLowerCase();

    let nameFilteredResults = allEntries;

    if (nameQuery) {

      nameFilteredResults = allEntries.filter(item => {

        const itemName = (item.name || item.NAME || '').toLowerCase();

        return itemName.includes(nameQuery);

      });

    }

    // --- PHASE 2: CATEGORY & TAG FILTERING ---

    const currentTagQuery = tagQuery.trim();

    let contentTypes = (selectedFilters.includes('all') || selectedFilters.length === 0) 

      ? ['all'] 

      : selectedFilters;

    let finalResults = [];

    if (contentTypes.includes('all')) {

      const searchResult = SearchEngine.execute(currentTagQuery, nameFilteredResults, {

        contentType: 'all',

        collections: libraryData.collections || [],

        sortBy: sortBy,

        sortOrder: sortOrder,

        searchNames: false

      });

      finalResults = searchResult.entries || [];

    } else {

      // Use the OLD logic here: Loop through every selected filter

      const resultSet = new Set();

      for (const contentType of contentTypes) {

        const searchResult = SearchEngine.execute(currentTagQuery, nameFilteredResults, {

          contentType: contentType,

          collections: libraryData.collections || [],

          sortBy: sortBy,

          sortOrder: sortOrder,

          searchNames: false

        });

        (searchResult.entries || []).forEach(entry => resultSet.add(JSON.stringify(entry)));

      }
      const combined = Array.from(resultSet).map(s => JSON.parse(s));
      // Final Sort to align everything
      const finalSort = SearchEngine.execute('', combined, {
        contentType: 'all',
        collections: libraryData.collections || [],
        sortBy: sortBy,
        sortOrder: sortOrder,
        searchNames: false
      });
      finalResults = finalSort.entries || [];
    }
    setFilteredResults(finalResults);
  } catch (error) {
    console.error('Error applying search and filters:', error);
    setFilteredResults([]);
  }

}


  // Context menu handlers
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item: item
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, item: null });
  };

  // Hide context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleSyncLibraryIds = async () => {
    setShowMenu(false);
    setIsSyncing(true);
    try {
      // Get current active library path
      const activePath = await window.electronAPI.getActiveLibraryPath();
      if (!activePath) {
        setToast({
          show: true,
          message: 'No library directory configured',
          type: 'error'
        });
        setIsSyncing(false);
        return;
      }
      const result = await window.electronAPI.repairLibraryIds(activePath);
      if (result.success) {
        setToast({
          show: true,
          message: `Successfully synced library IDs. Created ${result.created} new IDs.`,
          type: 'success'
        });
        // Refetch library data after successful ID sync
        await loadLibraryData();
      } else {
        setToast({
          show: true,
          message: `Error syncing library IDs: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error syncing library IDs:', error);
      setToast({
        show: true,
        message: 'Failed to sync library IDs',
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshLibrary = async () => {
    setShowMenu(false);
    setIsRefreshing(true);
    setSyncProgress(null);
    try {
      // Get current active library path
      const activePath = await window.electronAPI.getActiveLibraryPath();
      if (!activePath) {
        setToast({
          show: true,
          message: 'No library directory configured',
          type: 'error'
        });
        setIsRefreshing(false);
        return;
      }
      const result = await window.electronAPI.syncLibrary(activePath);
      if (result.success) {
        setToast({
          show: true,
          message: `Successfully refreshed library. Processed ${result.processed} folders.`,
          type: 'success'
        });
        // Refetch library data after successful sync
        await loadLibraryData();
      } else {
        setToast({
          show: true,
          message: `Error refreshing library: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error refreshing library:', error);
      setToast({
        show: true,
        message: 'Failed to refresh library',
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
      setSyncProgress(null);
    }
  };

  const handleUpdateThumbnailCache = async () => {
    setShowMenu(false);
    setIsUpdatingCache(true);
    setCacheProgress(null);
    try {
      const result = await window.electronAPI.updateThumbnailCache();
      if (result.success) {
        setToast({
          show: true,
          message: `Successfully updated thumbnail cache. Processed ${result.processed} images.`,
          type: 'success'
        });
      } else {
        setToast({
          show: true,
          message: `Error updating thumbnail cache: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating thumbnail cache:', error);
      setToast({
        show: true,
        message: 'Failed to update thumbnail cache',
        type: 'error'
      });
    } finally {
      setIsUpdatingCache(false);
      setCacheProgress(null);
    }

  };

  const handleResetThumbnailCache = async () => {
    setShowMenu(false);
    setIsResettingCache(true);
    setCacheProgress(null);
    try {
      const result = await window.electronAPI.resetThumbnailCache();
      if (result.success) {
        setToast({
          show: true,
          message: `Successfully reset and regenerated thumbnail cache. Processed ${result.processed} images.`,
          type: 'success'
        });
      } else {
        setToast({
          show: true,
          message: `Error resetting thumbnail cache: ${result.error}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error resetting thumbnail cache:', error);
      setToast({
        show: true,
        message: 'Failed to reset thumbnail cache',
        type: 'error'
      });
    } finally {
      setIsResettingCache(false);
      setCacheProgress(null);
    }

  };

  // Unified refresh handler - executes selected operations in order
  const handleExecuteRefresh = async (operations, restartAfter) => {
    setShowRefreshModal(false);
    setIsRefreshingLibrary(true);
    setSyncProgress(null);
    setCacheProgress(null);

    const results = [];

    try {
      // Get current active library path
      const activePath = await window.electronAPI.getActiveLibraryPath();
      if (!activePath) {
        setToast({
          show: true,
          message: 'No library directory configured',
          type: 'error'
        });
        setIsRefreshingLibrary(false);
        return;
      }

      // Execute operations in fixed order
      for (const operation of operations) {
        if (operation === 'syncIds') {
          setIsSyncing(true);
          try {
            const result = await window.electronAPI.repairLibraryIds(activePath);
            results.push({ operation, success: result.success, data: result });
            if (!result.success) {
              console.error(`Sync IDs failed:`, result.error);
            }
          } catch (error) {
            console.error('Error syncing library IDs:', error);
            results.push({ operation, success: false, error: error.message });
          } finally {
            setIsSyncing(false);
          }
        } else if (operation === 'refreshLibrary') {
          setIsRefreshing(true);
          try {
            const result = await window.electronAPI.syncLibrary(activePath);
            results.push({ operation, success: result.success, data: result });
            if (!result.success) {
              console.error(`Refresh library failed:`, result.error);
            }
          } catch (error) {
            console.error('Error refreshing library:', error);
            results.push({ operation, success: false, error: error.message });
          } finally {
            setIsRefreshing(false);
          }
        } else if (operation === 'updateThumbnailCache') {
          setIsUpdatingCache(true);
          try {
            const result = await window.electronAPI.updateThumbnailCache();
            results.push({ operation, success: result.success, data: result });
            if (!result.success) {
              console.error(`Update thumbnail cache failed:`, result.error);
            }
          } catch (error) {
            console.error('Error updating thumbnail cache:', error);
            results.push({ operation, success: false, error: error.message });
          } finally {
            setIsUpdatingCache(false);
          }
        } else if (operation === 'resetThumbnailCache') {
          setIsResettingCache(true);
          try {
            const result = await window.electronAPI.resetThumbnailCache();
            results.push({ operation, success: result.success, data: result });
            if (!result.success) {
              console.error(`Reset thumbnail cache failed:`, result.error);
            }
          } catch (error) {
            console.error('Error resetting thumbnail cache:', error);
            results.push({ operation, success: false, error: error.message });
          } finally {
            setIsResettingCache(false);
          }
        }
      }

      // Show summary toast
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount === 0) {
        setToast({
          show: true,
          message: `Successfully completed ${successCount} operation(s)`,
          type: 'success'
        });
      } else if (successCount === 0) {
        setToast({
          show: true,
          message: `All ${failCount} operation(s) failed. Check console for details.`,
          type: 'error'
        });
      } else {
        setToast({
          show: true,
          message: `Completed ${successCount} operation(s), ${failCount} failed. Check console for details.`,
          type: 'warning'
        });
      }

      // Refetch library data if any operation succeeded
      if (successCount > 0) {
        await loadLibraryData();
      }

      // Restart app if requested
      if (restartAfter && successCount > 0) {
        setToast({
          show: true,
          message: 'Restarting app...',
          type: 'success'
        });
        setTimeout(() => {
          window.electronAPI.restartApp();
        }, 1000);
      }

    } catch (error) {
      console.error('Error in refresh operations:', error);
      setToast({
        show: true,
        message: 'Failed to complete refresh operations',
        type: 'error'
      });
    } finally {
      setIsRefreshingLibrary(false);
      setSyncProgress(null);
      setCacheProgress(null);
    }
  };

  // Viewer launch function

  const openViewer = async (mediaId, mode = viewerMode, collectionId = null) => {

    console.log('🚀 App: openViewer called with mediaId:', mediaId, 'mode:', mode, 'collectionId:', collectionId);

    console.log('🚀 App: window.electronAPI exists:', !!window.electronAPI);

    console.log('🚀 App: window.electronAPI.openViewer type:', typeof window.electronAPI.openViewer);

    try {

      console.log('🚀 App: Calling window.electronAPI.openViewer...');

      const result = await window.electronAPI.openViewer(mediaId, mode, collectionId);

      console.log('🚀 App: openViewer result:', result);

      if (result.success) {

        setViewerState({ isOpen: true, mediaId, mode, collectionId });

        console.log('✅ App: Viewer opened successfully');

      } else {

        console.error('❌ App: Viewer failed to open:', result.error);

        setToast({

          show: true,

          message: `Failed to open viewer: ${result.error || 'Unknown error'}`,

          type: 'error'

        });

      }

    } catch (error) {

      console.error('💥 App: Exception in openViewer:', error);

      setToast({

        show: true,

        message: 'Failed to open viewer',

        type: 'error'

      });

    }

  };

  const hideToast = () => {

    setToast({ show: false, message: '', type: '' });

  };

  // ControlBar handlers

  const handleClearFilters = () => {

    setSearchQuery('');

    setTagQuery('');

    setPageNum(1);

    // Don't manually set displayItems - let applySearchAndFilters handle it

  };

  const handleFiltersChange = (newFilters) => {

    setSelectedFilters(newFilters);

    saveConfig({ filters: newFilters });

  };

  const handleRandom = () => {

    if (filteredResults.length === 0) return;

    const randomIndex = Math.floor(Math.random() * filteredResults.length);

    const randomItem = filteredResults[randomIndex];

    console.log('Random item selected:', randomItem);

    

    // Calculate which page the random item is on

    const targetPage = Math.floor(randomIndex / itemsPerPage) + 1;

    const indexInPage = randomIndex % itemsPerPage;

    console.log('Random item at index:', randomIndex, 'target page:', targetPage, 'index in page:', indexInPage);

    

    // Change to the target page

    setPageNum(targetPage);

    

    // Set the focused index after page change (small delay to ensure paginatedItems updates)

    setTimeout(() => {

      setExternalFocusedIndex(indexInPage);

      

      // Reset externalFocusedIndex after it's been applied (so it doesn't interfere with future navigation)

      setTimeout(() => {

        setExternalFocusedIndex(null);

      }, 200);

    }, 100);

    

    // Open viewer for random item if it's an entry

    const isImage = randomItem.TYPE === 'image' || randomItem.type === 'image';

    if (randomItem.itemType === 'entry' && isImage) {

      openViewer(randomItem.ID, viewerMode);

    } else {

      setToast({

        show: true,

        message: 'Random selection is not an image file',

        type: 'info'

      });

    }

  };

  const handleSettingsClick = () => {

    setShowMenu(!showMenu);

  };

  // Collection viewing handlers

  const handleOpenCollection = (collectionId) => {

    setSelectedCollectionId(collectionId);

    setShowCollectionViewer(true);

  };

  const handleCloseCollectionViewer = () => {

    setShowCollectionViewer(false);

    setSelectedCollectionId(null);

  };

  const handleContinueReading = async (entryId) => {

    // Update collection's LAST_OPENED_ID

    try {

      const result = await window.electronAPI.updateCollectionLastOpened(selectedCollectionId, entryId);

      if (result.success) {

        console.log('Updated collection LAST_OPENED_ID to:', entryId);

      } else {

        console.error('Failed to update collection LAST_OPENED_ID:', result.error);

      }

    } catch (error) {

      console.error('Error updating collection LAST_OPENED_ID:', error);

    }

    openViewer(entryId, viewerMode, selectedCollectionId);

  };

  const handleOpenCollectionEditor = (collectionId) => {

    setSelectedCollectionId(collectionId);

    setShowCollectionEditor(true);

    setShowCollectionViewer(false);

  };

  const handleCloseCollectionEditor = () => {

    setShowCollectionEditor(false);

    setShowCollectionViewer(true);

  };

  const handleSyncClick = () => {

    handleRefreshLibrary();

  };

  const handlePrevPage = () => {

    setPageNum((p) => Math.max(1, p - 1));

  };

  const handleNextPage = () => {

    setPageNum((p) => Math.min(totalPages, p + 1));

  };

  const handleManageTags = () => {

    setShowTagManager(true);

  };

  const handleCloseTagManager = () => {

    setShowTagManager(false);

    // Optionally refresh library data to show any changes

    loadLibraryData();

  };

  const handleManageCollections = () => {

    setShowCollectionManager(true);

  };

  const handleCloseCollectionManager = () => {

    setShowCollectionManager(false);

    // Refresh library data to show any collection changes

    loadLibraryData();

  };

  const handleAddLibraryFromMenu = () => {

    setShowMenu(false);

    setShowAddLibraryDialog(true);

    setNewLibraryName('');

  };

  const handleAddLibraryConfirm = async () => {

    if (!newLibraryName.trim()) {

      alert('Please enter a library name');

      return;

    }

    setShowAddLibraryDialog(false);

    try {

      // Open directory picker

      const result = await window.electronAPI.selectDirectory();

      if (result.success && result.path) {

        // Add library to config

        const addResult = await window.electronAPI.addLibrary(newLibraryName.trim(), result.path);

        if (addResult.success) {

          // Switch to the new library

          await window.electronAPI.switchLibraryTab(addResult.libraryId);

          setToast({

            show: true,

            message: 'Library added successfully',

            type: 'success'

          });

        } else {

          alert(`Failed to add library: ${addResult.error}`);

        }

      }

    } catch (error) {

      console.error('Error adding library:', error);

      alert('Failed to add library');

    }

  };

  const handleAddLibraryCancel = () => {

    setShowAddLibraryDialog(false);

    setNewLibraryName('');

  };

  const handleRemoveLibrary = (libraryId) => {

    if (!config || !config.libraries) return;

    const library = config.libraries.find(lib => lib.id === libraryId);

    if (library) {

      setLibraryToRemove(library);

      setShowRemoveLibraryDialog(true);

      setDeleteUserData(false);

    }

  };

  const handleRemoveLibraryConfirm = async () => {

    if (!libraryToRemove) return;

    try {

      const result = await window.electronAPI.removeLibrary(libraryToRemove.id, deleteUserData);

      if (result.success) {

        setToast({

          show: true,

          message: deleteUserData ? 'Library and userdata removed' : 'Library removed',

          type: 'success'

        });

      } else {

        alert(`Failed to remove library: ${result.error}`);

      }

    } catch (error) {

      console.error('Error removing library:', error);

      alert('Failed to remove library');

    } finally {

      setShowRemoveLibraryDialog(false);

      setLibraryToRemove(null);

      setDeleteUserData(false);

    }

  };

  const handleRemoveLibraryCancel = () => {

    setShowRemoveLibraryDialog(false);

    setLibraryToRemove(null);

    setDeleteUserData(false);

  };

  const handleRenameLibrary = (libraryId) => {

    if (!config || !config.libraries) return;

    const library = config.libraries.find(lib => lib.id === libraryId);

    if (library) {

      setLibraryToRename(library);

      setRenameLibraryName(library.name);

      setShowRenameLibraryDialog(true);

    }

  };

  const handleRenameLibraryConfirm = async () => {

    if (!libraryToRename || !renameLibraryName.trim()) return;

    try {

      const result = await window.electronAPI.renameLibrary(libraryToRename.id, renameLibraryName.trim());

      if (result.success) {

        setToast({

          show: true,

          message: 'Library renamed successfully',

          type: 'success'

        });

      } else {

        alert(`Failed to rename library: ${result.error}`);

      }

    } catch (error) {

      console.error('Error renaming library:', error);

      alert('Failed to rename library');

    } finally {

      setShowRenameLibraryDialog(false);

      setLibraryToRename(null);

      setRenameLibraryName('');

    }

  };

  const handleRenameLibraryCancel = () => {

    setShowRenameLibraryDialog(false);

    setLibraryToRename(null);

    setRenameLibraryName('');

  };

  return (

    <div className={`App ${showLibraryTabs ? 'with-library-tabs' : ''}`}>

      {showLibraryTabs && <LibraryTabs config={config} onRemoveLibrary={handleRemoveLibrary} onRenameLibrary={handleRenameLibrary} />}

      <ControlBar

        searchQuery={searchQuery}

        onSearchChange={setSearchQuery}

        tagQuery={tagQuery}

        onTagChange={setTagQuery}

        selectedFilters={selectedFilters}

        onFiltersChange={handleFiltersChange}

        onClearFilters={handleClearFilters}

        onRandom={handleRandom}

        onSettingsClick={handleSettingsClick}

        onSyncClick={handleSyncClick}

        onManageTags={handleManageTags}

        onManageCollections={handleManageCollections}

        pageNum={pageNum}

        onPrevPage={handlePrevPage}

        onNextPage={handleNextPage}

        totalPages={totalPages}

        isSyncing={isSyncing}

        isRefreshing={isRefreshing}

        showLibraryTabs={showLibraryTabs}

        onToggleLibraryTabs={() => setShowLibraryTabs(!showLibraryTabs)}

      />

      <main className="app-main">

        <MediaGrid

          items={paginatedItems}

          onContextMenu={handleContextMenu}

          onOpenViewer={openViewer}

          onOpenCollection={handleOpenCollection}

          totalCount={filteredResults.length}

          currentPage={pageNum}

          itemsPerPage={itemsPerPage}

          viewerMode={viewerMode}

          disableKeyboardNav={showCollectionViewer}

          onPageChange={setPageNum}

          showCaptions={showGridCaptions}

          showRatings={showGridRatings}

          showPageCount={showPageCount}

          showEntryCount={showEntryCount}

          externalFocusedIndex={externalFocusedIndex}

        />

      </main>

      {/* Context Menu */}

      {contextMenu.visible && (

        <ContextMenu

          visible={contextMenu.visible}

          x={contextMenu.x}

          y={contextMenu.y}

          targetEntry={contextMenu.item?.itemType === 'entry' ? contextMenu.item : null}

          targetCollection={contextMenu.item?.itemType === 'collection' ? contextMenu.item : null}

          onClose={closeContextMenu}

          onUpdate={() => {

            console.log('ContextMenu: Updating data after operation');

            loadLibraryData(); // Refresh the library data

          }}

        />

      )}

      {/* Tag Manager */}

      <TagManager

        visible={showTagManager}

        onClose={handleCloseTagManager}

      />

      {/* Collection Manager */}

      <CollectionManager

        visible={showCollectionManager}

        onClose={handleCloseCollectionManager}

        onUpdate={loadLibraryData}

      />

      {/* Collection Viewer */}

      {showCollectionViewer && (

        <CollectionViewer

          collectionId={selectedCollectionId}

          onClose={handleCloseCollectionViewer}

          onContinueReading={handleContinueReading}

          onEditCollection={handleOpenCollectionEditor}

        />

      )}

      {/* Collection Editor */}

      {showCollectionEditor && (

        <CollectionEditor

          collectionId={selectedCollectionId}

          onClose={handleCloseCollectionEditor}

          onSave={loadLibraryData}

        />

      )}

      {/* Settings Dropdown Menu */}

      {showMenu && (

        <div className="dropdown-menu settings-dropdown" ref={settingsMenuRef}>

          <button

            className="menu-item"

            onClick={() => setShowRefreshModal(true)}

            disabled={isRefreshingLibrary}

          >

            {isRefreshingLibrary ? 'Refreshing...' : 'Refresh/Sync Library'}

          </button>

          <button

            className="menu-item"

            onClick={handleAddLibraryFromMenu}

          >

            Add New Library

          </button>

          {/* Sorting Options */}

          <div className="menu-separator"></div>

          <button
            className="menu-item submenu-trigger"
            ref={sortTriggerRef}
            onClick={() => handleSubmenuOpen('sort', sortTriggerRef)}
          >
            Sort By {openSubmenu === 'sort' ? '▴' : '▾'}
          </button>

          {openSubmenu === 'sort' && (
            <div 
              className="submenu" 
              ref={sortMenuRef}
              style={{ top: `${submenuPosition.top}px`, right: `${submenuPosition.right}px` }}
            >
                <button
                  className={`menu-item ${sortBy === 'name' && sortOrder === 'asc' ? 'selected' : ''}`}
                  onClick={() => { setSortBy('name'); setSortOrder('asc'); saveConfig({ sortBy: 'name', sortOrder: 'asc' }); }}
                >
                  Name A→Z
                </button>
                <button
                  className={`menu-item ${sortBy === 'name' && sortOrder === 'desc' ? 'selected' : ''}`}
                  onClick={() => { setSortBy('name'); setSortOrder('desc'); saveConfig({ sortBy: 'name', sortOrder: 'desc' }); }}
                >
                  Name Z→A
                </button>
                <button
                  className={`menu-item ${sortBy === 'rating' && sortOrder === 'asc' ? 'selected' : ''}`}
                  onClick={() => { setSortBy('rating'); setSortOrder('asc'); saveConfig({ sortBy: 'rating', sortOrder: 'asc' }); }}
                >
                  Rating Low→High
                </button>
                <button
                  className={`menu-item ${sortBy === 'rating' && sortOrder === 'desc' ? 'selected' : ''}`}
                  onClick={() => { setSortBy('rating'); setSortOrder('desc'); saveConfig({ sortBy: 'rating', sortOrder: 'desc' }); }}
                >
                  Rating High→Low
                </button>
              </div>
            )}

          {/* Items Per Page Options */}

          <div className="menu-separator"></div>

          <button
            className="menu-item submenu-trigger"
            ref={itemsPerPageTriggerRef}
            onClick={() => handleSubmenuOpen('itemsPerPage', itemsPerPageTriggerRef)}
          >
            Items Per Page {openSubmenu === 'itemsPerPage' ? '▴' : '▾'}
          </button>

          {openSubmenu === 'itemsPerPage' && (
            <div 
              className="submenu" 
              ref={itemsPerPageMenuRef}
              style={{ top: `${submenuPosition.top}px`, right: `${submenuPosition.right}px` }}
            >
                {[20, 50, 100, 200].map((count) => (
                  <button
                    key={count}
                    className={`menu-item ${itemsPerPage === count ? 'selected' : ''}`}
                    onClick={() => { setItemsPerPage(count); saveConfig({ itemsPerPage: count }); }}
                  >
                    {count} {itemsPerPage === count && '✓'}
                  </button>
                ))}
              </div>
            )}

          {/* Viewer Mode Options */}

          <div className="menu-separator"></div>

          <button
            className="menu-item submenu-trigger"
            ref={viewerModeTriggerRef}
            onClick={() => handleSubmenuOpen('viewerMode', viewerModeTriggerRef)}
          >
            Viewer Mode {openSubmenu === 'viewerMode' ? '▴' : '▾'}
          </button>

          {openSubmenu === 'viewerMode' && (
            <div 
              className="submenu" 
              ref={viewerModeMenuRef}
              style={{ top: `${submenuPosition.top}px`, right: `${submenuPosition.right}px` }}
            >
                <button
                  className={`menu-item ${viewerMode === 'singlepage' ? 'selected' : ''}`}
                  onClick={() => { setViewerMode('singlepage'); saveConfig({ viewerMode: 'singlepage' }); }}
                >
                  Single Page {viewerMode === 'singlepage' && '✓'}
                </button>
                <button
                  className={`menu-item ${viewerMode === 'manga' ? 'selected' : ''}`}
                  onClick={() => { setViewerMode('manga'); saveConfig({ viewerMode: 'manga' }); }}
                >
                  Manga {viewerMode === 'manga' && '✓'}
                </button>
                <button
                  className={`menu-item ${viewerMode === 'webtoon' ? 'selected' : ''}`}
                  onClick={() => { setViewerMode('webtoon'); saveConfig({ viewerMode: 'webtoon' }); }}
                >
                  Webtoon {viewerMode === 'webtoon' && '✓'}
                </button>
              </div>
            )}

          {/* Webtoon Scroll Settings */}

          <div className="menu-separator"></div>

          <div className="menu-section-title">Webtoon Scroll Settings</div>

          <div className="menu-item slider-control">

            <label>Scroll Time: {scrollTimeMs}ms</label>

            <input

              type="range"

              min="100"

              max="1000"

              step="1"

              value={scrollTimeMs}

              onChange={(e) => {

                const value = parseInt(e.target.value);

                setScrollTimeMs(value);

                saveConfig({ scrollTimeMs: value });

              }}

            />

          </div>

          <div className="menu-item slider-control">

            <label>Scroll Distance: {Math.round(scrollDistanceMultiplier * 100)}%</label>

            <input

              type="range"

              min="0.1"

              max="1.0"

              step="0.01"

              value={scrollDistanceMultiplier}

              onChange={(e) => {

                const value = parseFloat(e.target.value);

                setScrollDistanceMultiplier(value);

                saveConfig({ scrollDistanceMultiplier: value });

              }}

            />

          </div>

          {/* Media Grid Display Settings */}

          <div className="menu-separator"></div>

          <div className="menu-section-title">Media Grid Display</div>

          <button

            className={`menu-item ${showGridCaptions ? 'selected' : ''}`}

            onClick={() => { setShowGridCaptions(!showGridCaptions); saveConfig({ showGridCaptions: !showGridCaptions }); }}

          >

            Show Captions {showGridCaptions && '✓'}

          </button>

          <button

            className={`menu-item ${showGridRatings ? 'selected' : ''}`}

            onClick={() => { setShowGridRatings(!showGridRatings); saveConfig({ showGridRatings: !showGridRatings }); }}

          >

            Show Ratings on Thumbnails {showGridRatings && '✓'}

          </button>

          <button

            className={`menu-item ${showPageCount ? 'selected' : ''}`}

            onClick={() => { setShowPageCount(!showPageCount); saveConfig({ showPageCount: !showPageCount }); }}

          >

            Show Page Count (Entries) {showPageCount && '✓'}

          </button>

          <button

            className={`menu-item ${showEntryCount ? 'selected' : ''}`}

            onClick={() => { setShowEntryCount(!showEntryCount); saveConfig({ showEntryCount: !showEntryCount }); }}

          >

            Show Entry Count (Collections) {showEntryCount && '✓'}

          </button>

        </div>

      )}

      {/* Sync Progress Dialog */}

      {syncProgress && (

        <div className="progress-dialog-overlay">

          <div className="progress-dialog">

            <h3>Refreshing Library</h3>

            <div className="progress-info">

              <p>Processing: {syncProgress.current}</p>

              <p>Progress: {syncProgress.processed} / {syncProgress.total}</p>

              <div className="progress-bar">

                <div 

                  className="progress-fill" 

                  style={{ width: `${(syncProgress.processed / syncProgress.total) * 100}%` }}

                ></div>

              </div>

              {syncProgress.stats && (

                <div className="progress-stats">

                  <p>Standalone: {syncProgress.stats.standalone}</p>

                  <p>Collections: {syncProgress.stats.collections}</p>

                  {syncProgress.stats.errors > 0 && (

                    <p className="error-count">Errors: {syncProgress.stats.errors}</p>

                  )}

                </div>

              )}

            </div>

          </div>

        </div>

      )}

      {/* Cache Progress Dialog */}

      {cacheProgress && (

        <div className="progress-dialog-overlay">

          <div className="progress-dialog">

            <h3>Updating Thumbnail Cache</h3>

            <div className="progress-info">

              <p>Processing: {cacheProgress.currentItem}</p>

              <p>Progress: {cacheProgress.current} / {cacheProgress.total}</p>

              <div className="progress-bar">

                <div 

                  className="progress-fill" 

                  style={{ width: `${(cacheProgress.current / cacheProgress.total) * 100}%` }}

                ></div>

              </div>

              <p>Processed: {cacheProgress.processed} thumbnails</p>

            </div>

          </div>

        </div>

      )}

      {/* Refresh Library Modal */}
      <RefreshLibraryModal
        visible={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}

        onExecute={handleExecuteRefresh}
        isExecuting={isRefreshingLibrary}
      />

      {/* Add Library Dialog */}
      {showAddLibraryDialog && (
        <div className="library-dialog-overlay">
          <div className="library-dialog">
            <h3>Add New Library</h3>
            <input
              type="text"
              placeholder="Library Name"
              value={newLibraryName}
              onChange={(e) => setNewLibraryName(e.target.value)}
              autoFocus
            />
            <div className="library-dialog-buttons">
              <button onClick={handleAddLibraryCancel}>
                Cancel
              </button>
              <button
                onClick={handleAddLibraryConfirm}
                disabled={!newLibraryName.trim()}
              >
                Add Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Library Dialog */}
      {showRemoveLibraryDialog && libraryToRemove && (
        <div className="library-dialog-overlay">
          <div className="library-dialog">
            <h3>Remove Library</h3>
            <p>Are you sure you want to remove "{libraryToRemove.name}"?</p>
            <label className="library-dialog-checkbox">
              <input
                type="checkbox"
                checked={deleteUserData}
                onChange={(e) => setDeleteUserData(e.target.checked)}
              />
              Also delete thumbnail cache for this library
            </label>
            <div className="library-dialog-buttons">
              <button onClick={handleRemoveLibraryCancel}>
                Cancel
              </button>
              <button
                onClick={handleRemoveLibraryConfirm}
                className="danger-button"
              >
                Remove Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Library Dialog */}
      {showRenameLibraryDialog && libraryToRename && (
        <div className="library-dialog-overlay">
          <div className="library-dialog">
            <h3>Rename Library</h3>
            <input
              type="text"
              placeholder="Library Name"
              value={renameLibraryName}
              onChange={(e) => setRenameLibraryName(e.target.value)}
              autoFocus
            />
            <div className="library-dialog-buttons">
              <button onClick={handleRenameLibraryCancel}>
                Cancel
              </button>
              <button
                onClick={handleRenameLibraryConfirm}
                disabled={!renameLibraryName.trim()}
              >
                Rename Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast ${toast.type}`} onClick={hideToast}>
          {toast.message}
        </div>
      )}

    </div>

  );

}

export default App;

