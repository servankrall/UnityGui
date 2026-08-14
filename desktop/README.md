# UnityGUI Desktop

A one-click desktop app (Windows `.exe`) that generates **complete Unity _and_
Roblox Studio games from a prompt** — no repo cloning, no plugin copying, no
website. **Free to run**: it uses a free AI provider (no paid Claude key).
Connect once, describe a game in plain language, and the app writes a
ready-to-open project and can **auto-open it in the engine** for you.

### What's new

- **Two engines** — generate for **Unity (C#)** or **Roblox Studio (Luau)** from
  the same window; pick the engine per chat.
- **Chats** — every game is a conversation. Keep chatting to **refine** it
  (“make it faster”, “add enemies”, “change to night time”) and the whole game
  is regenerated in place. Conversations are saved in the sidebar; double-click a
  chat to rename it.
- **Genre quick-starts** — one-tap starter prompts tailored to the engine
  (Unity: platformer, shooter, tower defense…; Roblox: obby, tycoon, simulator…).
- **✨ Enhance** — expand a one-line idea into a detailed, buildable brief before
  generating.
- **In-app code view** — expand any generated file to read the source, with a
  one-click **copy** button. Choose generation **Length** (Standard / Long / Max).
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
| **Ollama** | 100% free, offline, **no key** | Install [ollama.com](https://ollama.com/download), then `ollama pull qwen2.5-coder` |

## Get it (Releases)

Download the latest **`UnityGUI-Setup-*.exe`** from the repo's
[**Releases**](https://github.com/servankrall/UnityGui/releases) page, run it
(one-click install), and launch **UnityGUI** from the Start menu / desktop shortcut.

> The build is unsigned, so Windows SmartScreen may show a warning the first time —
> choose **More info ▸ Run anyway**.

## Use it

1. **Connect** — pick a free **provider** (Gemini / Groq / Ollama), paste its free
   key (Ollama needs none), and click **Connect**. The key is stored only on your PC.
2. **Pick an engine** — **Unity (C#)** or **Roblox Studio (Luau)** — and a style
   (Auto / 2D / 3D). Leave **Auto-open when done** on for the hands-off flow.
3. **Describe your game** and press **✦ Generate**. When it's done the app writes
   the project and (if auto-open is on) opens it in the engine.
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
