# UnityGUI — AI Game Generator (Unity Editor plugin)

Describe a game in plain English, press **Generate**, and Claude writes
ready-to-run C# straight into your Unity project. Press **Play** in an empty
scene and the generated code bootstraps itself — no manual scene setup.

This is the Unity-side companion to the [UnityGUI](../../README.md) project. It
talks directly to the **Anthropic Messages API** from inside the Editor using
`UnityWebRequest` — no extra packages, no backend, no build step.

---

## Install

1. Copy the whole **`UnityGUI/`** folder (the one containing this README) into
   your project's `Assets/` folder — e.g. `Assets/UnityGUI/`.
2. Let Unity compile. A new menu appears: **Window ▸ UnityGUI ▸ AI Game Generator**.

That's it — the plugin is Editor-only code (guarded by an assembly definition),
so it never ships in your game build.

## Set up your API key

1. Get an Anthropic API key: <https://console.anthropic.com/settings/keys>.
2. Open **Window ▸ UnityGUI ▸ AI Game Generator** and paste the key into the
   **Anthropic API key** field.

The key is stored in **EditorPrefs on your machine only** — it is never written
to a file in the project and never committed. Usage is billed by Anthropic to
your own account (this is the "bring your own key" model).

## Generate a game

1. Pick a **model** (default `claude-opus-5` — the most capable; switch to
   `claude-sonnet-5` or `claude-haiku-4-5` for faster/cheaper runs).
2. **Describe your game** (or click *Insert an idea* for a starter prompt), e.g.

   > A 2D endless runner where a cube jumps over incoming obstacles.
   > Space to jump, score for distance.

3. Press **✦ Generate Game**. After a few seconds the files appear under
   `Assets/UnityGUI/Generated/` and the window shows a summary and how-to-play.
4. Open an **empty scene** and press **Play**.

## How it works

- The plugin sends your prompt plus a system prompt to `POST /v1/messages`.
- It uses **structured outputs** (`output_config.format`) so the model returns a
  strict JSON object of `{ path, content }` files — reliably parseable.
- Generated scripts are **self-bootstrapping**: each game includes a
  `[RuntimeInitializeOnLoadMethod]` entry point that builds the camera, player,
  level and UI from code, so pressing Play just works in any scene.
- Everything is generated under the `UnityGUI.Generated` namespace, using only
  `UnityEngine` / `UnityEngine.UI` — no external assets.

```
UnityGUI/
└── Editor/
    ├── UnityGUIWindow.cs        # the Editor window (Window ▸ UnityGUI ▸ …)
    ├── GameGenerator.cs         # system prompt, schema, file writing
    ├── ClaudeClient.cs          # Messages API client (UnityWebRequest)
    └── UnityGUI.Editor.asmdef   # Editor-only assembly definition
```

## Notes & limits

- **First version generates self-contained code-driven games.** It does not (yet)
  create `.unity` scenes, prefabs, or import art assets — the game is built at
  runtime from primitives and code. This keeps results reliable and portable.
- Results vary with the prompt and model. Be specific about controls, objective,
  and win/lose conditions for the best output.
- If a file fails to compile, re-generate with a clearer prompt, or edit the
  generated C# directly — it's plain, readable code in your project.
- Requires internet access from the Editor to reach `api.anthropic.com`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No API key set" | Paste your key in the window; get one at the link above. |
| `authentication_error` | The key is wrong or revoked — paste a fresh one. |
| `not_found_error` / model 404 | Your account may not have access to that model — pick another in the Model dropdown. |
| "did not return any files" | Raise **Max tokens**, or make the prompt more specific. |
| Generated code won't compile | Re-generate, simplify the prompt, or fix the C# directly. |

## License

MIT — see the [root LICENSE](../../LICENSE).
