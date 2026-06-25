import React from 'react';

/**
 * ControlBar - Fixed top navigation bar.
 * All styling uses CSS variables; no hardcoded pixel values for colors or layout metrics.
 */
function ControlBar({
  searchQuery,
  onSearchChange,
  tagQuery,
  onTagChange,
  selectedFilters,
  onFiltersChange,
  onClearFilters,
  onRandom,
  onSettingsClick,
  onSyncClick,
  onManageTags,
  onManageCollections,
  pageNum,
  onPrevPage,
  onNextPage,
  totalPages,
  isSyncing,
  isRefreshing,
  showLibraryTabs,
  onToggleLibraryTabs
}) {
  const [showFilters, setShowFilters] = React.useState(false);
  const dropdownRef = React.useRef(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };

    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilters]);

  const availableFilters = [
    { key: 'all', label: 'All' },
    { key: 'collections', label: 'Collections' },
    { key: 'series', label: 'Series' },
    { key: 'chapters', label: 'Chapters' },
    { key: 'standalone', label: 'Standalone' }
  ];

  
  const handleFilterToggle = (filterKey) => {
    if (filterKey === 'all') {
      onFiltersChange(['all']);
    } else {
      const newFilters = [...selectedFilters];
      
      // Remove 'all' if it's selected
      const allIndex = newFilters.indexOf('all');
      if (allIndex !== -1) {
        newFilters.splice(allIndex, 1);
      }
      
      // Toggle the selected filter
      const filterIndex = newFilters.indexOf(filterKey);
      if (filterIndex !== -1) {
        newFilters.splice(filterIndex, 1);
      } else {
        newFilters.push(filterKey);
      }
      
      // If no filters selected, default to 'all'
      if (newFilters.length === 0) {
        newFilters.push('all');
      }
      
      onFiltersChange(newFilters);
    }
  };

  const getFilterDisplay = () => {
    if (selectedFilters.includes('all') || selectedFilters.length === 0) {
      return 'All';
    }
    if (selectedFilters.length === 1) {
      const filter = availableFilters.find(f => f.key === selectedFilters[0]);
      return filter ? filter.label : selectedFilters[0];
    }
    return `${selectedFilters.length} selected`;
  };

    return (
    <div className="control-bar">
      <div className="control-bar-section">
        <input
          type="text"
          className="control-bar-input"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="control-bar-section">
        <button className="control-bar-button" onClick={onClearFilters} title="Clear">
          <span className="control-bar-icon">&#x2715;</span>
        </button>
        <button className="control-bar-button" onClick={onRandom} title="Random">
          <span className="control-bar-icon">&#x2684;</span>
        </button>
      </div>

      <div className="control-bar-section">
        <input
          type="text"
          className="control-bar-input"
          placeholder="Tag search..."
          value={tagQuery}
          onChange={(e) => onTagChange(e.target.value)}
        />
      </div>

      <div className="control-bar-section filter-dropdown-container" ref={dropdownRef}>
        <button
          className="control-bar-button filter-dropdown-button"
          onClick={() => setShowFilters(!showFilters)}
          title="Content Type Filter"
        >
          {getFilterDisplay()} ▼
        </button>
        
        {showFilters && (
          <div className="filter-dropdown-menu">
            {availableFilters.map((filter) => (
              <label key={filter.key} className="filter-dropdown-item">
                <input
                  type="checkbox"
                  checked={selectedFilters.includes(filter.key)}
                  onChange={() => handleFilterToggle(filter.key)}
                  className="filter-checkbox"
                />
                <span className="filter-label">{filter.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="control-bar-section navigator">
        <button className="control-bar-button" onClick={onPrevPage} disabled={pageNum <= 1}>
          Prev
        </button>
        <span className="control-bar-page-num">
          {pageNum} / {totalPages || 1}
        </span>
        <button className="control-bar-button" onClick={onNextPage} disabled={pageNum >= totalPages}>
          Next
        </button>
      </div>

      <div className="control-bar-section push-right">
        <button
          className="control-bar-button"
          onClick={onSyncClick}
          disabled={isSyncing || isRefreshing}
          title="Sync / Refresh"
        >
          <span className="control-bar-icon">
            {(isSyncing || isRefreshing) ? '...' : '\u21BB'}
          </span>
        </button>
        <button
          className="control-bar-button"
          onClick={onToggleLibraryTabs}
          title={showLibraryTabs ? 'Hide Library Tabs' : 'Show Library Tabs'}
        >
          <span className="control-bar-icon">
            {showLibraryTabs ? '\u25BC' : '\u25B2'}
          </span>
        </button>
        <button className="control-bar-button" onClick={onManageTags} title="Manage Tags">
          <span className="control-bar-icon">&#x1F3F7;</span>
        </button>
        <button className="control-bar-button" onClick={onManageCollections} title="Manage Collections">
          <span className="control-bar-icon">&#x1F4DA;</span>
        </button>
        <button className="control-bar-button" onClick={onSettingsClick} title="Settings">
          <span className="control-bar-icon">&#x2699;</span>
        </button>
      </div>
    </div>
  );
}

export default ControlBar;
