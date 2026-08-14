// =============================================================================
//  UnityGUI — Game generator
//  Turns a text prompt into ready-to-run Unity C# game scripts by asking Claude
//  for a structured set of files, then writing them into the project.
// =============================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace UnityGUI.EditorTools
{
    public static class GameGenerator
    {
        public const int DefaultMaxTokens = 32000;

        // ---- Structured-output schema -----------------------------------------
        // Guarantees the model responds with exactly this JSON shape.
        public const string GameSchema =
@"{
  ""type"": ""object"",
  ""additionalProperties"": false,
  ""properties"": {
    ""game_name"": { ""type"": ""string"" },
    ""summary"": { ""type"": ""string"" },
    ""setup_notes"": { ""type"": ""string"" },
    ""files"": {
      ""type"": ""array"",
      ""items"": {
        ""type"": ""object"",
        ""additionalProperties"": false,
        ""properties"": {
          ""path"": { ""type"": ""string"" },
          ""content"": { ""type"": ""string"" }
        },
        ""required"": [""path"", ""content""]
      }
    }
  },
  ""required"": [""game_name"", ""summary"", ""setup_notes"", ""files""]
}";

        // ---- System prompt -----------------------------------------------------
        public static string BuildSystemPrompt(string outputFolder)
        {
            return
$@"You are an expert Unity gameplay engineer. From the user's description you generate a COMPLETE, PLAYABLE Unity game as one or more C# scripts.

TARGET
- Unity 2021 LTS or newer, the Built-in Render Pipeline, and the legacy Input Manager (UnityEngine.Input).
- Pure C# only. Use UnityEngine, UnityEngine.UI, and System. Do NOT depend on the new Input System, TextMeshPro, external packages, prefabs, textures, models, audio files, or .unity scene files.

SELF-BOOTSTRAPPING (critical)
- The game MUST run when the user presses Play in an EMPTY scene, with no manual setup.
- Achieve this by including ONE bootstrap MonoBehaviour with a static entry point:
      [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
      static void Boot() {{ ... }}
  In Boot(), create a GameObject and build the whole game from code: camera, lights,
  player, ground/level, enemies/obstacles, and UI. Use GameObject.CreatePrimitive,
  procedural meshes, primitive colliders, and code-driven materials
  (new Material(Shader.Find(""Standard"")) or Shader.Find(""Sprites/Default"")).
- Draw any HUD / score / instructions with UnityEngine.UI (built at runtime) or OnGUI.

CODE RULES
- Namespace every type under UnityGUI.Generated.
- Runtime scripts must NOT use the UnityEditor namespace and must NOT live in an Editor folder.
- Every file path must be under ""{outputFolder}/"" and end with "".cs"".
- Produce COMPILING code: complete methods, valid C#, no TODOs, no placeholders, no ellipses.
- Wire up real input, a clear objective, and a win/lose or score loop appropriate to the prompt.
- Keep the design focused and achievable — a small, complete, fun game beats an ambitious broken one.
- Prefer a handful of well-organized files over one giant file.

OUTPUT
- game_name: a short title.
- summary: 1-3 sentences describing the game.
- setup_notes: how to play (controls + objective) and anything the user should know.
- files: the C# scripts.
Do not include markdown, code fences, or XML tags such as <thinking> anywhere in your output.";
        }

        // ---- Result types ------------------------------------------------------
        [Serializable] public class GenResult { public string game_name; public string summary; public string setup_notes; public GenFile[] files; }
        [Serializable] public class GenFile { public string path; public string content; }

        public class WriteReport
        {
            public string gameName;
            public string summary;
            public string setupNotes;
            public List<string> writtenPaths = new List<string>();
            public List<string> skipped = new List<string>();
        }

        /// <summary>
        /// Generate a game and write its files. Callbacks run on the main thread.
        /// </summary>
        public static void Generate(
            string apiKey,
            string model,
            string prompt,
            string outputFolder,
            int maxTokens,
            Action<WriteReport> onDone,
            Action<string> onError,
            Action<float> onProgress = null)
        {
            outputFolder = NormalizeFolder(outputFolder);
            string system = BuildSystemPrompt(outputFolder);

            ClaudeClient.SendMessage(
                apiKey, model, system, prompt, GameSchema, maxTokens,
                onSuccess: text =>
                {
                    try
                    {
                        GenResult result = ParseResult(text);
                        if (result == null || result.files == null || result.files.Length == 0)
                        {
                            onError?.Invoke("The model did not return any files. Try a more specific prompt or a higher Max Tokens.");
                            return;
                        }
                        WriteReport report = WriteFiles(result, outputFolder);
                        AssetDatabase.Refresh();
                        onDone?.Invoke(report);
                    }
                    catch (Exception e)
                    {
                        onError?.Invoke("Failed to write generated files: " + e.Message);
                    }
                },
                onError: onError,
                onProgress: onProgress);
        }

        static GenResult ParseResult(string text)
        {
            // Structured outputs return clean JSON, but be defensive: strip any
            // accidental code fences and isolate the outermost JSON object.
            string json = text.Trim();
            if (json.StartsWith("```"))
            {
                int firstNl = json.IndexOf('\n');
                if (firstNl >= 0) json = json.Substring(firstNl + 1);
                if (json.EndsWith("```")) json = json.Substring(0, json.Length - 3);
                json = json.Trim();
            }
            int start = json.IndexOf('{');
            int end = json.LastIndexOf('}');
            if (start > 0 || (end >= 0 && end < json.Length - 1))
            {
                if (start >= 0 && end > start) json = json.Substring(start, end - start + 1);
            }
            return JsonUtility.FromJson<GenResult>(json);
        }

        static WriteReport WriteFiles(GenResult result, string outputFolder)
        {
            var report = new WriteReport
            {
                gameName = string.IsNullOrEmpty(result.game_name) ? "Generated Game" : result.game_name,
                summary = result.summary,
                setupNotes = result.setup_notes,
            };

            string projectRoot = Directory.GetParent(Application.dataPath).FullName; // parent of /Assets
            string safeRoot = Path.GetFullPath(Path.Combine(projectRoot, outputFolder));

            // Guard: everything must stay inside the chosen output folder under Assets.
            string assetsFull = Path.GetFullPath(Application.dataPath);
            if (!safeRoot.StartsWith(assetsFull, StringComparison.Ordinal))
            {
                throw new Exception($"Output folder '{outputFolder}' must be inside the Assets folder.");
            }

            foreach (var f in result.files)
            {
                if (f == null || string.IsNullOrEmpty(f.path) || f.content == null)
                {
                    report.skipped.Add(f?.path ?? "(null)");
                    continue;
                }

                string rel = f.path.Replace('\\', '/').TrimStart('/');
                // Force files under the output folder even if the model prefixed a different path.
                string fileName = Path.GetFileName(rel);
                if (!fileName.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
                {
                    report.skipped.Add(f.path);
                    continue;
                }

                // Preserve any sub-folders the model chose *below* the output folder.
                string subDir = "";
                string normOut = outputFolder.Replace('\\', '/').TrimEnd('/') + "/";
                if (rel.StartsWith(normOut, StringComparison.OrdinalIgnoreCase))
                    subDir = Path.GetDirectoryName(rel.Substring(normOut.Length)) ?? "";

                string targetDir = Path.GetFullPath(Path.Combine(projectRoot, outputFolder, subDir));
                if (!targetDir.StartsWith(assetsFull, StringComparison.Ordinal))
                {
                    report.skipped.Add(f.path);
                    continue;
                }

                Directory.CreateDirectory(targetDir);
                string full = Path.Combine(targetDir, fileName);
                File.WriteAllText(full, f.content, new UTF8Encoding(false));

                string projRel = full.Substring(projectRoot.Length + 1).Replace('\\', '/');
                report.writtenPaths.Add(projRel);
            }

            return report;
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
