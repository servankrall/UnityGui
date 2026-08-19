// =============================================================================
//  UnityGUI Desktop — Electron main process
//  Generate Unity AND Roblox games from a prompt, for FREE (Gemini/Groq/Ollama).
//  Chats (history + refine), prompt enhancer, genre quick-starts, model
//  auto-fallback, and one-click auto-open into the engine.
// =============================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const { PROVIDERS, ENGINES } = require("./lib/providers");
const prompts = require("./lib/prompts");
const { callLLM, generateResilient, parseResult, keyList, ollamaStatus, isTruncated, coerceFiles } = require("./lib/llm");
const writers = require("./lib/writers");
const zip = require("./lib/zip");
const unity = require("./lib/unity");
const art = require("./lib/art");
const staticServer = require("./lib/server");
const templates = require("./lib/templates");
const { sanitizeTags } = require("./lib/tags");

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const CONVOS_PATH = () => path.join(app.getPath("userData"), "conversations.json");
const META_PATH = () => path.join(app.getPath("userData"), "projectMeta.json");
const DEFAULT_OUT = () => path.join(app.getPath("documents"), "UnityGUI Games");

// ---- Project metadata store (tags / collections), keyed by folder name ------
function loadMeta() { try { const m = JSON.parse(fs.readFileSync(META_PATH(), "utf8")); return m && typeof m === "object" ? m : {}; } catch { return {}; } }
function saveMeta(m) { try { fs.writeFileSync(META_PATH(), JSON.stringify(m, null, 2)); return true; } catch { return false; } }

// ---- Config store ----------------------------------------------------------
function loadConfig() {
  let c;
  try { c = JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8")); } catch { c = {}; }
  if (!c.provider || !PROVIDERS[c.provider]) c.provider = "pollinations"; // free, no-key, capable — works out of the box
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

// ---- Open a Unity project directly in the Editor (no Hub "Add" step) -------
function resolveUnityExe() {
  const c = loadConfig();
  if (c.unityPath && fs.existsSync(c.unityPath)) return c.unityPath;
  if (process.env.UNITY_PATH && fs.existsSync(process.env.UNITY_PATH)) return process.env.UNITY_PATH;
  return unity.findUnityExe();
}
function launchUnity(projectRoot) {
  const exe = resolveUnityExe();
  if (!exe) return { ok: false, needsUnity: true };
  try {
    const child = spawn(exe, ["-projectPath", projectRoot], { detached: true, stdio: "ignore" });
    child.unref();
    return { ok: true, exe };
  } catch (e) { return { ok: false, error: e.message }; }
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
    style: c.style, autoOpen: c.autoOpen, maxTokens: c.maxTokens || 20000,
    keyCount: keyList(c, c.provider).length, ready: readyProviders(c),
    tourConnect: !!c.tourConnect, tourApp: !!c.tourApp,
  };
});
ipcMain.handle("config:save", (_e, patch) => {
  const c = loadConfig();
  if (patch.provider && PROVIDERS[patch.provider]) c.provider = patch.provider;
  if (patch.model) c.model = patch.model;
  if (patch.engine && ENGINES[patch.engine]) c.engine = patch.engine;
  if (patch.style) c.style = patch.style;
  if (typeof patch.autoOpen === "boolean") c.autoOpen = patch.autoOpen;
  if (typeof patch.tourConnect === "boolean") c.tourConnect = patch.tourConnect;
  if (typeof patch.tourApp === "boolean") c.tourApp = patch.tourApp;
  if (Number.isFinite(patch.maxTokens)) c.maxTokens = Math.max(2000, Math.min(60000, patch.maxTokens));
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

// ---- Settings: providers + keys + Unity path -------------------------------
ipcMain.handle("settings:get", () => {
  const c = loadConfig();
  const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
    id, label: p.label, needsKey: p.needsKey, keyUrl: p.keyUrl, keyHint: p.keyHint,
    keyCount: keyList(c, id).length, active: id === c.provider,
  }));
  return {
    providers, activeProvider: c.provider,
    unityPath: c.unityPath || "", unityDetected: resolveUnityExe() || null,
    style: c.style, maxTokens: c.maxTokens || 20000, autoOpen: c.autoOpen,
  };
});
ipcMain.handle("keys:set", (_e, { provider, keys, makeActive }) => {
  if (!PROVIDERS[provider]) return { ok: false, error: "Unknown provider." };
  const c = loadConfig(); c.keys = c.keys || {};
  if (keys !== undefined && keys !== null) { // only touch keys when provided (not on a bare "make active")
    const arr = (Array.isArray(keys) ? keys : String(keys).split(/[\n,]+/)).map(s => String(s || "").trim()).filter(Boolean);
    c.keys[provider] = [...new Set(arr)];
  }
  if (makeActive) c.provider = provider;
  saveConfig(c);
  return { ok: true, keyCount: keyList(c, provider).length };
});

ipcMain.handle("ollama:status", () => ollamaStatus());
ipcMain.handle("connect:test", async (_e, { provider, apiKey, model }) => {
  const key = Array.isArray(apiKey) ? apiKey.find(Boolean) : apiKey;
  try {
    const { text, model: used } = await callLLM(provider, key, model || PROVIDERS[provider].defaultModel, "You are a connectivity check.", "Reply with the single word OK.", false, 20);
    return { ok: true, sample: (text || "").trim().slice(0, 40), model: used };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---- IPC: starter templates (instant, no AI) -------------------------------
ipcMain.handle("templates:list", () => templates.list());
ipcMain.handle("templates:create", async (_e, id) => {
  const tpl = templates.byId(id);
  if (!tpl) return { ok: false, error: "Unknown template." };
  const data = { game_name: tpl.name, engine: "web", summary: tpl.summary, setup_notes: tpl.setup || "", files: [{ path: "index.html", content: tpl.html }] };
  const convo = { id: "c" + Date.now(), title: tpl.name.slice(0, 48), engine: "web", createdAt: Date.now(), updatedAt: Date.now(), turns: [{ prompt: "Template: " + tpl.name, result: data }] };
  upsertConvo(convo);
  let saved = null;
  try {
    saved = writers.writeProject("web", DEFAULT_OUT(), data, {});
    shell.openPath(saved.openTarget);
    try { const t = await captureWebThumb(saved.openTarget, path.join(saved.root, "thumb.png")); if (t) saved.thumb = t; } catch {}
    if (saved.openTarget) data._openTarget = saved.openTarget;
    if (saved.root) data._root = saved.root;
    upsertConvo(convo);
  } catch (e) { saved = { error: e.message }; }
  return { ok: true, data, conversationId: convo.id, saved };
});

// ---- IPC: conversations ----------------------------------------------------
ipcMain.handle("convos:list", () => loadConvos().map(c => ({ id: c.id, title: c.title, engine: c.engine, updatedAt: c.updatedAt, turns: c.turns.length, favorite: !!c.favorite })));
ipcMain.handle("convos:get", (_e, id) => getConvo(id) || null);
ipcMain.handle("convos:delete", (_e, id) => { saveConvos(loadConvos().filter(c => c.id !== id)); return true; });
ipcMain.handle("convos:favorite", (_e, { id, favorite }) => { const c = getConvo(id); if (!c) return false; c.favorite = !!favorite; upsertConvo(c); return true; });
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

// ---- IPC: chat (conversational assistant — answers in text, no game) -------
ipcMain.handle("chat", async (_e, { prompt, conversationId }) => {
  const c = loadConfig();
  if (!isConnected(c)) return { ok: false, error: "Not connected. Add a free API key — or use unlimited Ollama (no key)." };
  if (!prompt || !prompt.trim()) return { ok: false, error: "Type a message first." };
  let convo = conversationId ? getConvo(conversationId) : null;
  try {
    // Give the assistant context about any game already built in THIS thread, so
    // it "knows what it created" and can talk about it in the same conversation.
    const system = prompts.CHAT_SYSTEM + prompts.buildChatContext(convo);
    const userMsg = prompts.buildChatPrompt(convo ? convo.turns : [], prompt.trim());
    const r = await generateResilient(c, system, userMsg, false, 1500);
    const text = (r.text || "").trim();
    if (!text) return { ok: false, error: "The AI returned an empty reply. Try again." };
    // Auto-heal: remember whichever provider/model actually answered.
    if ((r.provider && r.provider !== c.provider) || (r.model && r.model !== c.model)) {
      if (r.provider) c.provider = r.provider;
      if (r.model) c.model = r.model;
      saveConfig(c);
    }
    if (!convo) {
      // A brand-new conversation that starts with a chat. If a game is later made
      // here, its engine replaces this placeholder.
      convo = { id: "c" + Date.now(), title: prompt.trim().slice(0, 48), engine: "chat", createdAt: Date.now(), updatedAt: Date.now(), turns: [] };
    }
    convo.turns.push({ prompt: prompt.trim(), result: { assistant: true, text } });
    convo.updatedAt = Date.now();
    upsertConvo(convo);
    return { ok: true, text, conversationId: convo.id, usedProvider: r.provider, usedModel: r.model };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---- IPC: generate (with refine + regenerate + conversation) ---------------
ipcMain.handle("generate", async (_e, { prompt, conversationId, regenerate, image, images: imagesIn, fixErrors }) => {
  const c = loadConfig();
  if (!isConnected(c)) return { ok: false, error: "Not connected. Add your free API key first." };

  let convo = conversationId ? getConvo(conversationId) : null;
  // A conversation can mix chat + game turns; if it has no real engine yet (a
  // chat-first thread), use the one currently selected in the UI.
  const engine = (convo && ENGINES[convo.engine]) ? convo.engine : c.engine;

  // Regenerate: re-run the prompt of the latest GAME in this conversation.
  if (regenerate && convo && convo.turns.length) {
    const g = prompts.latestGame(convo.turns);
    if (g) { prompt = g.prompt; convo.turns = convo.turns.filter(t => t !== g); }
  }
  // Auto-fix: build a "fix these runtime errors" refine instruction.
  if (fixErrors && fixErrors.length) prompt = prompts.buildFixPrompt(fixErrors);
  if (!prompt || !prompt.trim()) return { ok: false, error: "Describe your game (or a change) first." };

  // Assets: an array of { name, mime, base64 } (or the legacy single `image`).
  const rawAssets = Array.isArray(imagesIn) && imagesIn.length
    ? imagesIn
    : (image && image.base64 ? [{ name: "reference", mime: image.mime, base64: image.base64 }] : []);
  const assets = rawAssets.filter(a => a && a.base64).map((a, i) => ({ name: writers.sanitize(a.name || ("asset" + (i + 1))) || ("asset" + (i + 1)), mime: a.mime || "image/png", base64: a.base64 }));
  const images = assets.length ? assets.map(a => ({ mime: a.mime, data: a.base64 })) : null;

  try {
    const system = prompts.buildSystemPrompt(engine, c.style);
    // Refine from the latest GAME in the thread (there may be chat turns after it).
    const priorGame = convo ? prompts.latestGame(convo.turns) : null;
    let userMsg = priorGame ? prompts.buildRefinePrompt(priorGame.result, prompt) : prompt;
    if (assets.length) userMsg += prompts.buildAssetHint(engine, assets.map(a => a.name));
    const badFiles = (d) => !d || !Array.isArray(d.files) || d.files.length === 0;

    // One generation attempt: resilient call (rotates keys / providers, retries
    // rate-limits) + truncation-tolerant parse.
    const attempt = async (tokens) => {
      const r = await generateResilient(c, system, userMsg, true, tokens, { images });
      let data = null, parseErr = null;
      try { data = parseResult(r.text); } catch (e) { parseErr = e; }
      return { r, data, parseErr };
    };

    const budget = c.maxTokens || 20000;
    let { r, data, parseErr } = await attempt(budget);

    // If the model got cut off (huge game) or the JSON wouldn't parse, retry once
    // with a much larger token budget — this is the usual cause of the
    // "Unterminated string in JSON" error.
    if ((badFiles(data) || parseErr) && (isTruncated(r.finishReason) || parseErr)) {
      const bigger = Math.min(60000, Math.max(budget * 2, 40000));
      if (bigger > budget) {
        const a2 = await attempt(bigger);
        if (a2.data && !badFiles(a2.data)) ({ r, data, parseErr } = a2);
        else if (a2.data && !data) ({ r, data, parseErr } = a2);
      }
    }

    // If we salvaged a truncated blob, the last file is likely incomplete — drop it
    // (only when there's more than one file, so we don't end up with nothing).
    if (data && Array.isArray(data.files) && data.files.length > 1 && isTruncated(r.finishReason)) {
      const last = data.files[data.files.length - 1];
      if (!last || last.content == null || String(last.content).length < 24) data.files.pop();
    }

    // Wrong-shape salvage: weaker models often put the code in the wrong place
    // (no top-level `files` array). Recover the common variants before erroring.
    if (badFiles(data) && data) { const cf = coerceFiles(data, engine); if (cf && !badFiles(cf)) data = cf; }

    // Still nothing usable → one firmer retry with an explicit format reminder
    // (this is what small local models usually need to comply).
    if (badFiles(data)) {
      try {
        const strict = userMsg + "\n\nReturn ONLY the JSON object described above — keys game_name, summary, setup_notes, and a non-empty \"files\" array whose items each have the complete code in \"content\". No prose, no explanations, no markdown fences.";
        const rr = await generateResilient(c, system, strict, true, Math.max(budget, 32000), { images });
        let d3 = null; try { d3 = parseResult(rr.text); } catch {}
        if (d3 && badFiles(d3)) { const cf = coerceFiles(d3, engine); if (cf) d3 = cf; }
        if (d3 && !badFiles(d3)) { r = rr; data = d3; parseErr = null; }
      } catch {}
    }

    if (badFiles(data)) {
      const used = r && r.provider;
      return { ok: false, error: (isTruncated(r.finishReason) || parseErr)
        ? "The game was too big and got cut off before it finished. Try a shorter description, set Length to Max, or switch model/provider."
        : used === "ollama"
          ? "Your local Ollama model couldn't produce a full game in the required format. Try a stronger model (e.g. `ollama pull qwen2.5-coder:7b`, or a 14b/32b), pick the Web engine (it's the simplest), or add a free Gemini/Groq key."
          : used === "pollinations"
            ? "The free AI didn't return a usable game this time. Try again (it varies), pick the Web engine (it's the simplest), or add a free Gemini key (aistudio.google.com/app/apikey) for the most reliable results."
            : "The model returned no usable files. Try again, shorten the description, or pick another model/provider." };
    }

    const usedProvider = r.provider, usedModel = r.model;
    // Auto-heal: remember whichever provider/model actually worked so next time starts there.
    if ((usedProvider && usedProvider !== c.provider) || (usedModel && usedModel !== c.model)) {
      if (usedProvider) c.provider = usedProvider;
      if (usedModel) c.model = usedModel;
      saveConfig(c);
    }
    data.engine = engine;

    // record the conversation turn
    if (!convo) {
      convo = { id: "c" + Date.now(), title: (data.game_name || prompt).slice(0, 48), engine, createdAt: Date.now(), updatedAt: Date.now(), turns: [] };
    }
    convo.engine = engine; // a chat-first thread becomes a game thread of this engine
    convo.turns.push({ prompt, result: data });
    convo.updatedAt = Date.now();
    convo.title = (data.game_name || convo.title).slice(0, 48);
    upsertConvo(convo);

    // auto-save + auto-open if enabled
    let saved = null;
    if (c.autoOpen) {
      try {
        const imgOpt = assets.length ? { images: assets.map(a => ({ name: a.name, base64: a.base64 })) } : {};
        saved = writers.writeProject(engine, DEFAULT_OUT(), data, imgOpt);
        if (engine === "unity") {
          // Open the project straight in the Unity Editor — no Hub "Add" step.
          const u = launchUnity(saved.root);
          if (u.ok) { saved.launched = "unity"; saved.unityExe = u.exe; }
          else { shell.openPath(saved.root); saved.launched = "folder"; saved.needsUnity = !!u.needsUnity; }
        } else {
          shell.openPath(saved.openTarget);
          // Web games: grab a thumbnail for the chat + library gallery (best-effort).
          if (engine === "web" && saved.root) {
            try { const t = await captureWebThumb(saved.openTarget, path.join(saved.root, "thumb.png")); if (t) saved.thumb = t; } catch {}
          }
        }
      } catch (e) { saved = { error: e.message }; }
    }
    // Persist where the game was written INTO the turn, so its Play/Open button
    // still works after later chat turns (or when the conversation is reopened).
    if (saved && (saved.openTarget || saved.root)) {
      if (saved.openTarget) data._openTarget = saved.openTarget;
      if (saved.root) data._root = saved.root;
      upsertConvo(convo);
    }
    return { ok: true, data, conversationId: convo.id, saved, usedProvider, usedModel };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle("dialog:pickFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});
// Free AI art (Pollinations, no key). Returns the image as a data URL + base64
// so it can be attached like a reference image.
ipcMain.handle("art:generate", async (_e, { prompt, width, height, seed }) => {
  if (!prompt || !prompt.trim()) return { ok: false, error: "Describe the art you want first." };
  const url = art.artUrl(prompt.trim(), { width, height, seed });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  let res;
  try { res = await fetch(url, { signal: controller.signal }); }
  catch (e) { clearTimeout(timer); return { ok: false, error: e.name === "AbortError" ? "Image generation timed out." : "Couldn't reach the free image service (check your connection)." }; }
  clearTimeout(timer);
  if (!res.ok) return { ok: false, error: "Image service error (" + res.status + ")." };
  try {
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { ok: false, error: "No image was returned. Try again." };
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    const base64 = buf.toString("base64");
    return { ok: true, name: "ai-art.png", mime, base64, dataUrl: "data:" + mime + ";base64," + base64 };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("dialog:pickImage", async () => {
  const r = await dialog.showOpenDialog({
    title: "Choose a reference image",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const p = r.filePaths[0];
    const buf = fs.readFileSync(p);
    if (buf.length > 8 * 1024 * 1024) return { error: "Image is too large (max 8 MB)." };
    const ext = path.extname(p).toLowerCase().replace(".", "");
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : ext === "bmp" ? "image/bmp" : "image/png";
    const base64 = buf.toString("base64");
    return { name: path.basename(p), mime, base64, dataUrl: "data:" + mime + ";base64," + base64 };
  } catch (e) { return { error: e.message }; }
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
// Save an edited file back into a generated project (inline code editor).
ipcMain.handle("file:save", (_e, { root, rel, engine, file, content }) => {
  try {
    if (!root) return { ok: false, error: "Missing project path." };
    const relPath = rel || (engine && file ? writers.diskRelFor(engine, file) : null);
    if (!relPath) return { ok: false, error: "This file can't be edited in-app for this engine." };
    const target = writers.safeJoin(root, relPath);
    if (!target) return { ok: false, error: "Path is outside the project." };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(content == null ? "" : content), "utf8");
    return { ok: true, path: target };
  } catch (e) { return { ok: false, error: e.message }; }
});
// Play on phone: serve a Web game over the LAN so a phone can open it.
let phoneServer = null; // { server, url, root }
ipcMain.handle("phone:serve", async (_e, projectRoot) => {
  try {
    if (!projectRoot || !fs.existsSync(path.join(projectRoot, "index.html"))) return { ok: false, error: "No web game to serve." };
    if (phoneServer) { try { phoneServer.server.close(); } catch {} phoneServer = null; }
    const s = await staticServer.startStaticServer(projectRoot);
    phoneServer = { server: s.server, url: s.url, root: projectRoot };
    return { ok: true, url: s.url };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("phone:stop", () => { if (phoneServer) { try { phoneServer.server.close(); } catch {} phoneServer = null; } return { ok: true }; });
app.on("before-quit", () => { if (phoneServer) { try { phoneServer.server.close(); } catch {} } });

// Web: build a single self-contained .html (assets inlined) for easy sharing / itch.io.
ipcMain.handle("web:standalone", (_e, projectRoot) => {
  try {
    const out = writers.writeStandaloneHtml(projectRoot);
    if (!out) return { ok: false, error: "No index.html found for this game." };
    return { ok: true, path: out };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("shell:open", (_e, p) => shell.openPath(p));
ipcMain.handle("shell:reveal", (_e, p) => shell.showItemInFolder(p));
ipcMain.handle("shell:openExternal", (_e, url) => shell.openExternal(url));

// ---- Unity: open a generated project directly in the Editor ----------------
ipcMain.handle("unity:locate", () => ({ exe: resolveUnityExe() || null }));
ipcMain.handle("unity:open", (_e, projectRoot) => {
  if (!projectRoot || !fs.existsSync(projectRoot)) return { ok: false, error: "Project folder not found." };
  const r = launchUnity(projectRoot);
  if (r.ok) return r;
  if (r.needsUnity) return { ok: false, needsUnity: true, error: "Unity Editor not found. Install Unity via Unity Hub, or point the app at your Unity.exe." };
  return r;
});
ipcMain.handle("unity:pickExe", async () => {
  const filters = process.platform === "win32"
    ? [{ name: "Unity", extensions: ["exe"] }]
    : [{ name: "Unity", extensions: ["*"] }];
  const r = await dialog.showOpenDialog({ title: "Select your Unity Editor executable", properties: ["openFile"], filters });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const c = loadConfig(); c.unityPath = r.filePaths[0]; saveConfig(c);
  return { ok: true, exe: r.filePaths[0] };
});

// Run a Web game off-screen and collect runtime / console errors (auto QA).
ipcMain.handle("web:check", (_e, filePath) => new Promise((resolve) => {
  let done = false, win = null;
  const errors = [];
  const finish = () => { if (done) return; done = true; try { if (win && !win.isDestroyed()) win.destroy(); } catch {} resolve({ ok: true, errors }); };
  try {
    if (!filePath || !fs.existsSync(filePath)) return resolve({ ok: false, error: "Nothing to check yet." });
    win = new BrowserWindow({ show: false, width: 640, height: 480, webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const onConsole = (...args) => {
      // Electron <30: (event, level, message, …); newer: (event, {level, message})
      let level, message;
      if (args[1] && typeof args[1] === "object") { level = args[1].level; message = args[1].message; }
      else { level = args[1]; message = args[2]; }
      const isErr = level === 3 || level === "error";
      if (isErr && message) { const m = String(message).trim(); if (m && !errors.includes(m)) errors.push(m.slice(0, 400)); }
    };
    win.webContents.on("console-message", onConsole);
    win.webContents.on("render-process-gone", () => { errors.push("The game crashed (renderer process gone)."); finish(); });
    win.webContents.once("did-fail-load", (_e2, code, desc) => { if (code !== -3) errors.push("Failed to load: " + (desc || code)); });
    win.loadFile(filePath);
    setTimeout(finish, 3200); // let the game boot + first frames run
  } catch (e) { resolve({ ok: false, error: e.message }); }
}));

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
  const meta = loadMeta();
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
    const tags = (meta[name] && Array.isArray(meta[name].tags)) ? meta[name].tags : [];
    out.push({ name, path: full, engine, openTarget, mtime: st.mtimeMs, thumb, tags });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
});
// Set the tags (a "collection") for a project folder.
ipcMain.handle("projects:setTags", (_e, { name, tags }) => {
  if (!name || typeof name !== "string") return { ok: false, error: "Missing project." };
  const clean = sanitizeTags(tags);
  const m = loadMeta();
  if (clean.length) m[name] = { ...(m[name] || {}), tags: clean };
  else if (m[name]) { delete m[name].tags; if (!Object.keys(m[name]).length) delete m[name]; }
  saveMeta(m);
  return { ok: true, tags: clean };
});
