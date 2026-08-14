// Safe bridge between the renderer and the Electron main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (cfg) => ipcRenderer.invoke("config:save", cfg),
  disconnect: () => ipcRenderer.invoke("config:disconnect"),
  testConnect: (payload) => ipcRenderer.invoke("connect:test", payload),
  generate: (payload) => ipcRenderer.invoke("generate", payload),
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
  saveProject: (payload) => ipcRenderer.invoke("project:save", payload),
  openPath: (p) => ipcRenderer.invoke("shell:open", p),
});
