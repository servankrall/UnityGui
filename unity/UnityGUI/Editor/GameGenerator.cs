// =============================================================================
//  UnityGUI — Game generator
//  Turns a text prompt into a real Unity game. Two modes:
//   • Pro  : gameplay scripts + an Editor SceneBuilder that creates ART assets
//            (PNG sprites, materials, meshes), PREFABS, and a saved .unity SCENE.
//   • Lite : self-bootstrapping scripts only (no scene/prefab/art files).
// =============================================================================
using System;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace UnityGUI.EditorTools
{
    public enum GenMode { Pro, Lite }
    public enum GameStyle { Auto, TwoD, ThreeD }

    /// <summary>Serializable record of the most recent generation, persisted across
    /// domain reloads via EditorPrefs so the window can show results after the
    /// generated scripts compile.</summary>
    [Serializable]
    public class RunRecord
    {
        public string phase;         // "scripts", "building", "built", "error"
        public string mode;          // "Pro" / "Lite"
        public string gameName;
        public string summary;
        public string setupNotes;
        public string folder;
        public string scenePath;     // set by the builder step
        public string assetSummary;  // e.g. "3 prefabs · 5 sprites · 2 materials"
        public string error;
        public string[] scriptPaths;
    }

    public static class RunStore
    {
        const string KEY = "UnityGUI.LastRun";
        public static void Save(RunRecord r) { EditorPrefs.SetString(KEY, r == null ? "" : JsonUtility.ToJson(r)); }
        public static RunRecord Load()
        {
            string s = EditorPrefs.GetString(KEY, "");
            return string.IsNullOrEmpty(s) ? null : JsonUtility.FromJson<RunRecord>(s);
        }
        public static void Clear() { EditorPrefs.DeleteKey(KEY); }
    }

    public static class GameGenerator
    {
        public const int DefaultMaxTokens = 40000;

        // Fixed entry point the generated Pro build must expose. The plugin invokes
        // this via reflection after the generated scripts compile.
        public const string BuilderType = "UnityGUI.Generated.SceneBuilder";
        public const string BuilderMethod = "BuildAll";

        // EditorPrefs handshake keys for the post-compile build step.
        public const string PendingKey = "UnityGUI.Build.Pending";

        // ---- Result types ------------------------------------------------------
        [Serializable] public class GenResult { public string game_name; public string summary; public string setup_notes; public GenFile[] files; }
        [Serializable] public class GenFile { public string path; public string content; }

        // ---- System prompts ----------------------------------------------------
        static string StyleLine(GameStyle style)
        {
            switch (style)
            {
                case GameStyle.TwoD: return "Make a 2D game (orthographic camera, SpriteRenderer, 2D physics if needed).";
                case GameStyle.ThreeD: return "Make a 3D game (perspective camera, MeshRenderer, primitives, a directional light).";
                default: return "Choose 2D or 3D based on what best fits the request.";
            }
        }

        public static string BuildProSystem(string outputFolder, GameStyle style)
        {
            return
$@"You are a senior Unity gameplay engineer. From the user's description you produce a COMPLETE, POLISHED, PLAYABLE Unity game as C# files, AND an Editor build script that creates real project assets: generated ART, PREFABS, and a saved .unity SCENE.

TARGET
- Unity 2021 LTS or newer, Built-in Render Pipeline, legacy Input Manager (UnityEngine.Input), UnityEngine.UI (no TextMeshPro).
- Pure C# only. No external packages, no downloaded art. All art is generated procedurally in code.
- {StyleLine(style)}

FILES YOU MUST RETURN
1) Gameplay scripts (runtime): plain MonoBehaviours under ""{outputFolder}/"", namespace UnityGUI.Generated.
   - Public [SerializeField]/public fields for tuning and references. NO UnityEditor usage. NO [RuntimeInitializeOnLoadMethod] (the scene is prebuilt, so it must not spawn a second game).
2) EXACTLY ONE Editor build script at ""{outputFolder}/Editor/SceneBuilder.cs"":
   - namespace UnityGUI.Generated;  public static class SceneBuilder  with  public static void BuildAll().
   - It may use UnityEditor, UnityEditor.SceneManagement, UnityEngine. It builds everything and SAVES assets to disk:

   ART (save real files under ""{outputFolder}/Art/""):
     - Sprites/textures: build Texture2D in code, EncodeToPNG(), File.WriteAllBytes to a .png, AssetDatabase.ImportAsset, then set its TextureImporter (textureType = Sprite for 2D, filterMode Point for pixel art) and reimport; load the Sprite with AssetDatabase.LoadAssetAtPath.
     - Materials: new Material(Shader.Find(""Standard"")) (or Shader.Find(""Sprites/Default"") for 2D), set colors, AssetDatabase.CreateAsset to a .mat.
     - Optional meshes: build a Mesh and AssetDatabase.CreateAsset to a .asset.
   PREFABS (save under ""{outputFolder}/Prefabs/""):
     - Construct GameObjects (primitives / SpriteRenderers) with the generated art + gameplay components, then PrefabUtility.SaveAsPrefabAsset(go, path). Destroy the temp GameObject with Object.DestroyImmediate afterwards.
   SCENE (save under ""{outputFolder}/Scenes/<GameName>.unity""):
     - EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single).
     - Create the Main Camera (2D => orthographic; 3D => perspective + a Directional Light), the player, the level/enemies/obstacles, and a uGUI Canvas with score/health/instructions (UnityEngine.UI.Text). Add an EventSystem if the UI needs input.
     - Instantiate prefabs where appropriate, attach the gameplay MonoBehaviours, and set their public fields so the game is fully wired and PLAYABLE on Play.
     - EditorSceneManager.SaveScene(scene, ""{outputFolder}/Scenes/<GameName>.unity""); add it to EditorBuildSettings.scenes; leave it open as the active scene.
     - Finish with AssetDatabase.SaveAssets(); AssetDatabase.Refresh(); and Debug.Log(""[UnityGUI] Built <GameName>"").
   - Ensure the folders exist first (Directory.CreateDirectory on the absolute paths, then AssetDatabase.Refresh, or AssetDatabase.CreateFolder step by step).

HARD REQUIREMENTS
- Everything MUST COMPILE: valid C#, correct Unity/UnityEditor API usage, complete methods, no TODOs, no ellipses, no placeholders.
- After BuildAll() runs and the user presses Play in the built scene, the game must actually work (input, objective, win/lose or score).
- Aim for a polished, ""juicy"" feel where cheap: color, simple particles or tweened scale via code, a clear HUD and a game-over/restart. Keep it focused enough to be complete and correct.
- Prefer several small, well-named files over one huge file.

OUTPUT — respond with ONLY a single JSON object, no markdown and no code fences, with EXACTLY these keys:
  ""game_name"": string (short title, filename-safe — used for the scene file name),
  ""summary"": string (1-3 sentences),
  ""setup_notes"": string (controls, objective, and what was created: scene, prefabs, art),
  ""files"": array of objects, each {{ ""path"": string, ""content"": string (the full C# source) }}
Do not include XML tags such as <thinking> anywhere.";
        }

        public static string BuildLiteSystem(string outputFolder, GameStyle style)
        {
            return
$@"You are an expert Unity gameplay engineer. From the user's description you generate a COMPLETE, PLAYABLE Unity game as one or more C# scripts.

TARGET
- Unity 2021 LTS or newer, Built-in Render Pipeline, legacy Input Manager (UnityEngine.Input), UnityEngine.UI. Pure C# only; no external packages, prefabs, textures, models, or .unity scene files.
- {StyleLine(style)}

SELF-BOOTSTRAPPING (critical)
- The game MUST run when the user presses Play in an EMPTY scene, with no manual setup.
- Include ONE bootstrap MonoBehaviour with:
      [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
      static void Boot() {{ ... }}
  In Boot(), create a GameObject and build the whole game from code: camera, lights, player, level, enemies/obstacles and UI, using GameObject.CreatePrimitive, procedural meshes, primitive colliders, and code-driven materials.
- Draw the HUD/instructions with UnityEngine.UI (built at runtime) or OnGUI.

CODE RULES
- Namespace every type under UnityGUI.Generated. Runtime scripts must NOT use UnityEditor and must NOT live in an Editor folder.
- Every file path under ""{outputFolder}/"" ending in "".cs"". Produce COMPILING code — complete, valid C#, no placeholders.
- Wire real input, a clear objective, and a win/lose or score loop.

OUTPUT — respond with ONLY a single JSON object, no markdown and no code fences, with EXACTLY these keys:
  ""game_name"": string, ""summary"": string, ""setup_notes"": string (how to play),
  ""files"": array of {{ ""path"": string (under {outputFolder}/, ends with .cs), ""content"": string }}
Do not include XML tags such as <thinking>.";
        }

        // ---- Generate ----------------------------------------------------------
        public static void Generate(
            LLMProvider provider, string apiKey, string model, string prompt, string outputFolder,
            GenMode mode, GameStyle style, int maxTokens,
            Action<RunRecord> onWritten,   // fired after scripts are written (Pro: build follows on reload)
            Action<string> onError,
            Action<float> onProgress = null)
        {
            outputFolder = NormalizeFolder(outputFolder);
            string system = mode == GenMode.Pro
                ? BuildProSystem(outputFolder, style)
                : BuildLiteSystem(outputFolder, style);

            LLMClient.Send(
                provider, apiKey, model, system, prompt, true, maxTokens,
                onSuccess: text =>
                {
                    try
                    {
                        GenResult result = ParseResult(text);
                        if (result == null || result.files == null || result.files.Length == 0)
                        {
                            onError?.Invoke("The model returned no files. Try a more specific prompt or a higher Max Tokens.");
                            return;
                        }

                        var scriptPaths = WriteFiles(result, outputFolder);
                        if (scriptPaths.Count == 0)
                        {
                            onError?.Invoke("No .cs files were produced. Try again.");
                            return;
                        }

                        var record = new RunRecord
                        {
                            mode = mode.ToString(),
                            gameName = string.IsNullOrEmpty(result.game_name) ? "Generated Game" : result.game_name,
                            summary = result.summary,
                            setupNotes = result.setup_notes,
                            folder = outputFolder,
                            scriptPaths = scriptPaths.ToArray(),
                            phase = mode == GenMode.Pro ? "building" : "scripts",
                        };
                        RunStore.Save(record);

                        onWritten?.Invoke(record);

                        if (mode == GenMode.Pro)
                            EditorPrefs.SetBool(PendingKey, true); // build runs after the reload triggered below

                        // Import + compile the new scripts. In Pro mode this triggers a
                        // domain reload; GeneratedBuildRunner then invokes SceneBuilder.
                        AssetDatabase.Refresh();
                    }
                    catch (Exception e)
                    {
                        onError?.Invoke("Failed to write generated files: " + e.Message);
                    }
                },
                onError: onError,
                onProgress: onProgress);
        }

        // ---- Parsing & writing -------------------------------------------------
        static GenResult ParseResult(string text)
        {
            string json = text.Trim();
            if (json.StartsWith("```"))
            {
                int nl = json.IndexOf('\n');
                if (nl >= 0) json = json.Substring(nl + 1);
                if (json.EndsWith("```")) json = json.Substring(0, json.Length - 3);
                json = json.Trim();
            }
            int start = json.IndexOf('{');
            int end = json.LastIndexOf('}');
            if (start >= 0 && end > start) json = json.Substring(start, end - start + 1);
            return JsonUtility.FromJson<GenResult>(json);
        }

        static System.Collections.Generic.List<string> WriteFiles(GenResult result, string outputFolder)
        {
            var written = new System.Collections.Generic.List<string>();
            string projectRoot = Directory.GetParent(Application.dataPath).FullName;
            string assetsFull = Path.GetFullPath(Application.dataPath);
            string normOut = outputFolder.Replace('\\', '/').TrimEnd('/') + "/";

            foreach (var f in result.files)
            {
                if (f == null || string.IsNullOrEmpty(f.path) || f.content == null) continue;

                string rel = f.path.Replace('\\', '/').TrimStart('/');
                string fileName = Path.GetFileName(rel);
                if (!fileName.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) continue;

                // Preserve any sub-folders the model chose below the output folder.
                string subDir = "";
                if (rel.StartsWith(normOut, StringComparison.OrdinalIgnoreCase))
                    subDir = Path.GetDirectoryName(rel.Substring(normOut.Length)) ?? "";

                string targetDir = Path.GetFullPath(Path.Combine(projectRoot, outputFolder, subDir));
                if (!targetDir.StartsWith(assetsFull, StringComparison.Ordinal)) continue;

                Directory.CreateDirectory(targetDir);
                string full = Path.Combine(targetDir, fileName);
                File.WriteAllText(full, f.content, new UTF8Encoding(false));
                written.Add(full.Substring(projectRoot.Length + 1).Replace('\\', '/'));
            }
            return written;
        }

        static string NormalizeFolder(string folder)
        {
            if (string.IsNullOrEmpty(folder)) return "Assets/UnityGUI/Generated";
            folder = folder.Replace('\\', '/').Trim().TrimEnd('/');
            if (!folder.StartsWith("Assets")) folder = "Assets/" + folder.TrimStart('/');
            return folder;
        }
    }
}
