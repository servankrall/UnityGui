// =============================================================================
//  UnityGUI Desktop — Electron main process
//  Connect your Anthropic key once, describe a game, and generate a ready-to-open
//  Unity project. The Claude API is called here (main process) so there are no
//  CORS or key-exposure issues in the renderer.
// =============================================================================
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const CONFIG_PATH = () => path.join(app.getPath("userData"), "config.json");
const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// ---- Config store ----------------------------------------------------------
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8")); }
  catch { return { apiKey: "", model: "claude-opus-5", style: "auto" }; }
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_PATH(), JSON.stringify(cfg, null, 2)); return true; }
  catch { return false; }
}

// ---- Window ----------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#0a0d14",
    title: "UnityGUI",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ---- IPC -------------------------------------------------------------------
ipcMain.handle("config:get", () => {
  const c = loadConfig();
  return { hasKey: !!c.apiKey, model: c.model || "claude-opus-5", style: c.style || "auto" };
});

ipcMain.handle("config:save", (_e, { apiKey, model, style }) => {
  const c = loadConfig();
  if (apiKey !== undefined) c.apiKey = apiKey;
  if (model) c.model = model;
  if (style) c.style = style;
  return saveConfig(c);
});

ipcMain.handle("config:disconnect", () => {
  const c = loadConfig(); c.apiKey = ""; return saveConfig(c);
});

ipcMain.handle("connect:test", async (_e, { apiKey, model }) => {
  // A tiny request just to confirm the key/model works.
  try {
    const text = await callClaude(apiKey, model || "claude-opus-5", "You are a connectivity check.",
      "Reply with the single word: OK", null, 16);
    return { ok: true, sample: (text || "").trim().slice(0, 40) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("generate", async (_e, { prompt, model, style }) => {
  const cfg = loadConfig();
  if (!cfg.apiKey) return { ok: false, error: "Not connected. Add your API key first." };
  try {
    const system = buildSystemPrompt(style || "auto");
    const text = await callClaude(cfg.apiKey, model || cfg.model || "claude-opus-5",
      system, prompt, GAME_SCHEMA, 16000);
    const data = parseResult(text);
    if (!data || !Array.isArray(data.files) || data.files.length === 0)
      return { ok: false, error: "The model returned no files. Try a more specific prompt." };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("dialog:pickFolder", async () => {
  const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle("project:save", (_e, { gameName, files, dir }) => {
  try {
    const projectPath = writeUnityProject(dir, gameName, files);
    return { ok: true, path: projectPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("shell:open", (_e, p) => shell.openPath(p));

// ---- Claude API ------------------------------------------------------------
async function callClaude(apiKey, model, system, userPrompt, schema, maxTokens) {
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userPrompt }],
  };
  if (schema) body.output_config = { format: { type: "json_schema", schema: JSON.parse(schema) } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300000); // 5 min
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e.name === "AbortError" ? "Request timed out." : "Network error: " + e.message);
  }
  clearTimeout(timer);

  const raw = await res.text();
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`;
    try { const j = JSON.parse(raw); if (j.error && j.error.message) msg = `${j.error.type}: ${j.error.message}`; } catch {}
    throw new Error(msg);
  }
  let json;
  try { json = JSON.parse(raw); } catch { throw new Error("Could not parse the API response."); }
  if (json.stop_reason === "refusal") throw new Error("The model declined this request. Try rephrasing.");
  const text = (json.content || []).filter(b => b && b.type === "text").map(b => b.text).join("");
  if (!text) throw new Error("The model returned no text.");
  return text;
}

// ---- Generation prompt + schema (Lite / self-bootstrapping) ----------------
const GAME_SCHEMA = JSON.stringify({
  type: "object",
  additionalProperties: false,
  properties: {
    game_name: { type: "string" },
    summary: { type: "string" },
    setup_notes: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  required: ["game_name", "summary", "setup_notes", "files"],
});

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

OUTPUT (structured JSON): game_name, summary, setup_notes (how to play), and files.
Do not include markdown, code fences, or XML tags such as <thinking>.`;
}

function parseResult(text) {
  let s = String(text).trim();
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    if (nl >= 0) s = s.slice(nl + 1);
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
    // Keep any sub-folders below Assets/UnityGUI/Generated
    let sub = "";
    const marker = "Assets/UnityGUI/Generated/";
    if (rel.startsWith(marker)) sub = path.dirname(rel.slice(marker.length));
    if (sub === ".") sub = "";
    const targetDir = path.resolve(path.join(root, "Assets", "UnityGUI", "Generated", sub));
    if (!targetDir.startsWith(assetsRoot)) continue; // path-traversal guard
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, fileName), f.content, "utf8");
  }

  // Minimal project scaffolding so Unity Hub can open the folder.
  fs.writeFileSync(
    path.join(root, "ProjectSettings", "ProjectVersion.txt"),
    "m_EditorVersion: 2022.3.40f1\nm_EditorVersionWithRevision: 2022.3.40f1 (some-revision)\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "Packages", "manifest.json"),
    JSON.stringify({ dependencies: { "com.unity.ugui": "1.0.0", "com.unity.modules.ui": "1.0.0", "com.unity.modules.physics": "1.0.0", "com.unity.modules.physics2d": "1.0.0" } }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "HOW-TO-PLAY.txt"),
    `${gameName}\n\n1. Open Unity Hub → Add → select this folder (UnityGUI-${projName}).\n2. Open it with Unity 2021 LTS or newer.\n3. Press Play. The game builds itself and runs.\n`,
    "utf8"
  );

  return root;
}
