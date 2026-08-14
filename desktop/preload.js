// Safe bridge between the renderer and the Electron main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getProviders: () => ipcRenderer.invoke("providers:get"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (cfg) => ipcRenderer.invoke("config:save", cfg),
  disconnect: () => ipcRenderer.invoke("config:disconnect"),
  testConnect: (payload) => ipcRenderer.invoke("connect:test", payload),

  listConvos: () => ipcRenderer.invoke("convos:list"),
  getConvo: (id) => ipcRenderer.invoke("convos:get", id),
  deleteConvo: (id) => ipcRenderer.invoke("convos:delete", id),
  renameConvo: (id, title) => ipcRenderer.invoke("convos:rename", { id, title }),

  enhancePrompt: (idea, engine) => ipcRenderer.invoke("prompt:enhance", { idea, engine }),
  generate: (payload) => ipcRenderer.invoke("generate", payload),
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
  saveProject: (payload) => ipcRenderer.invoke("project:save", payload),
  openPath: (p) => ipcRenderer.invoke("shell:open", p),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
