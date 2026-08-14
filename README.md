<div align="center">

# UnityGUI

**The AI asset platform, built for Unity developers.**

Describe it → Generate it → Ship it in Unity.

A Unity‑focused clone of the [ForgeGUI](https://forgegui.com) concept: type a one‑line prompt and
get game‑ready **UI kits, icons, thumbnails, sprites, characters, 3D props, textures and skyboxes**,
exported in the formats Unity expects (uGUI / UI Toolkit, URP / HDRP).

</div>

---

## ✨ What it does

UnityGUI reproduces the ForgeGUI "describe‑to‑generate" workflow, rebuilt around Unity's asset
pipeline. It ships as a **self‑contained static web app** — no build step, no framework, no
external dependencies — so it runs by just opening a file or serving the folder.

- **Landing site** (`index.html`) — hero, live typing demo, asset‑type catalog, features,
  showcase gallery, pricing and FAQ.
- **Studio** (`studio.html`) — the actual generator: pick an asset type, write a prompt, choose a
  style preset / resolution / number of variations, and generate. Results support download,
  favourites, a detail view, "more like this", a credits system and local history.

### Asset types

| Type | Unity target | Export |
|------|--------------|--------|
| UI / GUI kits | uGUI · UI Toolkit | Prefab + sprite atlas |
| Game icons | Asset Store | PNG (sRGB) |
| Thumbnails | Store / YouTube | 1280×720 PNG |
| 2D sprites | Sprite Editor | Sprite sheet |
| Characters | 2D / 2.5D | PNG (rig‑ready) |
| 3D props | URP · HDRP | FBX + PBR |
| Textures | Any pipeline | Seamless PBR |
| Skyboxes | Scene lighting | Panoramic |

## 🚀 Run it

**Option A — just open it.** Double‑click `index.html`. The app is 100 % client‑side.

**Option B — serve it** (recommended, avoids any `file://` quirks):

```bash
npm start          # zero-dependency Node server → http://localhost:8080
# or
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## 🗂 Project structure

```
UnityGui/
├── index.html          # Landing / marketing page
├── studio.html         # The generation Studio (the app)
├── css/
│   ├── base.css        # Design tokens, reset, buttons, primitives
│   ├── landing.css     # Landing page styles
│   └── studio.css      # Studio styles
├── js/
│   ├── data.js         # Asset-type catalog, style presets, pricing, FAQ
│   ├── generator.js    # Procedural asset-generation engine (the core)
│   ├── main.js         # Landing page behaviour
│   └── studio.js       # Studio app logic (state, credits, history)
├── assets/             # Logo & favicon (SVG)
├── serve.js            # Tiny static file server (no deps)
└── package.json
```

## 🧠 How generation works

The generator (`js/generator.js`) ships a fully working **procedural mock** that renders SVG
previews of each asset type from the prompt. It is **deterministic per `(prompt + seed)`** — the
same seed always produces the same visual, so results are reproducible, and locking a seed lets you
iterate. A seeded PRNG drives shape/layout/palette choices per asset type.

> This keeps the whole app runnable with **zero API keys**, while looking and behaving like the
> real product.

### Plugging in a real AI backend

There is a single, documented seam. In `js/generator.js`:

```js
// 1. Implement remoteGenerate to call your image/3D backend:
UnityGUIGen.remoteGenerate = async (type, prompt, opts) => {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, prompt, ...opts }),
  });
  const { imageUrl } = await res.json();
  return { dataUrl: imageUrl, meta: { type, prompt } };
};

// 2. Flip the flag near the top of the file:
const USE_REMOTE = true;
```

The UI, credits, history, favourites and download flows all work unchanged — they only care about
the `{ svg | dataUrl, meta }` shape returned by the generator.

## ⌨️ Studio shortcuts & features

- **⌘/Ctrl + Enter** — generate.
- **Style presets & seeds** — reproducible, consistent looks across asset types.
- **Credits** — client‑side demo credits (25 to start); "Top up demo credits" resets them.
- **Local history & favourites** — persisted in `localStorage`, restored on reload.
- **Download** — each result exports as an SVG you can import into Unity as a sprite.

## 📝 Notes

UnityGUI is an independent, educational clone of the ForgeGUI concept and is **not affiliated with
Unity Technologies or ForgeGUI**. "Unity", "uGUI", "URP" and "HDRP" are referenced descriptively.

## License

[MIT](./LICENSE)
