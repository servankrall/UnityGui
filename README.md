<div align="center">

# UnityGUI

**Generate complete, playable Unity, Roblox Studio _and_ Web (HTML5) games from a prompt.**

Describe a game → free AI writes a ready-to-run project → the app opens it in the engine → press Play.

A take on the [ForgeGUI](https://forgegui.com) "describe-to-generate" concept for **game engines**,
powered by free AI (Gemini / Groq / Ollama — no paid key). Pick your engine, chat to refine, and let
it do everything. Use it however you like: a **one-click desktop app**, a **Unity Editor plugin**, or
the **companion website**.

</div>

---

## Three ways to use it

| | What it is | Where |
|---|---|---|
| 🖥️ **Desktop app (.exe)** | The easy path. Download from **Releases**, connect a free key once, then prompt → generate → it **auto-opens** a ready-to-run **Unity, Roblox _or_ Web** game (Unity launches the Editor; Web plays in-app). Chat to refine, attach a reference image. No repo, no plugin, no site. | [`desktop/`](./desktop/) · [Releases](https://github.com/servankrall/UnityGui/releases) |
| 🎮 **Unity Editor plugin** | The most powerful path. `Window ▸ UnityGUI` generates a real `.unity` scene + prefabs + art **inside** your project. | [`unity/UnityGUI/`](./unity/UnityGUI/) |
| 🌐 **Companion website** | Landing page + Google sign-in **console** (setup hub). Static, no build step. | repo root (`index.html`, `studio.html`) |

## 🖥️ The desktop app

The simplest way in — a Windows `.exe` you download from
[**Releases**](https://github.com/servankrall/UnityGui/releases). One-click install,
connect a **free** AI provider, pick an engine, describe a game — and with **Auto-open**
on it writes the project and opens it in the engine for you. You just press Play.

- **Opens straight in the engine** — Unity games **launch the Unity Editor on the
  project automatically** (no Hub “Add” step; point it at `Unity.exe` once if
  needed); Web games **▶ Play preview** in-app instantly; Roblox opens the
  `.rbxlx` in Studio.
- **🎨 Asset pack (multiple images)** — attach photos **or generate free AI art
  with zero key** (Pollinations), add **several** and name each (e.g. `player`,
  `enemy`, `background`). The free **Gemini** vision model designs the game to
  match them, and every image is embedded as a **real asset** (Web
  `assets/<name>.png`, Unity `Resources/<name>.png`).
- **🔎 Search & ⭐ favorite your chats** — filter saved conversations from the
  sidebar and star the ones you keep coming back to (favorites sort to the top).
  Keyboard shortcuts: **Ctrl+N** new chat, **Ctrl+K** search, **Ctrl+Enter**
  generate, **Esc** close dialogs.
- **📄 Single-file `.html`** — export a Web game as one self-contained, itch.io-ready
  HTML file (all assets inlined).
- **⚙️ Settings** — per-provider API-key manager (multi-key auto-rotate + switch
  active) and your `Unity.exe` path.
- **Three engines** — generate for **Unity (C#)**, **Roblox Studio (Luau)**, or
  **Web (HTML5/JS)**. Unity gets a full project; Roblox a ready-to-open `.rbxlx`
  place file; Web a single self-contained `index.html`.
- **📁 Project gallery** — every game you generate is saved and re-openable
  (Play / Open / reveal folder / export `.zip`) from the sidebar, with
  auto-captured **thumbnails** for Web games. **🗂️ Tag** projects and filter the
  gallery by tag (or search) to group them into **collections**.
- **One-tap prompt “spice”** — modifier chips (Harder, Levels, Particles, Neon,
  Retro…) that enrich your prompt before generating.
- **Chats + refine** — every game is a saved conversation; keep chatting
  (“make it faster”, “add enemies”) and the whole game regenerates in place.
- **💬 One thread — chat *and* games together** — toggle **✦ Make a game / 💬 Ask
  AI** anytime in the *same* conversation: it **builds the game files** and
  **answers you in text** (in your language), and it **knows the game it made**.
  No separate tabs. Uses the same free stack — **unlimited with Ollama** (no key,
  no credits). The Ollama *"model not found (404)"* error is fixed too — it uses
  the models you actually have installed — and *"model returned no usable files"*
  is much rarer now (the app salvages wrong-shape output and retries).
- **🧩 Starter templates** — instant, ready-made Web games (Snake, Pong, Flappy)
  created with **no AI and no wait**; then Play, edit the code, or refine in chat.
- **🎓 Guided tour** — a first-run coach-mark tour spotlights each step (connect →
  engine → prompt → generate → play), replayable anytime from **🎓 Tour**; the empty
  screen offers one-tap example prompts and quick shortcuts.
- **42 genre quick-starts + ✨ Enhance** — one-tap starter prompts per engine, and
  an Enhance button that expands a one-line idea into a full brief.
- **In-app code editor** — read/copy any generated file and **edit it in-app**:
  for **Web** games Save **re-runs** the preview instantly; for **Unity** it writes
  back to the project (recompiles on focus). Plus **🔁 Regenerate** and **📦 Share `.zip`**.
- **🩺 Auto QA + auto-fix** — for Web games the app **runs the game the moment it's
  generated**, catches runtime/console errors **and a blank/black screen**, and lets
  the AI **fix it automatically** before it opens (toggle **Auto-fix errors**); you
  can also re-run it anytime with **🔧 Check & fix**.
- **📱 Play on phone** — for Web games, start a tiny local server and get a LAN
  URL so you can open and play the game on your phone (same Wi‑Fi).
- **🆓 Works with zero setup** — the default **Free AI** is a **capable, hosted,
  no-key** model, so chat and game generation just work the moment you open the app
  (no sign-up, no key, nothing to install). Prefer your own? **Gemini** / **Groq**
  (free key) or offline **Ollama** are one click away.
- **Never runs out of free AI** — paste **multiple keys** to auto-rotate, **fall
  back across providers** automatically, retry rate-limits, and drop to **unlimited
  local Ollama** (offline, no key, no quota) as the last resort. Current Gemini
  model ids + auto-fallback if a model is retired — no more *“models no longer
  usable”* / *“quota exhausted”* dead ends.
- **Fully automatic** — **Auto-open when done** writes and launches the project the
  moment generation finishes. Write the prompt; it does the rest.
- **Electron app** (`desktop/`) — the provider is called in the main process (no CORS,
  your keys never leave your machine). Core logic is unit-tested (`npm test`).
- **Auto-built for Windows** by [`.github/workflows/release-desktop.yml`](./.github/workflows/release-desktop.yml):
  push a tag like `v1.0.25` (or run the workflow) and the installer is published to Releases.

Details: [`desktop/README.md`](./desktop/README.md).

## 🎮 The Unity plugin

The heart of the project. Copy [`unity/UnityGUI/`](./unity/UnityGUI/) into your project's
`Assets/` folder, open **Window ▸ UnityGUI ▸ AI Game Generator**, connect a **free** provider,
describe a game, and press **Generate**.

- **Free AI, in the Editor** — calls **Gemini / Groq / Ollama** directly with `UnityWebRequest`.
  No paid key, no backend, no extra packages.
- **Pro mode → real assets** — generates a saved **`.unity` scene**, **prefabs**, and procedural
  **art** (PNG sprites, materials, meshes) wired into a playable scene. The plugin writes gameplay
  scripts *and* an Editor `SceneBuilder`, then invokes it via reflection once Unity recompiles.
- **Lite mode → scripts only** — self-bootstrapping code that builds the whole game at Play time
  (a `[RuntimeInitializeOnLoadMethod]` entry point), no extra asset files.
- **Reliable output** — **JSON-mode** requests return a strict JSON set of files the plugin writes
  to disk (path-confined to your project).
- **Local key** — your free key is stored in Unity's EditorPrefs (local only).
- **Provider / model / style pickers** — Gemini, Groq or Ollama; 2D / 3D / Auto.

Full setup and troubleshooting: [`unity/UnityGUI/README.md`](./unity/UnityGUI/README.md).

```
unity/UnityGUI/Editor/
├── UnityGUIWindow.cs          # the Editor window (Window ▸ UnityGUI ▸ …)
├── GameGenerator.cs           # prompts, file writing, build handoff
├── GeneratedBuildRunner.cs    # runs the generated SceneBuilder after the recompile (Pro)
├── LLMClient.cs               # free-provider client — Gemini / Groq / Ollama (UnityWebRequest)
└── UnityGUI.Editor.asmdef      # Editor-only assembly definition
```

## 🌐 The companion website

A self-contained static site that presents the plugin and gates a **setup console** behind sign-in.

- **Landing** (`index.html`) — hero, genres you can generate, how-it-works, features, showcase,
  honest pricing (free plugin + your own API usage), FAQ.
- **Console** (`studio.html`) — **Sign in with Google**, then a step-by-step guide to install the
  plugin, get an API key, and generate your first game. The owner account
  (`servankangal21@gmail.com`) is flagged **PRO / unlimited**.

### Google sign-in setup

Real Google Sign-In uses [Google Identity Services](https://developers.google.com/identity/gsi/web).
To enable it:

1. Create an OAuth **Client ID** in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (type *Web application*), and add your origin (e.g. `http://localhost:8080`) as an
   **Authorized JavaScript origin**.
2. Paste the Client ID into [`js/config.js`](./js/config.js):

   ```js
   window.UnityGUIConfig = {
     GOOGLE_CLIENT_ID: "123456789-abc.apps.googleusercontent.com",
     OWNER_EMAIL: "servankangal21@gmail.com", // gets unlimited / PRO
     FREE_CREDITS: 25,
   };
   ```

Until a Client ID is set, the console runs in a clearly-marked **demo login** (enter an email) so
you can try it without setup. Sign in with the owner email to see the PRO/unlimited state.

> ⚠️ **Note on security:** the website's sign-in is a client-side gate — fine for a personal/demo
> build, not tamper-proof. The apps themselves need no login; they call the free AI provider with
> your own local key.

### Run the site

```bash
npm start                 # zero-dependency static server → http://localhost:8080
# or
python3 -m http.server 8080
```

## Notes

UnityGUI is an independent, educational project and is **not affiliated with Unity Technologies,
Roblox Corporation, Google, Groq, Ollama, or ForgeGUI**. "Unity", "Roblox", "Roblox Studio",
"Luau", "uGUI", "URP" and "HDRP" are referenced descriptively.

## License

[MIT](./LICENSE)
