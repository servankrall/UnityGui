// UnityGUI Desktop — renderer logic
const $ = (s) => document.querySelector(s);

const IDEAS = [
  "A 2D endless runner where a cube jumps over obstacles. Space to jump, score for distance.",
  "A top-down twin-stick shooter: WASD to move, mouse to aim and shoot enemies. Health and score.",
  "A 3D first-person maze: WASD + mouse look, find the glowing exit before the timer ends.",
  "A brick-breaker: paddle on arrow keys, bounce the ball to clear all bricks, lives counter.",
  "A tiny platformer: a capsule collects coins on floating platforms. Arrows + space to jump.",
];

let lastResult = null; // { game_name, summary, setup_notes, files }

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function setStatus(el, msg, isErr, busy) {
  el.innerHTML = (busy ? '<span class="spinner"></span>' : "") + (msg || "");
  el.classList.toggle("err", !!isErr);
}
function esc(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

function showConnected(connected, model) {
  const chip = $("#conn-chip"), text = $("#conn-text");
  chip.classList.toggle("off", !connected);
  text.textContent = connected ? "Connected" : "Not connected";
  $("#disconnect-btn").classList.toggle("hidden", !connected);
  $("#connect-view").classList.toggle("hidden", connected);
  $("#app-view").classList.toggle("hidden", !connected);
  if (connected && model) { $("#model").value = model; }
}

async function init() {
  // ideas chips
  $("#ideas").innerHTML = IDEAS.map((p, i) => `<button class="chip-btn" data-i="${i}">${esc(p.slice(0, 42))}…</button>`).join("");
  document.querySelectorAll("#ideas .chip-btn").forEach(b =>
    b.addEventListener("click", () => { $("#prompt").value = IDEAS[+b.dataset.i]; $("#prompt").focus(); }));

  const cfg = await window.api.getConfig();
  if (cfg.model) { $("#c-model").value = cfg.model; $("#model").value = cfg.model; }
  if (cfg.style) { $("#style").value = cfg.style; }
  showConnected(cfg.hasKey, cfg.model);

  // connect
  $("#get-key-btn").addEventListener("click", () => window.api.openPath("https://console.anthropic.com/settings/keys"));
  $("#connect-btn").addEventListener("click", onConnect);
  $("#key").addEventListener("keydown", e => { if (e.key === "Enter") onConnect(); });
  $("#disconnect-btn").addEventListener("click", async () => {
    await window.api.disconnect(); showConnected(false); toast("Disconnected");
  });

  // generate
  $("#generate-btn").addEventListener("click", onGenerate);
  $("#style").addEventListener("change", () => window.api.saveConfig({ style: $("#style").value }));
  $("#model").addEventListener("change", () => window.api.saveConfig({ model: $("#model").value }));
}

async function onConnect() {
  const key = $("#key").value.trim();
  const model = $("#c-model").value;
  if (!key) { setStatus($("#connect-status"), "Paste your API key first.", true); return; }
  const btn = $("#connect-btn"); btn.disabled = true;
  setStatus($("#connect-status"), "Checking your key…", false, true);
  // Save first so the test call can read it, then verify.
  await window.api.saveConfig({ apiKey: key, model });
  const r = await window.api.testConnect({ apiKey: key, model });
  btn.disabled = false;
  if (!r.ok) {
    setStatus($("#connect-status"), r.error || "Could not connect.", true);
    return;
  }
  setStatus($("#connect-status"), "");
  $("#key").value = "";
  showConnected(true, model);
  toast("Connected ✓");
}

async function onGenerate() {
  const prompt = $("#prompt").value.trim();
  if (!prompt) { setStatus($("#gen-status"), "Describe your game first.", true); return; }
  const btn = $("#generate-btn"); btn.disabled = true;
  setStatus($("#gen-status"), "Generating with Claude — this can take a minute…", false, true);

  const r = await window.api.generate({ prompt, model: $("#model").value, style: $("#style").value });
  btn.disabled = false;

  if (!r.ok) { setStatus($("#gen-status"), r.error || "Generation failed.", true); return; }
  setStatus($("#gen-status"), "");
  lastResult = r.data;
  renderResult(r.data);
  toast("Game generated ✓");
}

function renderResult(d) {
  const files = (d.files || []).map(f => `<li>• ${esc(f.path)}</li>`).join("");
  $("#result").innerHTML = `
    <div class="res-title">${esc(d.game_name || "Generated Game")}</div>
    <div class="res-sum">${esc(d.summary || "")}</div>
    ${d.setup_notes ? `<div class="notes">${esc(d.setup_notes)}</div>` : ""}
    <div class="files"><h3>Files (${(d.files || []).length})</h3><ul>${files}</ul></div>
    <div class="actions">
      <button class="btn btn-ember" id="save-btn">⬇ Save as Unity project</button>
      <button class="btn btn-ghost" id="regen-btn">↻ Regenerate</button>
    </div>`;
  $("#save-btn").addEventListener("click", onSaveProject);
  $("#regen-btn").addEventListener("click", onGenerate);
}

async function onSaveProject() {
  if (!lastResult) return;
  const dir = await window.api.pickFolder();
  if (!dir) return;
  setStatus($("#gen-status"), "Writing Unity project…", false, true);
  const r = await window.api.saveProject({ gameName: lastResult.game_name, files: lastResult.files, dir });
  if (!r.ok) { setStatus($("#gen-status"), r.error || "Could not save.", true); return; }
  setStatus($("#gen-status"), "");
  toast("Saved!");
  // Offer to open the folder
  const open = confirm("Unity project saved to:\n" + r.path + "\n\nOpen the folder now?");
  if (open) window.api.openPath(r.path);
}

window.addEventListener("DOMContentLoaded", init);
