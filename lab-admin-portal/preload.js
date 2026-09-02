// L.A.B Admin Portal — preload. Exposes the Manager address to the renderer.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('LAB', {
  managerUrl: process.env.LAB_MANAGER_URL || 'http://192.168.1.115:8090',
  version: '0.0.1'
});
