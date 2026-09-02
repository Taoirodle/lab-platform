// L.A.B Admin Portal — Electron shell. A real app (not a browser tab) that
// connects to the L.A.B Hub Manager over the LAN. First build: the control
// surface (Approvals, AI controls, Fleet). USB-key + installer come in the
// hardening pass.
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1120, height: 780, minWidth: 820, minHeight: 560,
    backgroundColor: '#e8eaee',
    title: 'L.A.B Admin',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false            // trusted local admin app talking to the LAN Manager
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'public', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
