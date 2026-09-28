// L.A.B Admin Portal — Electron shell. A desktop window onto the Admin Portal
// the Manager serves at /admin/ — the same key-gated page as in a browser, so
// there's one Portal to keep current (this used to carry its own copy, which
// fell behind and couldn't unlock the admin tier).
const { app, BrowserWindow } = require('electron');
const path = require('path');

const MANAGER = process.env.LAB_MANAGER_URL || 'http://192.168.1.115:8090';

function createWindow() {
  const win = new BrowserWindow({
    width: 1120, height: 780, minWidth: 820, minHeight: 560,
    backgroundColor: '#e8eaee',
    title: 'L.A.B Admin',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadURL(MANAGER + '/admin/');
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
