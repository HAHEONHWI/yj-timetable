const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("widgetApi", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:update", patch),
  close: () => ipcRenderer.invoke("window:close"),
});
