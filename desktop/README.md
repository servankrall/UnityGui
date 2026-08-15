# UnityGUI Desktop

A one-click desktop app (Windows `.exe`) that generates **complete Unity _and_
Roblox Studio games from a prompt** — no repo cloning, no plugin copying, no
website. **Free to run**: it uses a free AI provider (no paid Claude key).
Connect once, describe a game in plain language, and the app writes a
ready-to-open project and can **auto-open it in the engine** for you.

### No more "Unterminated string in JSON"

Big games used to get cut off by the model's output-token limit, which produced
a broken response (*"Unterminated string in JSON…"*). Now the app **detects the
cut-off and automatically retries with a much larger token budget**, uses
per-provider output caps, and — as a last resort — **salvages** the valid files
out of a truncated response instead of failing. Bigger default **Length**
(Standard / Long / Max) too.

### Never run out of free AI

Free online providers have quotas that eventually get exhausted. UnityGUI fights
that on three fronts so a *"quota exhausted / model no longer usable"* error can't
stop you:

- **Multiple keys** — paste **several keys** (one per line) on the connect screen
  and the app **auto-rotates** to the next when one hits its limit.
- **Cross-provider fallback** — if a whole provider is exhausted, generation
  **automatically falls back** to another provider you've added, then retries
  rate-limits with backoff.
- **Unlimited local Ollama** — the ultimate no-limits path: **Ollama** runs models
  on your own PC, **free, offline, no key, no quota**. The connect screen has a
  one-click **“Use unlimited Ollama”** shortcut and a **status checker** that tells
  you if it's running and which models are installed.

### What's new

- **Opens straight in Unity** — no more “here are some files, now import them
  yourself.” When a Unity game is generated the app **launches the Unity Editor
  on the project directly** (it auto-finds your Unity Hub install; if it can’t,
  click **▶ Open in Unity** once to point it at your `Unity.exe`). You just press Play.
- **📎 Reference image & 🎨 free AI art** — attach a photo/screenshot, or **generate
  art from your prompt with no key at all** (via Pollinations). The AI (free
  **Gemini** vision) designs the game to match it, and the image is embedded as a
  **real asset** — `assets/reference.png` for Web, `Resources/reference.png` for
  Unity (`Resources.Load<Texture2D>("reference")`).
- **🔎 Search chats** — a search box filters your saved conversations.
- **🔧 Auto QA (Check & fix)** — for Web games, the app runs the game headless,
  captures runtime/console errors, and the AI **auto-fixes them** in one click.
- **📄 Single-file `.html`** — export a Web game as one self-contained HTML file
  (all assets inlined) that runs anywhere and is **itch.io-ready**.
- **⚙️ Settings** — manage your free API keys per provider (paste several to
  auto-rotate, switch the active provider) and point the app at your `Unity.exe`.
- **Three engines** — generate for **Unity (C#)**, **Roblox Studio (Luau)**, or
  **Web (HTML5/JS)** from the same window; pick the engine per chat.
- **Web games play instantly** — the Web engine writes ONE self-contained
  `index.html` (canvas + Web Audio, all procedural art & sound). Hit **▶ Play
  preview** to play it right inside the app — **no engine, no install, nothing**.
- **📁 My projects gallery** — a library of every game you've generated, with
  **auto-captured thumbnails** for Web games; Play/Open, reveal the folder, or
  export a `.zip` — right from the sidebar.
- **One-tap prompt “spice”** — quick modifier chips (Harder, Levels, Power-ups,
  Particles, Neon, Retro, More SFX, High score…) that enrich your prompt before
  generating.
- **Share as `.zip`** — export the whole generated project as a single shareable
  zip (opens the folder so you can send it).
- **Chats** — every game is a conversation. Keep chatting to **refine** it
  (“make it faster”, “add enemies”, “change to night time”) and the whole game
  is regenerated in place. Conversations are saved in the sidebar; double-click a
  chat to rename it.
- **42 genre quick-starts** — one-tap starter prompts tailored to the engine
  (Unity: platformer, shooter, racing, tower defense…; Roblox: obby, tycoon,
  simulator, escape room…; Web: snake, breakout, flappy, blocks…).
- **✨ Enhance** — expand a one-line idea into a detailed, buildable brief before
  generating.
- **In-app code editor** — expand any generated file to read the source (one-click
  **copy**); for **Web games** you can **edit the code and Save & re-run** the
  preview instantly. Choose generation **Length** (Standard / Long / Max).
- **🔁 Regenerate** — re-roll the latest result from the same prompt.
- **Fully automatic** — turn on **Auto-open when done** and the app writes the
  project and opens it in Unity / Roblox Studio the moment generation finishes.
  You write the prompt; it does the rest.
- **Self-healing models** — Gemini uses current model ids (`gemini-2.5-flash`, …),
  and if a model is ever retired the app **automatically falls back** to another
  working model — the *“these models are no longer usable”* error can't strand you.

### Free providers

| Provider | Cost | Get started |
|---|---|---|
| **Google Gemini** | Free tier, no credit card | Free key at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Groq** | Free, very fast | Free key at [console.groq.com](https://console.groq.com/keys) |
| **Ollama** | 100% free, offline, **unlimited, no key** | Install [ollama.com](https://ollama.com/download), then `ollama pull qwen2.5-coder` |

## Get it (Releases)

Download the latest **`UnityGUI-Setup-*.exe`** from the repo's
[**Releases**](https://github.com/servankrall/UnityGui/releases) page, run it
(one-click install), and launch **UnityGUI** from the Start menu / desktop shortcut.

> The build is unsigned, so Windows SmartScreen may show a warning the first time —
> choose **More info ▸ Run anyway**.

## Use it

1. **Connect** — pick a free **provider** (Gemini / Groq / Ollama) and paste its
   free key, then **Connect**. Keys are stored only on your PC.
   - **Tired of limits?** Paste **several keys** (one per line) to auto-rotate, add
     more than one provider so it can fall back, or click **“Use unlimited Ollama”**
     for a local, offline, no-key, **never-runs-out** setup.
2. **Pick an engine** — **Unity (C#)** or **Roblox Studio (Luau)** — and a style
   (Auto / 2D / 3D). Leave **Auto-open when done** on for the hands-off flow.
3. **Describe your game** and press **✦ Generate**. When it's done the app writes
   the project and (if auto-open is on) opens it in the engine.
   - **Web** → a single `index.html`. Click **▶ Play preview** to play it in-app
     immediately — no engine or install needed — or double-click the file in any browser.
   - **Unity** → a complete `Unity-<Game>` project. Open it in **Unity Hub**
     (Add ▸ pick the folder, Unity 2021 LTS+) and press **Play**.
   - **Roblox** → a `<Game>.rbxlx` place file. Double-click it to open **Roblox
     Studio**, then press **Play**.
4. **Keep chatting** to refine the game — each message regenerates it with your
   change and keeps a full history in the sidebar.

## Build it yourself

Requires Node 18+.

```bash
cd desktop
npm install
npm start        # run the app in dev
npm test         # run the unit tests (no Electron / network needed)
npm run dist     # build the Windows installer into desktop/dist/
```

The Windows `.exe` is also built automatically by
[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml):
push a tag like `v1.0.3` (or run the workflow manually) and the installer is
published to Releases.

```
desktop/
├── main.js               # Electron main: config, conversations, IPC wiring
├── preload.js            # safe IPC bridge
├── lib/
│   ├── providers.js      # free providers (Gemini / Groq / Ollama) + engines
│   ├── prompts.js        # system/refine/enhance prompts + genre quick-starts
│   ├── llm.js            # LLM calls, model auto-fallback, JSON parse/repair
│   └── writers.js        # Unity & Roblox project writers + .rbxlx builder
├── renderer/             # UI (index.html, style.css, app.js) — connect + chats + generator
├── test/test.js          # unit tests (npm test)
├── assets/icon.png       # app icon
└── package.json          # electron + electron-builder (one-click NSIS installer)
```

## Notes

- The app **generates a project** — the engine itself (Unity or Roblox Studio) is
  still what runs the game. The app removes the setup friction; you just open the
  folder / place file and press Play. Auto-open does even that for you.
- Unity games are self-bootstrapping (built from code at Play time), 2D or 3D,
  using only `UnityEngine` / `UnityEngine.UI`. Roblox games build the world,
  gameplay and GUI from Luau at runtime — no external asset ids.
- Prefer generating **scene + prefab + art assets** and working inside the Unity
  Editor? Use the [Unity plugin](../unity/UnityGUI/) instead.

MIT — see the [root LICENSE](../LICENSE).
