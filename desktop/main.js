// =============================================================================
//  UnityGUI Desktop — Electron main process
//  Generate Unity AND Roblox games from a prompt, for FREE (Gemini/Groq/Ollama).
//  Chats (history + refine), prompt enhancer, genre quick-starts, model
//  auto-fallback, and one-click auto-open into the engine.
// =============================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const { PROVIDERS, ENGINES } = require("./lib/providers");
const prompts = require("./lib/prompts");
const { callLLM, generateResilient, parseResult, keyList, ollamaStatus } = require("./lib/llm");
const writers = require("./lib/writers");
const zip = require("./lib/zip");

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const CONVOS_PATH = () => path.join(app.getPath("userData"), "conversations.json");
const DEFAULT_OUT = () => path.join(app.getPath("documents"), "UnityGUI Games");

// ---- Config store ----------------------------------------------------------
function loadConfig() {
  let c;
  try { c = JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8")); } catch { c = {}; }
  if (!c.provider || !PROVIDERS[c.provider]) c.provider = "gemini";
  if (!c.keys || typeof c.keys !== "object") c.keys = {};
  if (!c.model) c.model = PROVIDERS[c.provider].defaultModel;
  if (!c.engine || !ENGINES[c.engine]) c.engine = "unity";
  if (!c.style) c.style = "auto";
  if (typeof c.autoOpen !== "boolean") c.autoOpen = true;
  return c;
}
function saveConfig(c) { try { fs.writeFileSync(CONFIG_PATH(), JSON.stringify(c, null, 2)); return true; } catch { return false; } }
// The connect gate keys on the ACTIVE provider (Ollama needs no key). Generation
// itself still falls back across every provider that has a stored key.
function isConnected(c) { return PROVIDERS[c.provider].needsKey ? keyList(c, c.provider).length > 0 : true; }
// How many providers we can currently draw on (for a status hint).
function readyProviders(c) { return Object.keys(PROVIDERS).filter(p => !PROVIDERS[p].needsKey || keyList(c, p).length); }

// ---- Conversation store ----------------------------------------------------
function loadConvos() { try { return JSON.parse(fs.readFileSync(CONVOS_PATH(), "utf8")) || []; } catch { return []; } }
function saveConvos(list) { try { fs.writeFileSync(CONVOS_PATH(), JSON.stringify(list, null, 2)); } catch {} }
function getConvo(id) { return loadConvos().find(c => c.id === id); }
function upsertConvo(convo) {
  const list = loadConvos();
  const i = list.findIndex(c => c.id === convo.id);
  if (i >= 0) list[i] = convo; else list.unshift(convo);
  saveConvos(list);
}

// ---- Web thumbnail capture (best-effort, never throws) ---------------------
// Renders a generated Web game off-screen and grabs a frame as a small PNG so
// the library and chat can show a visual gallery. Failure is non-fatal.
function captureWebThumb(indexPath, outPng, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let done = false, win = null;
    const finish = (val) => { if (done) return; done = true; try { if (win && !win.isDestroyed()) win.destroy(); } catch {} resolve(val); };
    try {
      if (!indexPath || !fs.existsSync(indexPath)) return finish(null);
      win = new BrowserWindow({
        show: false, width: 480, height: 360, frame: false,
        webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true, sandbox: true },
      });
      win.webContents.once("did-fail-load", () => finish(null));
      win.webContents.once("did-finish-load", () => {
        setTimeout(async () => {
          try {
            const img = await win.webContents.capturePage();
            const png = img.toPNG();
            if (png && png.length) {
              try { if (outPng) fs.writeFileSync(outPng, png); } catch {}
              finish("data:image/png;base64," + png.toString("base64"));
            } else finish(null);
          } catch { finish(null); }
        }, 1300); // let a frame render (game loop)
      });
      win.loadFile(indexPath);
      setTimeout(() => finish(null), timeoutMs);
    } catch { finish(null); }
  });
}
function thumbToDataUrl(pngPath) {
  try { const b = fs.readFileSync(pngPath); return "data:image/png;base64," + b.toString("base64"); } catch { return null; }
}

// ---- Window ----------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1160, height: 800, minWidth: 820, minHeight: 580,
    backgroundColor: "#0a0d14", title: "UnityGUI",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ---- IPC: config -----------------------------------------------------------
ipcMain.handle("providers:get", () => ({ providers: PROVIDERS, engines: ENGINES, genres: prompts.GENRES, modifiers: prompts.MODIFIERS }));
ipcMain.handle("config:get", () => {
  const c = loadConfig();
  return {
    provider: c.provider, connected: isConnected(c), model: c.model, engine: c.engine,
    style: c.style, autoOpen: c.autoOpen, maxTokens: c.maxTokens || 16000,
    keyCount: keyList(c, c.provider).length, ready: readyProviders(c),
  };
});
ipcMain.handle("config:save", (_e, patch) => {
  const c = loadConfig();
  if (patch.provider && PROVIDERS[patch.provider]) c.provider = patch.provider;
  if (patch.model) c.model = patch.model;
  if (patch.engine && ENGINES[patch.engine]) c.engine = patch.engine;
  if (patch.style) c.style = patch.style;
  if (typeof patch.autoOpen === "boolean") c.autoOpen = patch.autoOpen;
  if (Number.isFinite(patch.maxTokens)) c.maxTokens = Math.max(2000, Math.min(32000, patch.maxTokens));
  if (patch.apiKey !== undefined) {
    c.keys = c.keys || {};
    // Accept a single key or an array (one per line) for auto-rotation.
    const val = Array.isArray(patch.apiKey)
      ? [...new Set(patch.apiKey.map(s => String(s || "").trim()).filter(Boolean))]
      : String(patch.apiKey || "").trim();
    c.keys[patch.provider && PROVIDERS[patch.provider] ? patch.provider : c.provider] = val;
  }
  return saveConfig(c);
});
ipcMain.handle("config:disconnect", () => { const c = loadConfig(); if (c.keys) c.keys[c.provider] = ""; return saveConfig(c); });

ipcMain.handle("ollama:status", () => ollamaStatus());
ipcMain.handle("connect:test", async (_e, { provider, apiKey, model }) => {
  const key = Array.isArray(apiKey) ? apiKey.find(Boolean) : apiKey;
  try {
    const { text, model: used } = await callLLM(provider, key, model || PROVIDERS[provider].defaultModel, "You are a connectivity check.", "Reply with the single word OK.", false, 20);
    return { ok: true, sample: (text || "").trim().slice(0, 40), model: used };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---- IPC: conversations ----------------------------------------------------
ipcMain.handle("convos:list", () => loadConvos().map(c => ({ id: c.id, title: c.title, engine: c.engine, updatedAt: c.updatedAt, turns: c.turns.length })));
ipcMain.handle("convos:get", (_e, id) => getConvo(id) || null);
ipcMain.handle("convos:delete", (_e, id) => { saveConvos(loadConvos().filter(c => c.id !== id)); return true; });
ipcMain.handle("convos:rename", (_e, { id, title }) => {
  const convo = getConvo(id); if (!convo) return false;
  convo.title = String(title || "").slice(0, 60) || convo.title; convo.updatedAt = Date.now(); upsertConvo(convo); return true;
});

// ---- IPC: prompt enhancer --------------------------------------------------
ipcMain.handle("prompt:enhance", async (_e, { idea, engine }) => {
  const c = loadConfig();
  if (!isConnected(c)) return { ok: false, error: "Not connected. Add your free API key first." };
  if (!idea || !idea.trim()) return { ok: false, error: "Type an idea to enhance first." };
  try {
    const { text } = await generateResilient(c, prompts.ENHANCE_SYSTEM, prompts.buildEnhancePrompt(engine || c.engine, idea.trim()), false, 600);
    return { ok: true, text: (text || "").trim() };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---- IPC: generate (with refine + regenerate + conversation) ---------------
ipcMain.handle("generate", async (_e, { prompt, conversationId, regenerate }) => {
  const c = loadConfig();
  if (!isConnected(c)) return { ok: false, error: "Not connected. Add your free API key first." };

  let convo = conversationId ? getConvo(conversationId) : null;
  const engine = convo ? convo.engine : c.engine;

  // Regenerate: re-run the last user prompt of this conversation.
  if (regenerate && convo && convo.turns.length) {
    prompt = convo.turns[convo.turns.length - 1].prompt;
    convo.turns.pop(); // drop the old result; we'll replace it
  }
  if (!prompt || !prompt.trim()) return { ok: false, error: "Describe your game (or a change) first." };

  try {
    const system = prompts.buildSystemPrompt(engine, c.style);
    const userMsg = convo && convo.turns.length
      ? prompts.buildRefinePrompt(convo.turns[convo.turns.length - 1].result, prompt)
      : prompt;
    // Resilient: rotates keys, falls back across providers, retries on rate-limit.
    const { text, provider: usedProvider, model: usedModel } = await generateResilient(c, system, userMsg, true, c.maxTokens || 16000);

    // Auto-heal: remember whichever provider/model actually worked so next time starts there.
    if ((usedProvider && usedProvider !== c.provider) || (usedModel && usedModel !== c.model)) {
      if (usedProvider) c.provider = usedProvider;
      if (usedModel) c.model = usedModel;
      saveConfig(c);
    }

    const data = parseResult(text);
    if (!data || !Array.isArray(data.files) || data.files.length === 0)
      return { ok: false, error: "The model returned no files. Try a more specific prompt or another model." };
    data.engine = engine;

    // record the conversation turn
    if (!convo) {
      convo = { id: "c" + Date.now(), title: (data.game_name || prompt).slice(0, 48), engine, createdAt: Date.now(), updatedAt: Date.now(), turns: [] };
    }
    convo.turns.push({ prompt, result: data });
    convo.updatedAt = Date.now();
    convo.title = (data.game_name || convo.title).slice(0, 48);
    upsertConvo(convo);

    // auto-save + auto-open if enabled
    let saved = null;
    if (c.autoOpen) {
      try {
        saved = writers.writeProject(engine, DEFAULT_OUT(), data);
        shell.openPath(saved.openTarget);
        // Web games: grab a thumbnail for the chat + library gallery (best-effort).
        if (engine === "web" && saved.root) {
          try { const t = await captureWebThumb(saved.openTarget, path.join(saved.root, "thumb.png")); if (t) saved.thumb = t; } catch {}
        }
      } catch (e) { saved = { error: e.message }; }
    }
    return { ok: true, data, conversationId: convo.id, saved, usedProvider, usedModel };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle("dialog:pickFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("project:save", (_e, { engine, data, dir }) => {
  try { const s = writers.writeProject(engine, dir, data); return { ok: true, path: s.root, openTarget: s.openTarget }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("project:zip", (_e, { engine, data, dir }) => {
  try {
    const s = writers.writeProject(engine, dir || DEFAULT_OUT(), data);
    const zipPath = zip.zipDir(s.root);
    return { ok: true, zipPath, root: s.root };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("project:zipDir", (_e, dir) => {
  try { return { ok: true, zipPath: zip.zipDir(dir) }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("shell:open", (_e, p) => shell.openPath(p));
ipcMain.handle("shell:reveal", (_e, p) => shell.showItemInFolder(p));
ipcMain.handle("shell:openExternal", (_e, url) => shell.openExternal(url));

// In-app playable preview (Web games): open the HTML in an isolated window.
ipcMain.handle("preview:open", (_e, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, error: "Nothing to preview yet." };
    const win = new BrowserWindow({
      width: 900, height: 680, backgroundColor: "#0a0d14", title: "UnityGUI — Preview",
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    win.setMenuBarVisibility(false);
    win.loadFile(filePath);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Project library: list the games written under the default output folder.
ipcMain.handle("projects:list", () => {
  const base = DEFAULT_OUT();
  let names = [];
  try { names = fs.readdirSync(base); } catch { return []; }
  const out = [];
  for (const name of names) {
    const full = path.join(base, name);
    let st; try { st = fs.statSync(full); } catch { continue; }
    if (!st.isDirectory()) continue;
    let engine = "unity", openTarget = full, thumb = null;
    if (name.startsWith("Roblox-")) {
      engine = "roblox";
      try { const f = fs.readdirSync(full).find(x => x.endsWith(".rbxlx")); if (f) openTarget = path.join(full, f); } catch {}
    } else if (name.startsWith("Web-")) {
      engine = "web"; openTarget = path.join(full, "index.html");
      const tp = path.join(full, "thumb.png");
      if (fs.existsSync(tp)) thumb = thumbToDataUrl(tp);
    }
    out.push({ name, path: full, engine, openTarget, mtime: st.mtimeMs, thumb });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
});
