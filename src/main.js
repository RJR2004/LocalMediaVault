const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const SystemLayer = require('./systems/SystemLayer');


function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.maximize();
  // Load the React app
  mainWindow.loadFile('dist/index.html');
  {/* if (app.isPackaged) {
    // Production: Load the compiled React file
    // main.js is in src/, so go up one level to find dist at root
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    // Development: Load the local dev server
    mainWindow.loadURL('http://localhost:3000');
  } */}

  // Store reference in SystemLayer
  SystemLayer.mainWindow = mainWindow;
}

async function appStartUp() {
  console.log('Starting PeraPera application...');
  const result = await SystemLayer.checkUserData();
  
  if (result.success) {
    console.log('User data check completed successfully');
    console.log('UserData folder located at:', result.path);
    
    // Initialize current workspace
    const workspaceResult = await SystemLayer.initializeCurrentWorkspace();
    if (!workspaceResult.success) {
      console.warn('Workspace initialization failed:', workspaceResult.error);
    }
  } else {
    console.error('User data check failed:', result.error);
  }
  
  return result;
}

// Register custom protocol for thumbnail loading
function registerThumbnailProtocol() {
  protocol.registerFileProtocol('pera-cache', (request, callback) => {
    try {
      // Extract UUID from URL: pera-cache://uuid
      const url = new URL(request.url);
      const uuid = url.hostname;
      
      if (!uuid || uuid.length !== 36) {
        callback({ error: 'Invalid UUID' });
        return;
      }
      
      // Get current workspace info
      const workspace = SystemLayer.getCurrentWorkspace();
      if (!workspace.workspaceHash) {
        callback({ error: 'No active workspace' });
        return;
      }
      
      // Construct cache path
      const userDataPath = SystemLayer.getUserDataPath();
      const cachePath = path.join(userDataPath, 'workspaces', workspace.workspaceHash, 'cache', `${uuid}.jpg`);
      
      // Check if file exists
      if (fs.existsSync(cachePath)) {
        callback({ path: cachePath });
      } else {
        // File doesn't exist, check if this is a collection and try fallback
        const dbPath = path.join(userDataPath, 'workspaces', workspace.workspaceHash, 'library.db');
        
        if (fs.existsSync(dbPath)) {
          const sqlite3 = require('sqlite3').verbose();
          const db = new sqlite3.Database(dbPath);
          
          db.get(
            'SELECT THUMBNAIL_ID FROM collections WHERE ID = ?',
            [uuid],
            (err, row) => {
              db.close();
              
              if (err) {
                console.error('Database query error:', err);
                callback({ error: 'Thumbnail not found' });
                return;
              }
              
              if (row && row.THUMBNAIL_ID) {
                // Collection has a thumbnail pointer, try to serve the first member's thumbnail
                const fallbackPath = path.join(userDataPath, 'workspaces', workspace.workspaceHash, 'cache', `${row.THUMBNAIL_ID}.jpg`);
                
                if (fs.existsSync(fallbackPath)) {
                  callback({ path: fallbackPath });
                } else {
                  callback({ error: 'Thumbnail not found' });
                }
              } else {
                callback({ error: 'Thumbnail not found' });
              }
            }
          );
        } else {
          callback({ error: 'Thumbnail not found' });
        }
      }
    } catch (error) {
      console.error('Error in pera-cache protocol:', error);
      callback({ error: error.message });
    }
  });
}

// This is like the main() function in C
app.whenReady().then(async () => {
  await appStartUp();
  
  // Register custom protocol for thumbnails
  registerThumbnailProtocol();
  
  // Initialize IPC handlers after app is ready
  SystemLayer.initializeIPC();
  
  createWindow();

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
