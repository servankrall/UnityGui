// =============================================================================
//  UnityGUI Desktop — Electron main process
//  Generate Unity games from a prompt using a FREE AI provider (no paid Claude
//  key required). Supported providers:
//    • Google Gemini  — free API key from aistudio.google.com (no credit card)
//    • Groq           — free API key from console.groq.com (fast Llama models)
//    • Ollama         — 100% free, runs locally on your machine (no key)
//  The API call happens here (main process) so there are no CORS/key issues.
// =============================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");

// ---- Providers (all free) --------------------------------------------------
const PROVIDERS = {
  gemini: {
    label: "Google Gemini — free",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "Free API key from Google AI Studio — no credit card.",
    needsKey: true,
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash",
  },
  groq: {
    label: "Groq — free & fast",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "Free API key from Groq — no credit card.",
    needsKey: true,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
    defaultModel: "llama-3.3-70b-versatile",
  },
  ollama: {
    label: "Ollama — local, offline, no key",
    keyUrl: "https://ollama.com/download",
    keyHint: "Runs models on your own PC. Install Ollama, then: ollama pull qwen2.5-coder",
    needsKey: false,
    models: ["qwen2.5-coder:7b", "llama3.1:8b", "codellama:13b", "deepseek-coder-v2:16b"],
    defaultModel: "qwen2.5-coder:7b",
  },
};

// ---- Config store ----------------------------------------------------------
function loadConfig() {
  let c;
  try { c = JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8")); } catch { c = {}; }
  if (!c.provider || !PROVIDERS[c.provider]) c.provider = "gemini";
  if (!c.keys || typeof c.keys !== "object") c.keys = {};
  if (!c.model) c.model = PROVIDERS[c.provider].defaultModel;
  if (!c.style) c.style = "auto";
  return c;
}
function saveConfig(c) {
  try { fs.writeFileSync(CONFIG_PATH(), JSON.stringify(c, null, 2)); return true; }
  catch { return false; }
}
function isConnected(c) {
  return PROVIDERS[c.provider].needsKey ? !!(c.keys && c.keys[c.provider]) : true;
}

// ---- Window ----------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1040, height: 780, minWidth: 720, minHeight: 560,
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

// ---- IPC -------------------------------------------------------------------
ipcMain.handle("providers:get", () => PROVIDERS);

ipcMain.handle("config:get", () => {
  const c = loadConfig();
  return { provider: c.provider, connected: isConnected(c), model: c.model, style: c.style };
});

ipcMain.handle("config:save", (_e, patch) => {
  const c = loadConfig();
  if (patch.provider && PROVIDERS[patch.provider]) c.provider = patch.provider;
  if (patch.model) c.model = patch.model;
  if (patch.style) c.style = patch.style;
  if (patch.apiKey !== undefined) { c.keys = c.keys || {}; c.keys[c.provider] = patch.apiKey; }
  return saveConfig(c);
});

ipcMain.handle("config:disconnect", () => {
  const c = loadConfig();
  if (c.keys) c.keys[c.provider] = "";
  return saveConfig(c);
});

ipcMain.handle("connect:test", async (_e, { provider, apiKey, model }) => {
  try {
    const text = await callLLM(provider, apiKey, model || PROVIDERS[provider].defaultModel,
      "You are a connectivity check.", "Reply with the single word OK.", false, 20);
    return { ok: true, sample: (text || "").trim().slice(0, 40) };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle("generate", async (_e, { prompt, model, style }) => {
  const c = loadConfig();
  const key = c.keys ? c.keys[c.provider] : "";
  if (PROVIDERS[c.provider].needsKey && !key)
    return { ok: false, error: "Not connected. Add your free API key first." };
  try {
    const system = buildSystemPrompt(style || c.style || "auto");
    const text = await callLLM(c.provider, key, model || c.model, system, prompt, true, 16000);
    const data = parseResult(text);
    if (!data || !Array.isArray(data.files) || data.files.length === 0)
      return { ok: false, error: "The model returned no files. Try a more specific prompt or another model." };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle("dialog:pickFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("project:save", (_e, { gameName, files, dir }) => {
  try { return { ok: true, path: writeUnityProject(dir, gameName, files) }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle("shell:open", (_e, p) => shell.openPath(p));
ipcMain.handle("shell:openExternal", (_e, url) => shell.openExternal(url));

// ---- LLM dispatch (free providers) -----------------------------------------
async function httpJson(url, options, timeoutMs = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try { res = await fetch(url, { ...options, signal: controller.signal }); }
  catch (e) { clearTimeout(timer); throw new Error(e.name === "AbortError" ? "Request timed out." : "Network error: " + e.message); }
  clearTimeout(timer);
  const raw = await res.text();
  return { ok: res.ok, status: res.status, raw };
}

async function callLLM(provider, apiKey, model, system, prompt, jsonMode, maxTokens) {
  if (provider === "gemini") return callGemini(apiKey, model, system, prompt, jsonMode, maxTokens);
  if (provider === "groq") return callGroq(apiKey, model, system, prompt, jsonMode, maxTokens);
  if (provider === "ollama") return callOllama(model, system, prompt, jsonMode, maxTokens);
  throw new Error("Unknown provider: " + provider);
}

async function callGemini(apiKey, model, system, prompt, jsonMode, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
  };
  if (jsonMode) body.generationConfig.responseMimeType = "application/json";
  const { ok, status, raw } = await httpJson(url, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!ok) throw new Error(apiError(raw, status, "gemini"));
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Gemini response."); }
  if (j.promptFeedback && j.promptFeedback.blockReason)
    throw new Error("Gemini blocked the prompt (" + j.promptFeedback.blockReason + "). Rephrase it.");
  const cand = (j.candidates || [])[0];
  const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
  const text = parts.map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini returned no text (finishReason: " + (cand && cand.finishReason) + ").");
  return text;
}

async function callGroq(apiKey, model, system, prompt, jsonMode, maxTokens) {
  const body = {
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    max_tokens: maxTokens, temperature: 0.8,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const { ok, status, raw } = await httpJson("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
    body: JSON.stringify(body),
  });
  if (!ok) throw new Error(apiError(raw, status, "groq"));
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Groq response."); }
  const text = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
  if (!text) throw new Error("Groq returned no text.");
  return text;
}

async function callOllama(model, system, prompt, jsonMode, maxTokens) {
  const base = process.env.OLLAMA_HOST || "http://localhost:11434";
  const body = {
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    stream: false, options: { num_predict: maxTokens },
  };
  if (jsonMode) body.format = "json";
  let r;
  try { r = await httpJson(base.replace(/\/$/, "") + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Couldn't reach Ollama at " + base + ". Is Ollama running? (install from ollama.com)"); }
  if (!r.ok) throw new Error(apiError(r.raw, r.status, "ollama"));
  let j; try { j = JSON.parse(r.raw); } catch { throw new Error("Could not parse Ollama response."); }
  const text = j.message && j.message.content ? j.message.content : "";
  if (!text) throw new Error("Ollama returned no text. Try: ollama pull " + model);
  return text;
}

function apiError(raw, status, provider) {
  try {
    const j = JSON.parse(raw);
    const m = (j.error && (j.error.message || j.error)) || j.message;
    if (m) return `${provider} error (${status}): ${typeof m === "string" ? m : JSON.stringify(m)}`;
  } catch {}
  return `${provider} request failed (${status}).`;
}

// ---- Generation prompt (self-bootstrapping, provider-agnostic) --------------
function buildSystemPrompt(style) {
  const styleLine = style === "2d"
    ? "Make a 2D game (orthographic camera, sprites/quads)."
    : style === "3d"
    ? "Make a 3D game (perspective camera, primitives, a directional light)."
    : "Choose 2D or 3D based on what best fits the request.";
  return `You are an expert Unity gameplay engineer. From the user's description you generate a COMPLETE, PLAYABLE Unity game as one or more C# scripts for a fresh Unity project.

TARGET
- Unity 2021 LTS or newer, Built-in Render Pipeline, legacy Input Manager (UnityEngine.Input), UnityEngine.UI. Pure C# only; no external packages, prefabs, textures, models, or .unity scene files.
- ${styleLine}

SELF-BOOTSTRAPPING (critical)
- The game MUST run when the user opens the project and presses Play in an empty scene, with no manual setup.
- Include ONE bootstrap MonoBehaviour with:
      [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
      static void Boot() { ... }
  In Boot(), create a GameObject and build the whole game from code: camera, lights, player, level, enemies/obstacles and UI, using GameObject.CreatePrimitive, procedural meshes/materials, and primitive colliders.
- Draw the HUD/instructions with UnityEngine.UI (built at runtime) or OnGUI.

CODE RULES
- Namespace every type under UnityGUI.Generated. Do NOT use the UnityEditor namespace.
- Every file path must be under "Assets/UnityGUI/Generated/" and end with ".cs".
- Produce COMPILING code: complete, valid C#, no TODOs, no placeholders, no ellipses.
- Wire real input, a clear objective, and a win/lose or score loop.

OUTPUT — respond with ONLY a single JSON object, no markdown and no code fences, with EXACTLY these keys:
  "game_name": string,
  "summary": string,
  "setup_notes": string (how to play: controls + objective),
  "files": array of objects, each { "path": string (under Assets/UnityGUI/Generated/, ends with .cs), "content": string (the full C# source) }
Do not include XML tags such as <thinking>.`;
}

function parseResult(text) {
  let s = String(text).trim();
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n"); if (nl >= 0) s = s.slice(nl + 1);
    if (s.endsWith("```")) s = s.slice(0, -3);
    s = s.trim();
  }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// ---- Unity project writer --------------------------------------------------
function sanitize(name) {
  return (name || "Game").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "") || "Game";
}
function writeUnityProject(baseDir, gameName, files) {
  const projName = sanitize(gameName);
  const root = path.join(baseDir, "UnityGUI-" + projName);
  fs.mkdirSync(path.join(root, "Assets", "UnityGUI", "Generated"), { recursive: true });
  fs.mkdirSync(path.join(root, "ProjectSettings"), { recursive: true });
  fs.mkdirSync(path.join(root, "Packages"), { recursive: true });

  const assetsRoot = path.resolve(path.join(root, "Assets"));
  for (const f of files) {
    if (!f || !f.path || typeof f.content !== "string") continue;
    let rel = f.path.replace(/\\/g, "/").replace(/^\/+/, "");
    const fileName = path.basename(rel);
    if (!fileName.toLowerCase().endsWith(".cs")) continue;
    let sub = "";
    const marker = "Assets/UnityGUI/Generated/";
    if (rel.startsWith(marker)) sub = path.dirname(rel.slice(marker.length));
    if (sub === ".") sub = "";
    const targetDir = path.resolve(path.join(root, "Assets", "UnityGUI", "Generated", sub));
    if (!targetDir.startsWith(assetsRoot)) continue;
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, fileName), f.content, "utf8");
  }

  fs.writeFileSync(path.join(root, "ProjectSettings", "ProjectVersion.txt"),
    "m_EditorVersion: 2022.3.40f1\nm_EditorVersionWithRevision: 2022.3.40f1 (some-revision)\n", "utf8");
  fs.writeFileSync(path.join(root, "Packages", "manifest.json"),
    JSON.stringify({ dependencies: { "com.unity.ugui": "1.0.0", "com.unity.modules.ui": "1.0.0", "com.unity.modules.physics": "1.0.0", "com.unity.modules.physics2d": "1.0.0" } }, null, 2), "utf8");
  fs.writeFileSync(path.join(root, "HOW-TO-PLAY.txt"),
    `${gameName}\n\n1. Open Unity Hub -> Add -> select this folder (UnityGUI-${projName}).\n2. Open it with Unity 2021 LTS or newer.\n3. Press Play. The game builds itself and runs.\n`, "utf8");
  return root;
}
