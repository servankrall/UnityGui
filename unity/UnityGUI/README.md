# UnityGUI — AI Game Generator (Unity Editor plugin)

Describe a game in plain English, press **Generate**, and a **free AI** builds it
in your Unity project. In **Pro** mode it generates a real **`.unity` scene**,
**prefabs**, and **procedural art assets** (PNG sprites, materials, meshes) —
open the scene and press **Play**.

This is the Unity-side companion to the [UnityGUI](../../README.md) project. It
talks directly to a **free AI provider** from inside the Editor using
`UnityWebRequest` — **no paid Claude key**, no extra packages, no backend, no build step.

## Two output modes

| Mode | What you get | When |
|---|---|---|
| **Pro** (default) | A saved `.unity` **scene**, **prefabs**, and generated **art** (sprites/materials/meshes) wired into a playable scene. | You want real assets you can edit in the Inspector. |
| **Lite** | Self-bootstrapping **scripts only** — one script builds the whole game from code at Play time (no scene/prefab/art files). | Fastest path; a single self-contained script set. |

---

## Install

1. Copy the whole **`UnityGUI/`** folder (the one containing this README) into
   your project's `Assets/` folder — e.g. `Assets/UnityGUI/`.
2. Let Unity compile. A new menu appears: **Window ▸ UnityGUI ▸ AI Game Generator**.

That's it — the plugin is Editor-only code (guarded by an assembly definition),
so it never ships in your game build.

## Connect a free provider

Open **Window ▸ UnityGUI ▸ AI Game Generator**, pick a **Provider**, and paste its
**free** key (Ollama needs none):

| Provider | Cost | Free key |
|---|---|---|
| **Google Gemini** | Free tier, no credit card | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **Groq** | Free, very fast | [console.groq.com](https://console.groq.com/keys) |
| **Ollama** | 100% free, offline, no key | install [ollama.com](https://ollama.com/download), then `ollama pull qwen2.5-coder` |

The key is stored in **EditorPrefs on your machine only** — never written to a
file in the project and never committed.

## Generate a game

1. Pick a **Provider** + **Model**, an **Output** mode (Pro/Lite), and a
   **Style** (Auto / 2D / 3D).
2. **Describe your game** (or click *Insert an idea*), e.g.

   > A 2D endless runner where a cube jumps over incoming obstacles.
   > Space to jump, score for distance.

3. Press **✦ Generate Game**.
   - **Pro:** the plugin writes the scripts, Unity recompiles, then it builds the
     scene/prefabs/art. When it's done, click **Open scene** in the window and
     press **Play**.
   - **Lite:** the scripts are written; open an empty scene and press **Play**.

## How it works

- The plugin sends your prompt plus a system prompt to your chosen free provider
  (Gemini / Groq / Ollama) in **JSON mode**, so the model returns a strict JSON
  object of `{ path, content }` files — reliably parseable.
- **Pro mode** asks the model for gameplay scripts *and* an Editor
  `SceneBuilder.BuildAll()`. After the new scripts compile, the plugin invokes
  that builder via reflection to create real assets:
  - **Art** — procedural `Texture2D` → PNG sprites, `Material`s, and `Mesh`es
    saved under `…/Art/`.
  - **Prefabs** — assembled GameObjects saved under `…/Prefabs/`.
  - **Scene** — a `.unity` scene wired up and saved under `…/Scenes/`, added to
    Build Settings and opened.
- **Lite mode** produces self-bootstrapping scripts: a `[RuntimeInitializeOnLoadMethod]`
  entry point builds everything from code at Play time.
- Everything is generated under the `UnityGUI.Generated` namespace using only
  `UnityEngine` / `UnityEngine.UI` — no downloaded assets.

```
UnityGUI/
└── Editor/
    ├── UnityGUIWindow.cs          # the Editor window (Window ▸ UnityGUI ▸ …)
    ├── GameGenerator.cs           # prompts, file writing, build handoff
    ├── GeneratedBuildRunner.cs    # runs SceneBuilder after the recompile (Pro)
    ├── LLMClient.cs               # free-provider client (Gemini/Groq/Ollama)
    └── UnityGUI.Editor.asmdef     # Editor-only assembly definition
```

## Notes & limits

- **Art is generated procedurally in code** (shapes, gradients, pixel sprites,
  simple materials/meshes) — it doesn't download or paint bitmap art. That keeps
  results reliable and dependency-free.
- Results vary with the prompt and model. Be specific about controls, objective,
  and win/lose conditions. A capable model (e.g. Gemini 2.0 Flash or Groq's
  Llama 3.3 70B) gives the best Pro-mode results.
- If the generated scripts fail to compile, the window says so — open the Console
  for the exact errors, then re-generate with a clearer prompt or fix the C#
  directly (it's plain, readable code in your project).
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
