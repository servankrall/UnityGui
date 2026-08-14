/* =========================================================================
   UnityGUI — Studio app logic
   ========================================================================= */
(function () {
  "use strict";
  const D = window.UnityGUIData;
  const Gen = window.UnityGUIGen;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const LS_HISTORY = "unitygui.history";
  const LS_CREDITS = "unitygui.credits";
  const LS_FAVS = "unitygui.favs";
  const START_CREDITS = 25;

  /* ---- State ----------------------------------------------------------- */
  const state = {
    type: new URLSearchParams(location.search).get("type") || "ui",
    style: "auto",
    resolution: "1024",
    count: 4,
    credits: loadCredits(),
    history: loadJSON(LS_HISTORY, []),
    favs: loadJSON(LS_FAVS, {}),
  };
  if (!D.ASSET_TYPES.some(a => a.id === state.type)) state.type = "ui";

  function loadJSON(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function loadCredits() { const v = parseInt(localStorage.getItem(LS_CREDITS), 10); return Number.isFinite(v) ? v : START_CREDITS; }
  function saveCredits() { localStorage.setItem(LS_CREDITS, String(state.credits)); }

  /* ---- Build sidebar controls ----------------------------------------- */
  function buildTypeGrid() {
    $("#type-grid").innerHTML = D.ASSET_TYPES.map(a => `
      <button class="type-btn ${a.id === state.type ? "active" : ""}" data-type="${a.id}" title="${a.desc}">
        ${a.icon}<span>${a.name.replace(" / GUI Kits", "").replace(" Kits", "")}</span>
      </button>`).join("");
    $$("#type-grid .type-btn").forEach(b => b.addEventListener("click", () => {
      state.type = b.dataset.type;
      $$("#type-grid .type-btn").forEach(x => x.classList.toggle("active", x === b));
      updateContext();
    }));
  }

  function buildStyles() {
    $("#style-chips").innerHTML = D.STYLE_PRESETS.map(s => `
      <button class="chip ${s === state.style ? "active" : ""}" data-style="${s}">${s === "auto" ? "Auto" : s}</button>`).join("");
    $$("#style-chips .chip").forEach(c => c.addEventListener("click", () => {
      state.style = c.dataset.style;
      $$("#style-chips .chip").forEach(x => x.classList.toggle("active", x === c));
    }));
  }

  function buildResolutions() {
    const opts = [["512", "512²"], ["1024", "1K"], ["2048", "2K"], ["4096", "4K"]];
    $("#res-seg").innerHTML = opts.map(([v, l]) =>
      `<button data-res="${v}" class="${v === state.resolution ? "active" : ""}">${l}</button>`).join("");
    $$("#res-seg button").forEach(b => b.addEventListener("click", () => {
      state.resolution = b.dataset.res;
      $$("#res-seg button").forEach(x => x.classList.toggle("active", x === b));
    }));
  }

  function buildIdeaChips() {
    const wrap = $("#idea-chips");
    if (!wrap) return;
    wrap.innerHTML = D.PROMPT_IDEAS.slice(0, 6).map(p => `<button class="chip" data-idea="${p.replace(/"/g, "&quot;")}">${p}</button>`).join("");
    $$("#idea-chips .chip").forEach(c => c.addEventListener("click", () => {
      $("#prompt").value = c.dataset.idea;
      $("#prompt").focus();
    }));
  }

  /* ---- Context / credits UI ------------------------------------------- */
  function updateContext() {
    const a = D.ASSET_TYPES.find(x => x.id === state.type);
    $("#ctx-title").textContent = a.name;
    $("#ctx-sub").textContent = a.desc;
    const ph = ({
      ui: "e.g. Sci-fi HUD with health bar and minimap, neon blue",
      icon: "e.g. Glowing fire spell ability icon, round frame",
      thumbnail: "e.g. EPIC QUEST store banner, dramatic lighting",
      sprite: "e.g. Cute green slime enemy, 4-frame idle",
      character: "e.g. Fantasy knight hero, clean silhouette",
      model3d: "e.g. Low-poly wooden treasure chest",
      texture: "e.g. Seamless mossy stone dungeon floor",
      skybox: "e.g. Sunset desert sky with two moons",
    })[state.type];
    $("#prompt").placeholder = ph;
  }

  function updateCredits() {
    const el = $("#credits-num");
    el.textContent = state.credits;
    el.classList.toggle("low", state.credits <= 5);
    $("#gen-btn").disabled = state.credits <= 0;
    $("#gen-btn").textContent = state.credits <= 0 ? "Out of credits — Upgrade" : "✦ Generate";
  }

  /* ---- Generate -------------------------------------------------------- */
  let busy = false;
  async function doGenerate() {
    if (busy) return;
    const prompt = $("#prompt").value.trim();
    if (!prompt) { toast("Describe your asset first ✍️"); $("#prompt").focus(); return; }
    if (state.credits <= 0) { toast("You're out of credits — upgrade to keep generating"); return; }

    busy = true;
    const count = Math.min(state.count, Math.max(1, state.credits));
    const type = state.type, style = state.style, resolution = state.resolution;

    // spend credits
    state.credits = Math.max(0, state.credits - count);
    saveCredits(); updateCredits();

    // clear empty state, insert a fresh group with skeletons on top
    $("#empty")?.remove();
    const groupId = "g" + Date.now();
    const typeName = D.ASSET_TYPES.find(a => a.id === type).name;
    const body = $("#canvas-body");
    const group = document.createElement("div");
    group.className = "result-group";
    group.id = groupId;
    group.innerHTML = `
      <div class="rg-head">
        <span class="rg-prompt">“${escapeHtml(prompt)}”</span>
        <span class="badge">${typeName}</span>
        <span class="rg-meta">${style === "auto" ? "Auto style" : style} · ${resLabel(resolution)} · just now</span>
      </div>
      <div class="results">${Array.from({ length: count }, () => `<div class="result loading"><div class="r-media"></div><div class="r-bar"><span class="r-fmt">rendering…</span></div></div>`).join("")}</div>`;
    body.insertBefore(group, body.firstChild);
    $(".canvas-body").scrollTop = 0;

    const results = await Gen.generate(type, prompt, { style, count, resolution });

    const slots = $$(".result", group);
    results.forEach((res, i) => {
      setTimeout(() => mountResult(slots[i], res), 140 * i + 120);
    });
    // persist to history after last renders
    setTimeout(() => {
      results.forEach(res => state.history.unshift(res));
      state.history = state.history.slice(0, 60);
      saveJSON(LS_HISTORY, trimForStorage(state.history));
      busy = false;
    }, 140 * count + 200);
  }

  function mountResult(slot, res) {
    if (!slot) return;
    slot.classList.remove("loading");
    const key = res.meta.seed + ":" + res.meta.type;
    const faved = !!state.favs[key];
    slot.innerHTML = `
      <div class="r-media">${res.svg}</div>
      <div class="r-bar">
        <span class="r-fmt">${res.meta.format}</span>
        <button class="icon-btn fav ${faved ? "on" : ""}" title="Favourite" data-act="fav">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${faved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-8.5C.9 9.6 2.3 6 5.5 6 7.4 6 8.7 7 12 10c3.3-3 4.6-4 6.5-4 3.2 0 4.6 3.6 3 6.5C19 16.65 12 21 12 21z"/></svg>
        </button>
        <button class="icon-btn" title="View" data-act="view">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="icon-btn" title="Download SVG" data-act="download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>
        </button>
      </div>`;
    slot._res = res;
    slot.querySelector('[data-act="fav"]').addEventListener("click", (e) => { e.stopPropagation(); toggleFav(slot, res); });
    slot.querySelector('[data-act="view"]').addEventListener("click", (e) => { e.stopPropagation(); openModal(res); });
    slot.querySelector('[data-act="download"]').addEventListener("click", (e) => { e.stopPropagation(); download(res); });
    slot.querySelector(".r-media").addEventListener("click", () => openModal(res));
  }

  function toggleFav(slot, res) {
    const key = res.meta.seed + ":" + res.meta.type;
    if (state.favs[key]) delete state.favs[key]; else state.favs[key] = true;
    saveJSON(LS_FAVS, state.favs);
    const btn = slot.querySelector(".fav");
    const on = !!state.favs[key];
    btn.classList.toggle("on", on);
    btn.querySelector("svg").setAttribute("fill", on ? "currentColor" : "none");
    toast(on ? "Added to favourites ♥" : "Removed from favourites");
  }

  /* ---- Download -------------------------------------------------------- */
  function download(res) {
    const blob = new Blob([res.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unitygui_${res.meta.type}_${res.meta.seed}.svg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Downloaded SVG · import into Unity as a sprite");
  }

  /* ---- Modal ----------------------------------------------------------- */
  function openModal(res) {
    const m = D.ASSET_TYPES.find(a => a.id === res.meta.type);
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `
      <div class="modal">
        <div class="m-media">${res.svg}</div>
        <div class="m-body">
          <span class="badge">${m.name}</span>
          <h3 style="margin-top:.6rem">“${escapeHtml(res.meta.prompt)}”</h3>
          <div class="m-meta">
            <div><span>Format</span>${res.meta.format}</div>
            <div><span>Resolution</span>${res.meta.resolution}</div>
            <div><span>Style</span>${res.meta.palette}</div>
            <div><span>Seed</span><span class="mono" style="color:var(--text)">${res.meta.seed}</span></div>
          </div>
          <div class="m-actions">
            <button class="btn btn-primary btn-sm" data-m="download">⬇ Download SVG</button>
            <button class="btn btn-ghost btn-sm" data-m="variation">↻ More like this</button>
            <button class="btn btn-ghost btn-sm" data-m="copy">⧉ Copy prompt</button>
            <button class="btn btn-ghost btn-sm" data-m="close" style="margin-left:auto">Close</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener("click", e => { if (e.target === back) close(); });
    back.querySelector('[data-m="close"]').addEventListener("click", close);
    back.querySelector('[data-m="download"]').addEventListener("click", () => download(res));
    back.querySelector('[data-m="copy"]').addEventListener("click", () => {
      navigator.clipboard?.writeText(res.meta.prompt); toast("Prompt copied");
    });
    back.querySelector('[data-m="variation"]').addEventListener("click", () => {
      $("#prompt").value = res.meta.prompt; state.type = res.meta.type;
      $$("#type-grid .type-btn").forEach(x => x.classList.toggle("active", x.dataset.type === state.type));
      updateContext(); close(); doGenerate();
    });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
  }

  /* ---- Restore history ------------------------------------------------- */
  function restoreHistory() {
    if (!state.history.length) return;
    $("#empty")?.remove();
    const body = $("#canvas-body");
    const group = document.createElement("div");
    group.className = "result-group";
    group.innerHTML = `<div class="rg-head"><span class="rg-prompt">Recent generations</span><span class="rg-meta">restored from this browser</span></div><div class="results"></div>`;
    const grid = group.querySelector(".results");
    state.history.slice(0, 12).forEach(res => {
      if (!res.svg) return;
      const slot = document.createElement("div");
      slot.className = "result";
      grid.appendChild(slot);
      mountResult(slot, res);
    });
    body.appendChild(group);
  }

  /* ---- Helpers --------------------------------------------------------- */
  function resLabel(v) { return ({ "512": "512²", "1024": "1024²", "2048": "2K", "4096": "4K" })[v] || v; }
  function escapeHtml(s) { return String(s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
  function trimForStorage(hist) {
    // keep svg but cap total; localStorage has ~5MB, svgs are small
    return hist.slice(0, 40);
  }
  let toastTimer;
  function toast(msg) {
    let t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---- Wire up --------------------------------------------------------- */
  function init() {
    buildTypeGrid(); buildStyles(); buildResolutions(); buildIdeaChips();
    updateContext(); updateCredits();

    const countInput = $("#count");
    countInput.value = state.count;
    $("#count-val").textContent = state.count;
    countInput.addEventListener("input", () => { state.count = +countInput.value; $("#count-val").textContent = state.count; });

    $("#gen-btn").addEventListener("click", doGenerate);
    $("#prompt").addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); doGenerate(); }
    });

    // mobile sidebar
    $("#mobile-menu")?.addEventListener("click", () => {
      $(".sidebar").classList.add("open");
      const bd = document.createElement("div"); bd.className = "backdrop";
      bd.addEventListener("click", () => { $(".sidebar").classList.remove("open"); bd.remove(); });
      document.body.appendChild(bd);
    });

    // reset credits (dev/demo convenience)
    $("#reset-credits")?.addEventListener("click", () => {
      state.credits = START_CREDITS; saveCredits(); updateCredits(); toast("Credits topped up to " + START_CREDITS);
    });

    restoreHistory();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
