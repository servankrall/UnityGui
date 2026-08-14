# UnityGUI Desktop

A one-click desktop app (Windows `.exe`) that generates **Unity games from a prompt** —
no repo cloning, no plugin copying, no website. **Free to run**: it uses a free AI
provider (no paid Claude key). Connect once, describe a game, and save it as a
ready-to-open Unity project.

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
2. **Describe your game** — pick a model and a style (Auto / 2D / 3D), then press
   **✦ Generate game**.
3. **Save as Unity project** — choose a folder; the app writes a complete
   `UnityGUI-<Game>` project. Open it in **Unity Hub** (Add ▸ pick the folder,
   Unity 2021 LTS or newer) and press **Play** — the game builds itself and runs.

## Build it yourself

Requires Node 18+.

```bash
cd desktop
npm install
npm start        # run the app in dev
npm run dist     # build the Windows installer into desktop/dist/
```

The Windows `.exe` is also built automatically by
[`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml):
push a tag like `v1.0.0` (or run the workflow manually) and the installer is
published to Releases.

```
desktop/
├── main.js               # Electron main: free-provider LLM calls + Unity project writer
├── preload.js            # safe IPC bridge
├── renderer/             # UI (index.html, style.css, app.js)
├── assets/icon.png       # app icon
└── package.json          # electron + electron-builder (one-click NSIS installer)
```

## Notes

- The app **generates a Unity project** — Unity itself is still what runs the game
  (it's a Unity game). The app removes the setup friction; you just open the folder
  and press Play.
- Games are self-bootstrapping (built from code at Play time), 2D or 3D, using only
  `UnityEngine` / `UnityEngine.UI`.
- Prefer generating **scene + prefab + art assets** and working inside the Editor?
  Use the [Unity plugin](../unity/UnityGUI/) instead.

MIT — see the [root LICENSE](../LICENSE).
