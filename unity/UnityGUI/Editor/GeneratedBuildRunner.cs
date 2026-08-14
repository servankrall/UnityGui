// =============================================================================
//  UnityGUI — Post-compile build runner
//  After the plugin writes generated scripts (Pro mode) and Unity recompiles,
//  this invokes the generated UnityGUI.Generated.SceneBuilder.BuildAll() via
//  reflection to create the real scene / prefab / art assets, then records the
//  result so the window can show it.
// =============================================================================
using System;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace UnityGUI.EditorTools
{
    [InitializeOnLoad]
    public static class GeneratedBuildRunner
    {
        static GeneratedBuildRunner()
        {
            if (EditorPrefs.GetBool(GameGenerator.PendingKey, false))
                EditorApplication.delayCall += RunWhenReady;
        }

        static void RunWhenReady()
        {
            // Wait until Unity has finished importing/compiling before invoking.
            if (EditorApplication.isCompiling || EditorApplication.isUpdating)
            {
                EditorApplication.delayCall += RunWhenReady;
                return;
            }

            // Clear the flag first so a failure can never loop.
            EditorPrefs.SetBool(GameGenerator.PendingKey, false);

            var record = RunStore.Load() ?? new RunRecord();

            // If the generated scripts failed to compile, the builder type won't exist.
#pragma warning disable 618
            bool compileFailed = EditorUtility.scriptCompilationFailed;
#pragma warning restore 618

            Type builder = FindType(GameGenerator.BuilderType);
            if (builder == null)
            {
                record.phase = "error";
                record.error = compileFailed
                    ? "The generated scripts didn't compile. Open the Console for the exact errors, then re-generate or fix the code."
                    : "Couldn't find the generated SceneBuilder. Re-generate, or check the Console for details.";
                RunStore.Save(record);
                Debug.LogError("[UnityGUI] " + record.error);
                return;
            }

            MethodInfo build = builder.GetMethod(GameGenerator.BuilderMethod,
                BindingFlags.Public | BindingFlags.Static);
            if (build == null)
            {
                record.phase = "error";
                record.error = $"SceneBuilder is missing a public static {GameGenerator.BuilderMethod}() method.";
                RunStore.Save(record);
                Debug.LogError("[UnityGUI] " + record.error);
                return;
            }

            try
            {
                build.Invoke(null, null);

                // The builder saves + opens the scene; capture whatever is now active.
                Scene active = SceneManager.GetActiveScene();
                record.scenePath = active.IsValid() ? active.path : "";
                record.assetSummary = SummarizeAssets(record.folder);
                record.error = "";
                record.phase = "built";
                RunStore.Save(record);

                Debug.Log($"[UnityGUI] Built \"{record.gameName}\" — {record.assetSummary}. Press Play to try it.");

                if (!string.IsNullOrEmpty(record.scenePath))
                {
                    var sceneAsset = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(record.scenePath);
                    if (sceneAsset != null) EditorGUIUtility.PingObject(sceneAsset);
                }
            }
            catch (Exception e)
            {
                var inner = e.InnerException ?? e;
                record.phase = "error";
                record.error = "SceneBuilder threw while building: " + inner.Message;
                RunStore.Save(record);
                Debug.LogError("[UnityGUI] " + record.error + "\n" + inner);
            }
        }

        static Type FindType(string fullName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                var t = asm.GetType(fullName, false);
                if (t != null) return t;
            }
            return null;
        }

        static string SummarizeAssets(string folder)
        {
            if (string.IsNullOrEmpty(folder)) return "assets created";
            string abs;
            try { abs = Path.GetFullPath(Path.Combine(Directory.GetParent(Application.dataPath).FullName, folder)); }
            catch { return "assets created"; }
            if (!Directory.Exists(abs)) return "assets created";

            int Count(string pat) { try { return Directory.GetFiles(abs, pat, SearchOption.AllDirectories).Length; } catch { return 0; } }
            int scenes = Count("*.unity");
            int prefabs = Count("*.prefab");
            int sprites = Count("*.png");
            int mats = Count("*.mat");
            int meshes = Count("*.asset");

            var parts = new System.Collections.Generic.List<string>();
            if (scenes > 0) parts.Add($"{scenes} scene{(scenes == 1 ? "" : "s")}");
            if (prefabs > 0) parts.Add($"{prefabs} prefab{(prefabs == 1 ? "" : "s")}");
            if (sprites > 0) parts.Add($"{sprites} sprite{(sprites == 1 ? "" : "s")}");
            if (mats > 0) parts.Add($"{mats} material{(mats == 1 ? "" : "s")}");
            if (meshes > 0) parts.Add($"{meshes} mesh{(meshes == 1 ? "" : "es")}");
            return parts.Count > 0 ? string.Join(" · ", parts) : "assets created";
        }
    }
}
