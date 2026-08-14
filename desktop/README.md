# UnityGUI Desktop

A one-click desktop app (Windows `.exe`) that generates **Unity games from a prompt** —
no repo cloning, no plugin copying, no website. Connect your Anthropic key once,
describe a game, and save it as a ready-to-open Unity project.

## Get it (Releases)

Download the latest **`UnityGUI-Setup-*.exe`** from the repo's
[**Releases**](https://github.com/servankrall/UnityGui/releases) page, run it
(one-click install), and launch **UnityGUI** from the Start menu / desktop shortcut.

> The build is unsigned, so Windows SmartScreen may show a warning the first time —
> choose **More info ▸ Run anyway**.

## Use it

1. **Connect** — paste your Anthropic API key (get one at
   [console.anthropic.com](https://console.anthropic.com/settings/keys)) and click
   **Connect**. It's stored only on your PC and billed to your own Anthropic account.
2. **Describe your game** — pick a model (default `claude-opus-5`) and a style
   (Auto / 2D / 3D), then press **✦ Generate game**.
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
├── main.js               # Electron main: Claude API call + Unity project writer
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
