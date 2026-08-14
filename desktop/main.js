// =============================================================================
//  UnityGUI Desktop — Electron main process
//  Generate Unity AND Roblox games from a prompt, for FREE (Gemini/Groq/Ollama).
//  Conversations (chat history + refine), and one-click auto-open into the engine.
// =============================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const CONVOS_PATH = () => path.join(app.getPath("userData"), "conversations.json");
const DEFAULT_OUT = () => path.join(app.getPath("documents"), "UnityGUI Games");

// ---- Providers (all free) --------------------------------------------------
const PROVIDERS = {
  gemini: {
    label: "Google Gemini — free",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "Free API key from Google AI Studio — no credit card.",
    needsKey: true,
    // Current models (the old 1.5 ids were retired — those caused the errors).
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"],
    defaultModel: "gemini-2.5-flash",
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

const ENGINES = { unity: "Unity (C#)", roblox: "Roblox Studio (Luau)" };

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
function isConnected(c) { return PROVIDERS[c.provider].needsKey ? !!(c.keys && c.keys[c.provider]) : true; }

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
ipcMain.handle("providers:get", () => ({ providers: PROVIDERS, engines: ENGINES }));
ipcMain.handle("config:get", () => {
  const c = loadConfig();
  return { provider: c.provider, connected: isConnected(c), model: c.model, engine: c.engine, style: c.style, autoOpen: c.autoOpen };
});
ipcMain.handle("config:save", (_e, patch) => {
  const c = loadConfig();
  if (patch.provider && PROVIDERS[patch.provider]) c.provider = patch.provider;
  if (patch.model) c.model = patch.model;
  if (patch.engine && ENGINES[patch.engine]) c.engine = patch.engine;
  if (patch.style) c.style = patch.style;
  if (typeof patch.autoOpen === "boolean") c.autoOpen = patch.autoOpen;
  if (patch.apiKey !== undefined) { c.keys = c.keys || {}; c.keys[c.provider] = patch.apiKey; }
  return saveConfig(c);
});
ipcMain.handle("config:disconnect", () => { const c = loadConfig(); if (c.keys) c.keys[c.provider] = ""; return saveConfig(c); });

ipcMain.handle("connect:test", async (_e, { provider, apiKey, model }) => {
  try {
    const text = await callLLM(provider, apiKey, model || PROVIDERS[provider].defaultModel, "You are a connectivity check.", "Reply with the single word OK.", false, 20);
    return { ok: true, sample: (text || "").trim().slice(0, 40) };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ---- IPC: conversations ----------------------------------------------------
ipcMain.handle("convos:list", () => loadConvos().map(c => ({ id: c.id, title: c.title, engine: c.engine, updatedAt: c.updatedAt, turns: c.turns.length })));
ipcMain.handle("convos:get", (_e, id) => getConvo(id) || null);
ipcMain.handle("convos:delete", (_e, id) => { saveConvos(loadConvos().filter(c => c.id !== id)); return true; });

// ---- IPC: generate (with refine + conversation) ----------------------------
ipcMain.handle("generate", async (_e, { prompt, conversationId }) => {
  const c = loadConfig();
  const key = c.keys ? c.keys[c.provider] : "";
  if (PROVIDERS[c.provider].needsKey && !key) return { ok: false, error: "Not connected. Add your free API key first." };

  let convo = conversationId ? getConvo(conversationId) : null;
  const engine = convo ? convo.engine : c.engine;

  try {
    const system = buildSystemPrompt(engine, c.style);
    const userMsg = convo && convo.turns.length
      ? buildRefinePrompt(convo.turns[convo.turns.length - 1].result, prompt)
      : prompt;
    const text = await callLLM(c.provider, key, c.model, system, userMsg, true, 16000);
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
        saved = writeProject(engine, DEFAULT_OUT(), data);
        shell.openPath(saved.openTarget);
      } catch (e) { saved = { error: e.message }; }
    }
    return { ok: true, data, conversationId: convo.id, saved };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle("dialog:pickFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle("project:save", (_e, { engine, data, dir }) => {
  try { const s = writeProject(engine, dir, data); return { ok: true, path: s.root, openTarget: s.openTarget }; }
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
  return { ok: res.ok, status: res.status, raw: await res.text() };
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
  const { ok, status, raw } = await httpJson(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!ok) throw new Error(apiError(raw, status, "Gemini"));
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Gemini response."); }
  if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error("Gemini blocked the prompt (" + j.promptFeedback.blockReason + "). Rephrase it.");
  const cand = (j.candidates || [])[0];
  const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
  const text = parts.map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini returned no text (finishReason: " + (cand && cand.finishReason) + ").");
  return text;
}
async function callGroq(apiKey, model, system, prompt, jsonMode, maxTokens) {
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.8 };
  if (jsonMode) body.response_format = { type: "json_object" };
  const { ok, status, raw } = await httpJson("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + apiKey }, body: JSON.stringify(body),
  });
  if (!ok) throw new Error(apiError(raw, status, "Groq"));
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Groq response."); }
  const text = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
  if (!text) throw new Error("Groq returned no text.");
  return text;
}
async function callOllama(model, system, prompt, jsonMode, maxTokens) {
  const base = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], stream: false, options: { num_predict: maxTokens } };
  if (jsonMode) body.format = "json";
  let r;
  try { r = await httpJson(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Couldn't reach Ollama at " + base + ". Is Ollama running? (install from ollama.com)"); }
  if (!r.ok) throw new Error(apiError(r.raw, r.status, "Ollama"));
  let j; try { j = JSON.parse(r.raw); } catch { throw new Error("Could not parse Ollama response."); }
  const text = j.message && j.message.content ? j.message.content : "";
  if (!text) throw new Error("Ollama returned no text. Try: ollama pull " + model);
  return text;
}
function apiError(raw, status, provider) {
  try { const j = JSON.parse(raw); const m = (j.error && (j.error.message || j.error)) || j.message; if (m) return `${provider} error (${status}): ${typeof m === "string" ? m : JSON.stringify(m)}`; } catch {}
  return `${provider} request failed (${status}).`;
}

// ---- Prompts ---------------------------------------------------------------
function styleLine(style) {
  return style === "2d" ? "Make a 2D game." : style === "3d" ? "Make a 3D game." : "Choose 2D or 3D based on what best fits the request.";
}
function buildSystemPrompt(engine, style) {
  if (engine === "roblox") {
    return `You are an expert Roblox game engineer. From the user's description you generate a COMPLETE, PLAYABLE Roblox experience as Luau scripts.

RULES
- Pure Luau for Roblox Studio. Build the whole game FROM CODE at runtime: a server Script spawns parts, sets up the map, gameplay, scoring and win/lose; LocalScripts handle input and on-screen GUI (create GUI in code).
- ${styleLine(style)}
- Use Roblox services (game:GetService("Players"), Workspace, ReplicatedStorage, UserInputService, TweenService, RunService, etc.). Do NOT reference external assets or asset IDs.
- Complete, valid Luau — no TODOs, no placeholders. The game must work when the player presses Play.

OUTPUT — respond with ONLY a single JSON object, no markdown or code fences, with EXACTLY these keys:
  "game_name": string,
  "summary": string,
  "setup_notes": string (how to play),
  "files": array of objects, each { "name": string (script name), "kind": "server" | "local" | "module", "content": string (the Luau source) }
Put gameplay/world building in a "server" script, input/GUI in a "local" script, shared helpers in "module". Do not include XML tags such as <thinking>.`;
  }
  // Unity
  return `You are an expert Unity gameplay engineer. From the user's description you generate a COMPLETE, PLAYABLE Unity game as one or more C# scripts for a fresh Unity project.

RULES
- Unity 2021 LTS+, Built-in Render Pipeline, legacy Input Manager (UnityEngine.Input), UnityEngine.UI. Pure C# only; no external packages, prefabs, textures, models, or .unity scene files.
- ${styleLine(style)}
- SELF-BOOTSTRAPPING: include ONE MonoBehaviour with [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void Boot() { ... } that builds the whole game from code (camera, lights, player, level, enemies, UI) so pressing Play in an empty scene just works.
- Namespace types under UnityGUI.Generated. No UnityEditor usage. Complete, valid, compiling C# — no TODOs or placeholders.

OUTPUT — respond with ONLY a single JSON object, no markdown or code fences, with EXACTLY these keys:
  "game_name": string,
  "summary": string,
  "setup_notes": string (how to play),
  "files": array of objects, each { "path": string (under Assets/UnityGUI/Generated/, ends with .cs), "content": string (the full C# source) }
Do not include XML tags such as <thinking>.`;
}
function buildRefinePrompt(prevResult, instruction) {
  const files = (prevResult.files || []).map(f => {
    const name = f.path || f.name || "file";
    return `--- ${name} ---\n${f.content}`;
  }).join("\n\n");
  return `Here is the current game. Apply this change and return the FULL updated game as the same JSON shape (all files, complete):\n\nCHANGE REQUESTED: ${instruction}\n\nCURRENT FILES:\n${files}`;
}
function parseResult(text) {
  let s = String(text).trim();
  if (s.startsWith("```")) { const nl = s.indexOf("\n"); if (nl >= 0) s = s.slice(nl + 1); if (s.endsWith("```")) s = s.slice(0, -3); s = s.trim(); }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// ---- Project writers -------------------------------------------------------
function sanitize(name) { return (name || "Game").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "") || "Game"; }

function writeProject(engine, baseDir, data) {
  fs.mkdirSync(baseDir, { recursive: true });
  return engine === "roblox" ? writeRobloxPlace(baseDir, data) : writeUnityProject(baseDir, data);
}

function writeUnityProject(baseDir, data) {
  const projName = sanitize(data.game_name);
  const root = path.join(baseDir, "Unity-" + projName);
  const genDir = path.join(root, "Assets", "UnityGUI", "Generated");
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(path.join(root, "ProjectSettings"), { recursive: true });
  fs.mkdirSync(path.join(root, "Packages"), { recursive: true });
  const assetsRoot = path.resolve(path.join(root, "Assets"));
  for (const f of data.files || []) {
    if (!f || f.content == null) continue;
    const rel = String(f.path || f.name || "").replace(/\\/g, "/");
    const fileName = path.basename(rel).endsWith(".cs") ? path.basename(rel) : (sanitize(f.name || "Script") + ".cs");
    const target = path.resolve(path.join(genDir, fileName));
    if (!target.startsWith(assetsRoot)) continue;
    fs.writeFileSync(target, f.content, "utf8");
  }
  fs.writeFileSync(path.join(root, "ProjectSettings", "ProjectVersion.txt"), "m_EditorVersion: 2022.3.40f1\nm_EditorVersionWithRevision: 2022.3.40f1 (some-revision)\n", "utf8");
  fs.writeFileSync(path.join(root, "Packages", "manifest.json"), JSON.stringify({ dependencies: { "com.unity.ugui": "1.0.0", "com.unity.modules.ui": "1.0.0", "com.unity.modules.physics": "1.0.0", "com.unity.modules.physics2d": "1.0.0" } }, null, 2), "utf8");
  fs.writeFileSync(path.join(root, "HOW-TO-PLAY.txt"), `${data.game_name}\n\nOpen this folder in Unity Hub (Add), open with Unity 2021 LTS+, press Play.\n`, "utf8");
  return { root, openTarget: root };
}

function writeRobloxPlace(baseDir, data) {
  const projName = sanitize(data.game_name);
  const root = path.join(baseDir, "Roblox-" + projName);
  fs.mkdirSync(path.join(root, "Scripts"), { recursive: true });

  // also drop raw .luau files as a fallback
  const server = [], local = [], module = [];
  (data.files || []).forEach((f, i) => {
    if (!f || f.content == null) return;
    const kind = (f.kind || "server").toLowerCase();
    const nm = sanitize(f.name || f.path || ("Script" + i));
    const ext = kind === "local" ? ".client.luau" : kind === "module" ? ".module.luau" : ".server.luau";
    fs.writeFileSync(path.join(root, "Scripts", nm + ext), f.content, "utf8");
    (kind === "local" ? local : kind === "module" ? module : server).push({ name: nm, content: f.content });
  });

  const place = buildRbxlx(data.game_name, server, local, module);
  const placePath = path.join(root, projName + ".rbxlx");
  fs.writeFileSync(placePath, place, "utf8");
  fs.writeFileSync(path.join(root, "HOW-TO-PLAY.txt"), `${data.game_name}\n\nDouble-click ${projName}.rbxlx to open it in Roblox Studio, then press Play.\n(If it doesn't open, install Roblox Studio, or paste the scripts from the Scripts/ folder.)\n`, "utf8");
  return { root, openTarget: placePath };
}

function cdata(s) { return "<![CDATA[" + String(s).replace(/]]>/g, "]]]]><![CDATA[>") + "]]>"; }
let _ref = 0;
function scriptItem(className, name, source) {
  return `      <Item class="${className}" referent="RBX${_ref++}">
        <Properties>
          <string name="Name">${xmlEsc(name)}</string>
          <ProtectedString name="Source">${cdata(source)}</ProtectedString>
        </Properties>
      </Item>`;
}
function xmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function service(className, inner) {
  return `  <Item class="${className}" referent="RBX${_ref++}">
    <Properties></Properties>
${inner || ""}  </Item>`;
}
function buildRbxlx(gameName, server, local, module) {
  _ref = 0;
  const serverItems = server.map(s => scriptItem("Script", s.name, s.content)).join("\n");
  const localItems = local.map(s => scriptItem("LocalScript", s.name, s.content)).join("\n");
  const moduleItems = module.map(s => scriptItem("ModuleScript", s.name, s.content)).join("\n");

  const workspace = `  <Item class="Workspace" referent="RBX${_ref++}">
    <Properties><bool name="FilteringEnabled">true</bool></Properties>
    <Item class="Part" referent="RBX${_ref++}">
      <Properties>
        <string name="Name">Baseplate</string>
        <bool name="Anchored">true</bool>
        <Color3uint8 name="Color3uint8">4288387995</Color3uint8>
        <CoordinateFrame name="CFrame"><X>0</X><Y>-4</Y><Z>0</Z><R00>1</R00><R01>0</R01><R02>0</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>0</R20><R21>0</R21><R22>1</R22></CoordinateFrame>
        <Vector3 name="size"><X>512</X><Y>8</Y><Z>512</Z></Vector3>
      </Properties>
    </Item>
    <Item class="SpawnLocation" referent="RBX${_ref++}">
      <Properties>
        <string name="Name">SpawnLocation</string>
        <bool name="Anchored">true</bool>
        <CoordinateFrame name="CFrame"><X>0</X><Y>1</Y><Z>0</Z><R00>1</R00><R01>0</R01><R02>0</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>0</R20><R21>0</R21><R22>1</R22></CoordinateFrame>
        <Vector3 name="size"><X>12</X><Y>1</Y><Z>12</Z></Vector3>
      </Properties>
    </Item>
  </Item>`;

  return `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
${workspace}
${service("Lighting")}
${service("ReplicatedStorage", moduleItems ? moduleItems + "\n" : "")}
${service("ServerScriptService", serverItems ? serverItems + "\n" : "")}
${service("StarterGui")}
${service("StarterPack")}
  <Item class="StarterPlayer" referent="RBX${_ref++}">
    <Properties></Properties>
    <Item class="StarterPlayerScripts" referent="RBX${_ref++}">
      <Properties></Properties>
${localItems ? localItems + "\n" : ""}    </Item>
  </Item>
${service("Players")}
</roblox>`;
}
