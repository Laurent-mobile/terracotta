//electron/main.js
import { app, BrowserWindow, session } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
	  enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png'),
	frame: true,
    transparent: false,
    hasShadow: true,
    backgroundColor: '#ffffff',
    show: false
  });
  // Chargez d'abord, PUIS montrez la fenêtre
  win.once('ready-to-show', () => {
    win.show();
    win.focus(); // Force le focus
  });

  // En développement : charger depuis Vite
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // En production : charger le build Vite
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Configuration CORS pour Supabase
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Headers': ['*']
      }
    });
  });
}

app.whenReady().then(createWindow);

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
