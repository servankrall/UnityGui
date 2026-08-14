/* =========================================================================
   UnityGUI — Procedural asset generation engine
   ---------------------------------------------------------------------------
   Ships a fully working, zero-dependency MOCK generator that renders SVG
   previews of Unity-ready assets from a text prompt. Deterministic per
   (prompt + seed) so results are reproducible and varied.

   >>> To plug in a REAL AI backend, implement `UnityGUIGen.remoteGenerate`
       (see the seam at the bottom of this file) and set USE_REMOTE = true.
   ========================================================================= */
(function (global) {
  "use strict";

  /* ---- Deterministic randomness ---------------------------------------- */
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rint = (r, a, b) => Math.floor(r() * (b - a + 1)) + a;
  const rfloat = (r, a, b) => r() * (b - a) + a;
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const esc = (s) => String(s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  /* ---- Palettes -------------------------------------------------------- */
  const PALETTES = [
    { name: "Nebula",  a: "#7c5cff", b: "#22d3ee", c: "#f472b6", bg: "#0d1220" },
    { name: "Ember",   a: "#ff7a45", b: "#ff4d8d", c: "#ffd166", bg: "#1a0f14" },
    { name: "Toxic",   a: "#34d399", b: "#a3e635", c: "#22d3ee", bg: "#0a1512" },
    { name: "Sunset",  a: "#fb7185", b: "#fbbf24", c: "#a78bfa", bg: "#1a1220" },
    { name: "Ocean",   a: "#38bdf8", b: "#818cf8", c: "#2dd4bf", bg: "#08131f" },
    { name: "Royal",   a: "#a855f7", b: "#6366f1", c: "#ec4899", bg: "#140c1f" },
    { name: "Mono",    a: "#e5e7eb", b: "#9ca3af", c: "#6b7280", bg: "#111318" },
    { name: "Lava",    a: "#f97316", b: "#ef4444", c: "#facc15", bg: "#180a08" },
  ];
  function paletteFor(r, style) {
    if (style && style !== "auto") {
      const found = PALETTES.find(p => p.name.toLowerCase() === String(style).toLowerCase());
      if (found) return found;
    }
    return pick(r, PALETTES);
  }

  /* ---- SVG helpers ----------------------------------------------------- */
  function defs(pal, id) {
    return `
      <defs>
        <linearGradient id="g${id}a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${pal.a}"/><stop offset="1" stop-color="${pal.b}"/>
        </linearGradient>
        <linearGradient id="g${id}b" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="${pal.b}"/><stop offset="1" stop-color="${pal.c}"/>
        </linearGradient>
        <radialGradient id="g${id}glow" cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stop-color="${pal.a}" stop-opacity="0.55"/>
          <stop offset="1" stop-color="${pal.a}" stop-opacity="0"/>
        </radialGradient>
        <filter id="g${id}soft"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>`;
  }
  const wrap = (w, h, inner) =>
    `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img">${inner}</svg>`;

  function titleFromPrompt(prompt) {
    const words = String(prompt || "Asset").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "ASSET";
    return words.slice(0, 3).join(" ").toUpperCase().slice(0, 22);
  }

  /* =======================================================================
     RENDERERS  (one per asset type)
     ===================================================================== */

  function renderUI(r, pal, id, prompt) {
    const W = 400, H = 300;
    const rows = rint(r, 2, 3);
    let slots = "";
    const cols = 4;
    const sx = 150, sy = 150, gap = 8, size = 40;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const filled = r() > 0.45;
      slots += `<rect x="${sx + x * (size + gap)}" y="${sy + y * (size + gap)}" width="${size}" height="${size}" rx="7"
        fill="${filled ? `url(#g${id}b)` : "#1c2540"}" stroke="#2a3552" opacity="${filled ? 0.95 : 0.7}"/>`;
    }
    const barW = 120;
    const bars = [0, 1].map(i => {
      const p = rfloat(r, 0.35, 0.9);
      return `<rect x="26" y="${150 + i * 34}" width="${barW}" height="14" rx="7" fill="#1c2540"/>
              <rect x="26" y="${150 + i * 34}" width="${barW * p}" height="14" rx="7" fill="${i ? pal.c : `url(#g${id}a)`}"/>`;
    }).join("");
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      <rect width="${W}" height="${H}" fill="url(#g${id}glow)" opacity="0.5"/>
      <rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="18" fill="#0f1626" stroke="#26304a"/>
      <rect x="16" y="16" width="${W - 32}" height="46" rx="18" fill="url(#g${id}a)" opacity="0.16"/>
      <circle cx="42" cy="39" r="12" fill="url(#g${id}a)"/>
      <rect x="64" y="32" width="120" height="9" rx="4.5" fill="#c9d3ec" opacity="0.85"/>
      <rect x="64" y="46" width="70" height="7" rx="3.5" fill="#5b6b93" opacity="0.5"/>
      <rect x="${W - 66}" y="30" width="42" height="18" rx="9" fill="url(#g${id}b)"/>
      ${bars}
      ${slots}
      <rect x="26" y="232" width="150" height="34" rx="10" fill="url(#g${id}a)"/>
      <rect x="184" y="232" width="86" height="34" rx="10" fill="#1c2540" stroke="#2a3552"/>
      <text x="101" y="254" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#0a0d14" text-anchor="middle">CONFIRM</text>
    `);
  }

  function renderIcon(r, pal, id, prompt) {
    const W = 400, H = 400;
    const cx = 200, cy = 200;
    const glyphs = [
      `<path d="M200 120 l58 34 v72 l-58 34 -58 -34 v-72 z" fill="#fff" opacity="0.95"/>`,
      `<circle cx="200" cy="200" r="66" fill="none" stroke="#fff" stroke-width="16"/><circle cx="200" cy="200" r="20" fill="#fff"/>`,
      `<path d="M200 128 l24 48 52 8 -38 37 9 52 -47 -25 -47 25 9 -52 -38 -37 52 -8 z" fill="#fff"/>`,
      `<path d="M150 250 l50 -110 50 110 z" fill="#fff"/><rect x="180" y="150" width="40" height="12" fill="#fff"/>`,
      `<path d="M160 160 h80 v80 h-80 z" fill="none" stroke="#fff" stroke-width="16"/><path d="M185 200 h30 M200 185 v30" stroke="#fff" stroke-width="14"/>`,
    ];
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      <rect x="52" y="52" width="296" height="296" rx="66" fill="url(#g${id}a)"/>
      <rect x="52" y="52" width="296" height="296" rx="66" fill="url(#g${id}glow)"/>
      <rect x="52" y="52" width="296" height="148" rx="66" fill="#fff" opacity="0.10"/>
      ${pick(r, glyphs)}
    `);
  }

  function renderThumbnail(r, pal, id, prompt) {
    const W = 480, H = 270;
    const title = titleFromPrompt(prompt);
    let shards = "";
    for (let i = 0; i < 5; i++) {
      const x = rint(r, 0, W), y = rint(r, 0, H), s = rint(r, 20, 70);
      shards += `<path d="M${x} ${y} l${s} ${s * .3} -${s * .3} ${s} -${s} -${s * .3} z" fill="${pick(r, [pal.a, pal.b, pal.c])}" opacity="0.25"/>`;
    }
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      <rect width="${W}" height="${H}" fill="url(#g${id}a)" opacity="0.22"/>
      <ellipse cx="${W * .7}" cy="${H * .5}" rx="200" ry="150" fill="url(#g${id}glow)"/>
      ${shards}
      <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${pal.a}" stroke-width="4" opacity="0.6"/>
      <text x="34" y="${H / 2 - 6}" font-family="Inter,sans-serif" font-size="46" font-weight="900" fill="#fff" letter-spacing="-1">${esc(title.split(" ")[0] || "PLAY")}</text>
      <text x="34" y="${H / 2 + 40}" font-family="Inter,sans-serif" font-size="30" font-weight="800" fill="${pal.c}" letter-spacing="1">${esc(title.split(" ").slice(1).join(" ") || "NOW")}</text>
      <rect x="34" y="${H - 52}" width="150" height="30" rx="15" fill="url(#g${id}b)"/>
    `);
  }

  function renderSprite(r, pal, id) {
    const W = 400, H = 400, n = 11, cell = 26, ox = (W - n * cell) / 2, oy = (H - n * cell) / 2;
    // symmetric pixel creature
    let cells = "";
    const cols = Math.ceil(n / 2);
    const map = [];
    for (let y = 0; y < n; y++) { map[y] = []; for (let x = 0; x < cols; x++) map[y][x] = r() > 0.5; }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const mx = x < cols ? x : n - 1 - x;
      if (!map[y][mx]) continue;
      const col = (y < 3) ? pal.c : (y > n - 3 ? pal.b : pal.a);
      cells += `<rect x="${ox + x * cell}" y="${oy + y * cell}" width="${cell}" height="${cell}" fill="${col}"/>`;
    }
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="14" fill="none" stroke="#26304a" stroke-dasharray="6 8"/>
      <ellipse cx="${W / 2}" cy="${H / 2}" rx="150" ry="150" fill="url(#g${id}glow)"/>
      ${cells}
    `);
  }

  function renderCharacter(r, pal, id) {
    const W = 320, H = 400, cx = 160;
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      <ellipse cx="${cx}" cy="200" rx="140" ry="180" fill="url(#g${id}glow)"/>
      <ellipse cx="${cx}" cy="372" rx="88" ry="18" fill="#000" opacity="0.35"/>
      <!-- body -->
      <path d="M${cx - 58} 372 Q${cx - 70} 250 ${cx - 44} 210 L${cx + 44} 210 Q${cx + 70} 250 ${cx + 58} 372 Z" fill="url(#g${id}a)"/>
      <path d="M${cx - 44} 210 L${cx + 44} 210 L${cx + 20} 260 L${cx - 20} 260 Z" fill="${pal.c}" opacity="0.9"/>
      <!-- head -->
      <circle cx="${cx}" cy="150" r="52" fill="url(#g${id}b)"/>
      <path d="M${cx - 52} 150 a52 52 0 0 1 104 0 Z" fill="#fff" opacity="0.12"/>
      <circle cx="${cx - 18}" cy="146" r="7" fill="#0a0d14"/>
      <circle cx="${cx + 18}" cy="146" r="7" fill="#0a0d14"/>
      <path d="M${cx - 14} 172 q14 12 28 0" stroke="#0a0d14" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- helmet crest -->
      <path d="M${cx - 54} 132 q54 -70 108 0 q-30 -22 -54 -22 q-24 0 -54 22 z" fill="${pal.c}"/>
    `);
  }

  function renderModel3D(r, pal, id) {
    const W = 400, H = 320, cx = 200, cy = 175, s = 74;
    // isometric cube stack
    const iso = (x, y, z) => [cx + (x - z) * s * 0.87, cy + (x + z) * s * 0.5 - y * s];
    function face(pts, fill, op) {
      return `<polygon points="${pts.map(p => p.join(",")).join(" ")}" fill="${fill}" opacity="${op}" stroke="#0a0d14" stroke-width="1.5"/>`;
    }
    function cube(x, y, z) {
      const p = {
        A: iso(x, y, z), B: iso(x + 1, y, z), C: iso(x + 1, y, z + 1), D: iso(x, y, z + 1),
        E: iso(x, y + 1, z), F: iso(x + 1, y + 1, z), G: iso(x + 1, y + 1, z + 1), H: iso(x, y + 1, z + 1)
      };
      return face([p.A, p.B, p.C, p.D], `url(#g${id}a)`, 1) +      // top
             face([p.A, p.D, p.H, p.E], pal.b, 0.85) +             // left
             face([p.D, p.C, p.G, p.H], pal.c, 0.7);               // right
    }
    let cubes = "";
    const coords = [[0, 0, 0], [1, 0, 0], [0, 0, 1]];
    if (r() > 0.5) coords.push([1, 1, 0]);
    if (r() > 0.6) coords.push([0, 1, 1]);
    coords.sort((a, b) => (a[0] + a[2] - a[1]) - (b[0] + b[2] - b[1]));
    coords.forEach(c => cubes += cube(c[0], c[1], c[2]));
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      <ellipse cx="${cx}" cy="${cy + 30}" rx="170" ry="120" fill="url(#g${id}glow)"/>
      <line x1="30" y1="${H - 30}" x2="${W - 30}" y2="${H - 30}" stroke="#26304a" stroke-dasharray="4 6"/>
      ${cubes}
      <g opacity="0.6" font-family="monospace" font-size="10" fill="#7b88a8">
        <text x="26" y="26">◈ mesh · ${rint(r, 240, 4800)} tris</text>
      </g>
    `);
  }

  function renderTexture(r, pal, id) {
    const W = 300, H = 300, n = 6, cell = W / n;
    let tiles = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const t = r();
      const col = t > 0.66 ? pal.a : t > 0.33 ? pal.b : pal.c;
      tiles += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${col}" opacity="${rfloat(r, 0.55, 1)}"/>`;
      if (r() > 0.6) tiles += `<circle cx="${x * cell + cell / 2}" cy="${y * cell + cell / 2}" r="${rfloat(r, 4, 12)}" fill="#0a0d14" opacity="0.2"/>`;
    }
    return wrap(W, H, `
      ${defs(pal, id)}
      <rect width="${W}" height="${H}" fill="${pal.bg}"/>
      ${tiles}
      <rect width="${W}" height="${H}" fill="url(#g${id}glow)" opacity="0.25"/>
    `);
  }

  function renderSkybox(r, pal, id) {
    const W = 480, H = 270;
    let stars = "";
    for (let i = 0; i < 60; i++) stars += `<circle cx="${rint(r, 0, W)}" cy="${rint(r, 0, H * .7)}" r="${rfloat(r, .4, 1.6)}" fill="#fff" opacity="${rfloat(r, .2, .9)}"/>`;
    return wrap(W, H, `
      ${defs(pal, id)}
      <defs>
        <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${pal.bg}"/><stop offset="0.6" stop-color="${pal.a}" stop-opacity="0.5"/><stop offset="1" stop-color="${pal.c}"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
      ${stars}
      <circle cx="${W * .72}" cy="${H * .34}" r="34" fill="${pal.c}" opacity="0.9"/>
      <circle cx="${W * .72}" cy="${H * .34}" r="60" fill="url(#g${id}glow)"/>
      <path d="M0 ${H * .74} Q${W * .3} ${H * .64} ${W * .55} ${H * .74} T ${W} ${H * .72} V${H} H0 Z" fill="#0a0d14" opacity="0.85"/>
      <path d="M0 ${H * .82} Q${W * .4} ${H * .74} ${W} ${H * .84} V${H} H0 Z" fill="#0a0d14"/>
    `);
  }

  const RENDERERS = {
    ui: renderUI, icon: renderIcon, thumbnail: renderThumbnail, sprite: renderSprite,
    character: renderCharacter, model3d: renderModel3D, texture: renderTexture, skybox: renderSkybox,
  };

  /* =======================================================================
     PUBLIC API
     ===================================================================== */
  const USE_REMOTE = false; // flip to true once remoteGenerate() is implemented

  /**
   * Generate one asset preview.
   * @returns {Promise<{svg:string, meta:object}>}
   */
  async function generateOne(type, prompt, opts = {}) {
    if (USE_REMOTE && typeof API.remoteGenerate === "function") {
      return API.remoteGenerate(type, prompt, opts);
    }
    const seed = opts.seed != null ? opts.seed : Date.now() ^ Math.floor(Math.random() * 1e9);
    const r = mulberry32(hashSeed(`${type}|${prompt}|${seed}`));
    const pal = paletteFor(r, opts.style);
    const id = (Math.random().toString(36).slice(2, 7));
    const render = RENDERERS[type] || renderUI;
    const svg = render(r, pal, id, prompt);
    return {
      svg,
      meta: {
        type, prompt, seed, palette: pal.name,
        resolution: opts.resolution || defaultRes(type),
        format: exportFormat(type),
        createdAt: Date.now(),
      },
    };
  }

  /** Generate `count` variations. Returns array of results. */
  async function generate(type, prompt, opts = {}) {
    const count = Math.max(1, Math.min(8, opts.count || 4));
    const out = [];
    for (let i = 0; i < count; i++) {
      const seed = (opts.seed != null ? opts.seed : hashSeed(prompt)) + i * 7919;
      // eslint-disable-next-line no-await-in-loop
      out.push(await generateOne(type, prompt, { ...opts, seed }));
    }
    return out;
  }

  function defaultRes(type) {
    return ({ thumbnail: "1280×720", skybox: "2048×1024", texture: "1024×1024", icon: "512×512" })[type] || "1024×1024";
  }
  function exportFormat(type) {
    return ({ model3d: "FBX + PNG", ui: "Prefab + PNG", character: "PNG (rig-ready)" })[type] || "PNG (sRGB)";
  }

  /* ---- REMOTE BACKEND SEAM --------------------------------------------
     Implement this to call a real image/asset generation API, then set
     USE_REMOTE = true above. Must resolve to { svg?|dataUrl?, meta }.

     Example:
       API.remoteGenerate = async (type, prompt, opts) => {
         const res = await fetch("/api/generate", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ type, prompt, ...opts }),
         });
         const { imageUrl } = await res.json();
         return { dataUrl: imageUrl, meta: { type, prompt } };
       };
  ---------------------------------------------------------------------- */
  const API = {
    generate, generateOne,
    hashSeed, palettes: PALETTES,
    remoteGenerate: null,
  };

  global.UnityGUIGen = API;
})(typeof window !== "undefined" ? window : this);
