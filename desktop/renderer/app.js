// UnityGUI Desktop — renderer logic (free providers)
const $ = (s) => document.querySelector(s);

const IDEAS = [
  "A 2D endless runner where a cube jumps over obstacles. Space to jump, score for distance.",
  "A top-down twin-stick shooter: WASD to move, mouse to aim and shoot enemies. Health and score.",
  "A 3D first-person maze: WASD + mouse look, find the glowing exit before the timer ends.",
  "A brick-breaker: paddle on arrow keys, bounce the ball to clear all bricks, lives counter.",
  "A tiny platformer: a capsule collects coins on floating platforms. Arrows + space to jump.",
];

let PROVIDERS = {};
let lastResult = null;

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function setStatus(el, msg, isErr, busy) {
  el.innerHTML = (busy ? '<span class="spinner"></span>' : "") + (msg || "");
  el.classList.toggle("err", !!isErr);
}
function esc(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }
function fillSelect(el, items, selected) {
  el.innerHTML = items.map(v => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");
}

function currentProvider() { return $("#provider").value; }

function refreshConnectForm() {
  const p = PROVIDERS[currentProvider()];
  if (!p) return;
  $("#key-block").classList.toggle("hidden", !p.needsKey);
  $("#key-hint").textContent = p.keyHint || "";
  $("#get-key-btn").textContent = p.needsKey ? "Get a free key →" : "Install Ollama →";
  fillSelect($("#c-model"), p.models, p.defaultModel);
}

function showConnected(connected, provider, model) {
  const chip = $("#conn-chip"), text = $("#conn-text");
  chip.classList.toggle("off", !connected);
  const label = provider && PROVIDERS[provider] ? PROVIDERS[provider].label.split("—")[0].trim() : "";
  text.textContent = connected ? ("Connected · " + label) : "Not connected";
  $("#disconnect-btn").classList.toggle("hidden", !connected);
  $("#connect-view").classList.toggle("hidden", connected);
  $("#app-view").classList.toggle("hidden", !connected);
  if (connected && provider) fillSelect($("#model"), PROVIDERS[provider].models, model || PROVIDERS[provider].defaultModel);
}

async function init() {
  PROVIDERS = await window.api.getProviders();

  // provider select
  $("#provider").innerHTML = Object.entries(PROVIDERS)
    .map(([id, p]) => `<option value="${id}">${esc(p.label)}</option>`).join("");

  // ideas chips
  $("#ideas").innerHTML = IDEAS.map((p, i) => `<button class="chip-btn" data-i="${i}">${esc(p.slice(0, 42))}…</button>`).join("");
  document.querySelectorAll("#ideas .chip-btn").forEach(b =>
    b.addEventListener("click", () => { $("#prompt").value = IDEAS[+b.dataset.i]; $("#prompt").focus(); }));

  const cfg = await window.api.getConfig();
  $("#provider").value = cfg.provider;
  if (cfg.style) $("#style").value = cfg.style;
  refreshConnectForm();
  if (cfg.model) $("#c-model").value = cfg.model;
  showConnected(cfg.connected, cfg.provider, cfg.model);

  // events
  $("#provider").addEventListener("change", () => { refreshConnectForm(); window.api.saveConfig({ provider: currentProvider() }); });
  $("#get-key-btn").addEventListener("click", () => window.api.openExternal(PROVIDERS[currentProvider()].keyUrl));
  $("#connect-btn").addEventListener("click", onConnect);
  $("#key").addEventListener("keydown", e => { if (e.key === "Enter") onConnect(); });
  $("#disconnect-btn").addEventListener("click", async () => { await window.api.disconnect(); showConnected(false); toast("Disconnected"); });
  $("#generate-btn").addEventListener("click", onGenerate);
  $("#style").addEventListener("change", () => window.api.saveConfig({ style: $("#style").value }));
  $("#model").addEventListener("change", () => window.api.saveConfig({ model: $("#model").value }));
}

async function onConnect() {
  const provider = currentProvider();
  const p = PROVIDERS[provider];
  const key = p.needsKey ? $("#key").value.trim() : "";
  const model = $("#c-model").value;
  if (p.needsKey && !key) { setStatus($("#connect-status"), "Paste your free API key first.", true); return; }

  const btn = $("#connect-btn"); btn.disabled = true;
  setStatus($("#connect-status"), "Checking…", false, true);
  await window.api.saveConfig({ provider, apiKey: key, model });
  const r = await window.api.testConnect({ provider, apiKey: key, model });
  btn.disabled = false;
  if (!r.ok) { setStatus($("#connect-status"), r.error || "Could not connect.", true); return; }
  setStatus($("#connect-status"), "");
  $("#key").value = "";
  showConnected(true, provider, model);
  toast("Connected ✓");
}

async function onGenerate() {
  const prompt = $("#prompt").value.trim();
  if (!prompt) { setStatus($("#gen-status"), "Describe your game first.", true); return; }
  const btn = $("#generate-btn"); btn.disabled = true;
  setStatus($("#gen-status"), "Generating — this can take a minute…", false, true);

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
  if (confirm("Unity project saved to:\n" + r.path + "\n\nOpen the folder now?")) window.api.openPath(r.path);
}

window.addEventListener("DOMContentLoaded", init);
