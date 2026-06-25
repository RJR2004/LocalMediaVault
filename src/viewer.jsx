/**
 * Viewer Entry Point
 * React app initialization for viewer window
 * Phase 3: Full UI components implementation
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import ViewerFrame from './systems/UISystem/ViewerFrame.jsx';
import './viewer.css';

// Parse URL parameters
const params = new URLSearchParams(window.location.search);
const mediaId = params.get('id');
const mode = params.get('mode') || 'singlepage';
const collectionId = params.get('collectionId');

console.log(`Viewer: Starting with mediaId=${mediaId}, mode=${mode}, collectionId=${collectionId}`);
console.log('Viewer: window.electronAPI available:', !!window.electronAPI);

// Initialize React app
const container = document.getElementById('root');
console.log('Viewer: Container element:', container);
if (!container) {
  console.error('Viewer: Root container not found!');
} else {
  const root = createRoot(container);
  console.log('Viewer: React root created');

  root.render(
    <React.StrictMode>
      <ViewerFrame mediaId={mediaId} mode={mode} collectionId={collectionId} />
    </React.StrictMode>
  );
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Viewer: Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Viewer: Unhandled promise rejection:', event.reason);
});

console.log('Viewer: Application initialized successfully');
