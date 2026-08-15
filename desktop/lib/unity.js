// =============================================================================
//  Locate an installed Unity Editor so the app can open a generated project
//  directly (no Unity Hub "Add" step). Pure helpers here are unit-tested;
//  findUnityExe() touches the filesystem.
// =============================================================================
const fs = require("fs");
const path = require("path");
const os = require("os");

function parseVersion(name) {
  const m = String(name).match(/(\d+)\.(\d+)\.(\d+)(?:[a-z](\d+))?/i);
  return m ? [+m[1], +m[2], +m[3], m[4] ? +m[4] : 0] : [0, 0, 0, 0];
}
function cmpVersion(a, b) {
  const va = parseVersion(a), vb = parseVersion(b);
  for (let i = 0; i < 4; i++) if (va[i] !== vb[i]) return va[i] - vb[i];
  return String(a).localeCompare(String(b));
}
// Newest version name from a list (e.g. ["2021.3.10f1","2022.3.40f1"] → "2022.3.40f1").
function pickNewest(names) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return null;
  return list.slice().sort((a, b) => cmpVersion(b, a))[0];
}

// Platform-specific Hub editor roots + the relative path to the executable.
function editorRoots() {
  if (process.platform === "win32") {
    return [
      "C:/Program Files/Unity/Hub/Editor",
      "C:/Program Files (x86)/Unity/Hub/Editor",
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Unity/Hub/Editor") : null,
    ].filter(Boolean);
  }
  if (process.platform === "darwin") return ["/Applications/Unity/Hub/Editor"];
  return [path.join(os.homedir(), "Unity/Hub/Editor")];
}
function exeRelParts() {
  if (process.platform === "win32") return ["Editor", "Unity.exe"];
  if (process.platform === "darwin") return ["Unity.app", "Contents", "MacOS", "Unity"];
  return ["Editor", "Unity"];
}

// Scan the Hub editor roots and return the newest Unity executable, or null.
function findUnityExe(fsx = fs) {
  const rel = exeRelParts();
  const found = [];
  for (const root of editorRoots()) {
    let dirs;
    try { dirs = fsx.readdirSync(root); } catch { continue; }
    for (const d of dirs) {
      const exe = path.join(root, d, ...rel);
      try { if (fsx.existsSync(exe)) found.push({ version: d, exe }); } catch {}
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => cmpVersion(b.version, a.version));
  return found[0].exe;
}

module.exports = { parseVersion, cmpVersion, pickNewest, editorRoots, exeRelParts, findUnityExe };
