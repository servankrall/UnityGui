<div align="center">

# UnityGUI

**Generate playable Unity games from a prompt — right inside the Editor.**

Describe a game → Claude writes ready-to-run C# into your project → press Play.

A Unity-focused take on the [ForgeGUI](https://forgegui.com) "describe-to-generate" concept,
rebuilt as a **Unity Editor plugin** that produces runnable games (powered by the Claude API),
plus a companion marketing site and sign-in console.

</div>

---

## Two parts

| | What it is | Where |
|---|---|---|
| 🎮 **Unity Editor plugin** | The product. A `Window ▸ UnityGUI` tool that turns a prompt into a complete, self-bootstrapping Unity game (C#), via the Claude API. | [`unity/UnityGUI/`](./unity/UnityGUI/) |
| 🌐 **Companion website** | Landing page + Google sign-in **console** (setup & download hub) for the plugin. Static, no build step. | repo root (`index.html`, `studio.html`) |

## 🎮 The Unity plugin

The heart of the project. Copy [`unity/UnityGUI/`](./unity/UnityGUI/) into your project's
`Assets/` folder, open **Window ▸ UnityGUI ▸ AI Game Generator**, paste your Anthropic API key,
describe a game, and press **Generate**.

- **Real AI, in the Editor** — calls the Anthropic **Messages API** directly with `UnityWebRequest`.
  No backend, no extra packages.
- **Pro mode → real assets** — generates a saved **`.unity` scene**, **prefabs**, and procedural
  **art** (PNG sprites, materials, meshes) wired into a playable scene. The plugin writes gameplay
  scripts *and* an Editor `SceneBuilder`, then invokes it via reflection once Unity recompiles.
- **Lite mode → scripts only** — self-bootstrapping code that builds the whole game at Play time
  (a `[RuntimeInitializeOnLoadMethod]` entry point), no extra asset files.
- **Reliable output** — **structured outputs** (`output_config.format`) return a strict JSON set of
  files the plugin writes to disk (path-confined to your project).
- **Bring your own key** — stored in Unity's EditorPrefs (local only), billed to your account.
- **Model / style pickers** — defaults to `claude-opus-5`; choose 2D / 3D / Auto.

Full setup and troubleshooting: [`unity/UnityGUI/README.md`](./unity/UnityGUI/README.md).

```
unity/UnityGUI/Editor/
├── UnityGUIWindow.cs          # the Editor window (Window ▸ UnityGUI ▸ …)
├── GameGenerator.cs           # prompts, output schema, file writing, build handoff
├── GeneratedBuildRunner.cs    # runs the generated SceneBuilder after the recompile (Pro)
├── ClaudeClient.cs            # Anthropic Messages API client (UnityWebRequest)
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
> build, not tamper-proof. The plugin itself needs no login; it authenticates to Anthropic with
> your own API key.

### Run the site

```bash
npm start                 # zero-dependency static server → http://localhost:8080
# or
python3 -m http.server 8080
```

## Notes

UnityGUI is an independent, educational project and is **not affiliated with Unity Technologies,
Anthropic, or ForgeGUI**. "Unity", "uGUI", "URP" and "HDRP" are referenced descriptively.

## License

[MIT](./LICENSE)
