// =============================================================================
//  Project writers — turn a generated result into files on disk.
//    • Unity  → a full project (scripts, ProjectSettings, Packages)
//    • Roblox → a ready-to-open .rbxlx place file (+ raw .luau fallbacks)
// =============================================================================
const path = require("path");
const fs = require("fs");

function sanitize(name) {
  return (name || "Game").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "") || "Game";
}

// Resolve `rel` inside `root`, returning null if it would escape (path-traversal guard).
function safeJoin(root, rel) {
  const rootR = path.resolve(root);
  const target = path.resolve(path.join(rootR, String(rel || "").replace(/\\/g, "/")));
  return target === rootR || target.startsWith(rootR + path.sep) ? target : null;
}

function writeProject(engine, baseDir, data, opts = {}) {
  fs.mkdirSync(baseDir, { recursive: true });
  if (engine === "roblox") return writeRobloxPlace(baseDir, data, opts);
  if (engine === "web") return writeWebProject(baseDir, data, opts);
  return writeUnityProject(baseDir, data, opts);
}

function writeWebProject(baseDir, data, opts = {}) {
  const projName = sanitize(data.game_name);
  const root = path.join(baseDir, "Web-" + projName);
  fs.mkdirSync(root, { recursive: true });
  const rootResolved = path.resolve(root);
  let indexPath = null;
  let written = 0;
  // A reference image → assets/reference.png so a relative sprite path resolves.
  if (opts.image && opts.image.base64) {
    try { fs.mkdirSync(path.join(root, "assets"), { recursive: true }); fs.writeFileSync(path.join(root, "assets", "reference.png"), Buffer.from(opts.image.base64, "base64")); } catch {}
  }
  for (const f of data.files || []) {
    if (!f || f.content == null) continue;
    let rel = String(f.path || f.name || "index.html").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!/\.[a-z0-9]+$/i.test(rel)) rel += ".html";
    const target = path.resolve(path.join(root, rel));
    if (!target.startsWith(rootResolved)) continue; // path-traversal guard
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content, "utf8");
    written++;
    if (!indexPath && /(^|\/)index\.html$/i.test(rel)) indexPath = target;
    if (!indexPath && /\.html?$/i.test(rel)) indexPath = target; // first html as fallback
  }
  if (!indexPath) { // ensure something is openable
    indexPath = path.join(root, "index.html");
    fs.writeFileSync(indexPath, `<!doctype html><meta charset="utf8"><title>${xmlEsc(data.game_name || "Game")}</title><p>No index.html was generated.</p>`, "utf8");
  }
  fs.writeFileSync(path.join(root, "HOW-TO-PLAY.txt"), `${data.game_name}\n\nJust double-click index.html to play in your browser — no engine, no install needed.\n${data.setup_notes ? "\n" + data.setup_notes + "\n" : ""}`, "utf8");
  return { root, openTarget: indexPath, written };
}

function writeUnityProject(baseDir, data, opts = {}) {
  const projName = sanitize(data.game_name);
  const root = path.join(baseDir, "Unity-" + projName);
  const genDir = path.join(root, "Assets", "UnityGUI", "Generated");
  fs.mkdirSync(genDir, { recursive: true });
  // A reference image → Resources so the game can Resources.Load<Texture2D>("reference").
  if (opts.image && opts.image.base64) {
    try { const resDir = path.join(genDir, "Resources"); fs.mkdirSync(resDir, { recursive: true }); fs.writeFileSync(path.join(resDir, "reference.png"), Buffer.from(opts.image.base64, "base64")); } catch {}
  }
  fs.mkdirSync(path.join(root, "ProjectSettings"), { recursive: true });
  fs.mkdirSync(path.join(root, "Packages"), { recursive: true });
  const assetsRoot = path.resolve(path.join(root, "Assets"));
  let written = 0;
  for (const f of data.files || []) {
    if (!f || f.content == null) continue;
    const rel = String(f.path || f.name || "").replace(/\\/g, "/");
    const fileName = path.basename(rel).endsWith(".cs") ? path.basename(rel) : (sanitize(f.name || "Script") + ".cs");
    const target = path.resolve(path.join(genDir, fileName));
    if (!target.startsWith(assetsRoot)) continue; // path-traversal guard
    fs.writeFileSync(target, f.content, "utf8");
    written++;
  }
  fs.writeFileSync(path.join(root, "ProjectSettings", "ProjectVersion.txt"), "m_EditorVersion: 2022.3.40f1\nm_EditorVersionWithRevision: 2022.3.40f1 (some-revision)\n", "utf8");
  fs.writeFileSync(path.join(root, "Packages", "manifest.json"), JSON.stringify({ dependencies: { "com.unity.ugui": "1.0.0", "com.unity.modules.ui": "1.0.0", "com.unity.modules.physics": "1.0.0", "com.unity.modules.physics2d": "1.0.0" } }, null, 2), "utf8");
  fs.writeFileSync(path.join(root, "HOW-TO-PLAY.txt"), `${data.game_name}\n\nOpen this folder in Unity Hub (Add), open with Unity 2021 LTS+, press Play.\n${data.setup_notes ? "\n" + data.setup_notes + "\n" : ""}`, "utf8");
  return { root, openTarget: root, written };
}

function writeRobloxPlace(baseDir, data, opts = {}) {
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
  fs.writeFileSync(path.join(root, "HOW-TO-PLAY.txt"), `${data.game_name}\n\nDouble-click ${projName}.rbxlx to open it in Roblox Studio, then press Play.\n(If it doesn't open, install Roblox Studio, or paste the scripts from the Scripts/ folder.)\n${data.setup_notes ? "\n" + data.setup_notes + "\n" : ""}`, "utf8");
  return { root, openTarget: placePath, written: server.length + local.length + module.length };
}

// ---- .rbxlx (Roblox place XML) builder -------------------------------------
function cdata(s) { return "<![CDATA[" + String(s).replace(/]]>/g, "]]]]><![CDATA[>") + "]]>"; }
function xmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

let _ref = 0;
function scriptItem(className, name, source) {
  return `      <Item class="${className}" referent="RBX${_ref++}">
        <Properties>
          <string name="Name">${xmlEsc(name)}</string>
          <ProtectedString name="Source">${cdata(source)}</ProtectedString>
        </Properties>
      </Item>`;
}
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

// ---- Single-file HTML export (Web) -----------------------------------------
function mimeForExt(ext) {
  ext = ext.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp"
    : ext === "gif" ? "image/gif" : ext === "svg" ? "image/svg+xml" : ext === "bmp" ? "image/bmp" : "image/png";
}
// Inline local image assets referenced from the HTML as data: URIs so the whole
// game is a single portable .html file. `readAsset(relPath)` returns a Buffer|null.
function inlineHtmlAssets(html, readAsset) {
  return String(html).replace(/(src|href)\s*=\s*(["'])([^"']+?\.(?:png|jpe?g|gif|webp|svg|bmp))\2/gi, (m, attr, q, rel) => {
    if (/^(data:|https?:|\/\/)/i.test(rel)) return m; // already inline / remote
    let buf = null;
    try { buf = readAsset(rel.replace(/^\.?\//, "")); } catch { buf = null; }
    if (!buf) return m;
    const ext = rel.split(".").pop();
    return `${attr}=${q}data:${mimeForExt(ext)};base64,${buf.toString("base64")}${q}`;
  });
}
// Build a standalone single-file HTML from a written Web project. Returns the
// path to the new "<Game>-standalone.html", or null if there's no index.html.
function writeStandaloneHtml(projectRoot) {
  const index = path.join(projectRoot, "index.html");
  if (!fs.existsSync(index)) return null;
  const html = fs.readFileSync(index, "utf8");
  const inlined = inlineHtmlAssets(html, (rel) => {
    const p = path.resolve(path.join(projectRoot, rel));
    if (!p.startsWith(path.resolve(projectRoot))) return null; // stay inside the project
    return fs.existsSync(p) ? fs.readFileSync(p) : null;
  });
  const base = path.basename(projectRoot).replace(/^Web-/, "") || "game";
  const out = path.join(projectRoot, base + "-standalone.html");
  fs.writeFileSync(out, inlined, "utf8");
  return out;
}

module.exports = {
  sanitize, safeJoin, writeProject, writeUnityProject, writeRobloxPlace, writeWebProject,
  buildRbxlx, cdata, xmlEsc, inlineHtmlAssets, writeStandaloneHtml, mimeForExt,
};
