// Safe bridge between the renderer and the Electron main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getProviders: () => ipcRenderer.invoke("providers:get"),
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (cfg) => ipcRenderer.invoke("config:save", cfg),
  disconnect: () => ipcRenderer.invoke("config:disconnect"),
  testConnect: (payload) => ipcRenderer.invoke("connect:test", payload),
  ollamaStatus: () => ipcRenderer.invoke("ollama:status"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setKeys: (payload) => ipcRenderer.invoke("keys:set", payload),

  listConvos: () => ipcRenderer.invoke("convos:list"),
  getConvo: (id) => ipcRenderer.invoke("convos:get", id),
  deleteConvo: (id) => ipcRenderer.invoke("convos:delete", id),
  renameConvo: (id, title) => ipcRenderer.invoke("convos:rename", { id, title }),

  enhancePrompt: (idea, engine) => ipcRenderer.invoke("prompt:enhance", { idea, engine }),
  generate: (payload) => ipcRenderer.invoke("generate", payload),
  pickImage: () => ipcRenderer.invoke("dialog:pickImage"),
  generateArt: (payload) => ipcRenderer.invoke("art:generate", payload),
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
  saveProject: (payload) => ipcRenderer.invoke("project:save", payload),
  zipProject: (payload) => ipcRenderer.invoke("project:zip", payload),
  zipDir: (dir) => ipcRenderer.invoke("project:zipDir", dir),
  saveFile: (payload) => ipcRenderer.invoke("file:save", payload),
  standaloneHtml: (root) => ipcRenderer.invoke("web:standalone", root),
  listProjects: () => ipcRenderer.invoke("projects:list"),
  previewGame: (p) => ipcRenderer.invoke("preview:open", p),
  checkWeb: (p) => ipcRenderer.invoke("web:check", p),
  openUnity: (root) => ipcRenderer.invoke("unity:open", root),
  locateUnity: () => ipcRenderer.invoke("unity:locate"),
  pickUnityExe: () => ipcRenderer.invoke("unity:pickExe"),
  openPath: (p) => ipcRenderer.invoke("shell:open", p),
  revealPath: (p) => ipcRenderer.invoke("shell:reveal", p),
  openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
