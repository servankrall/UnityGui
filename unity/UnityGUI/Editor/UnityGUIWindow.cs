// =============================================================================
//  UnityGUI — AI Game Generator window
//  Open from:  Window ▸ UnityGUI ▸ AI Game Generator
//  Uses FREE AI providers (Gemini / Groq / Ollama) — no paid Claude key.
//  Pro mode writes real scene / prefab / art assets; Lite writes self-
//  bootstrapping scripts only. Results survive the post-generation recompile.
// =============================================================================
using UnityEditor;
using UnityEngine;

namespace UnityGUI.EditorTools
{
    public class UnityGUIWindow : EditorWindow
    {
        const string KEY_PROVIDER = "UnityGUI.Provider";
        const string KEY_KEYPREFIX = "UnityGUI.Key.";      // + provider
        const string KEY_MODELPREFIX = "UnityGUI.Model.";  // + provider
        const string KEY_PROMPT = "UnityGUI.Prompt";
        const string KEY_FOLDER = "UnityGUI.OutputFolder";
        const string KEY_MAXTOK = "UnityGUI.MaxTokens";
        const string KEY_MODE = "UnityGUI.Mode";
        const string KEY_STYLE = "UnityGUI.Style";

        static readonly string[] ProviderLabels = { "Google Gemini — free", "Groq — free & fast", "Ollama — local, no key" };
        static readonly string[] ModeLabels = { "Scene + Prefabs + Art (Pro)", "Scripts only (Lite)" };
        static readonly string[] StyleLabels = { "Auto", "2D", "3D" };

        static readonly string[] Examples =
        {
            "A 2D endless runner where a cube jumps over incoming obstacles. Space to jump, score for distance.",
            "A top-down twin-stick shooter: WASD to move, mouse to aim and shoot spawning enemies. Health bar and score.",
            "A simple 3D first-person maze: WASD + mouse look, find the glowing exit. Timer on screen.",
            "A brick-breaker (breakout) game: paddle on arrow keys, bounce the ball to clear all bricks, lives counter.",
            "A tiny platformer: a capsule collects coins on floating platforms. Arrow keys to move, space to jump.",
        };

        LLMProvider _provider = LLMProvider.Gemini;
        string _apiKey = "";
        int _modelIndex = 0;
        string _prompt = "";
        string _outputFolder = "Assets/UnityGUI/Generated";
        int _maxTokens = GameGenerator.DefaultMaxTokens;
        GenMode _mode = GenMode.Pro;
        GameStyle _style = GameStyle.Auto;

        bool _busy;
        float _elapsed;
        string _status = "";
        MessageType _statusType = MessageType.None;
        RunRecord _run;
        bool _polling;
        Vector2 _scroll, _promptScroll;

        [MenuItem("Window/UnityGUI/AI Game Generator")]
        public static void Open()
        {
            var w = GetWindow<UnityGUIWindow>("UnityGUI");
            w.minSize = new Vector2(440, 640);
            w.Show();
        }

        string[] Models => LLMClient.ModelsFor(_provider);

        void OnEnable()
        {
            _provider = (LLMProvider)EditorPrefs.GetInt(KEY_PROVIDER, (int)LLMProvider.Gemini);
            LoadProviderState();
            _prompt = EditorPrefs.GetString(KEY_PROMPT, "");
            _outputFolder = EditorPrefs.GetString(KEY_FOLDER, "Assets/UnityGUI/Generated");
            _maxTokens = EditorPrefs.GetInt(KEY_MAXTOK, GameGenerator.DefaultMaxTokens);
            _mode = (GenMode)EditorPrefs.GetInt(KEY_MODE, (int)GenMode.Pro);
            _style = (GameStyle)EditorPrefs.GetInt(KEY_STYLE, (int)GameStyle.Auto);

            _run = RunStore.Load();
            if (_run != null && _run.phase == "building") StartPolling();
        }
        void OnDisable() { StopPolling(); }

        void LoadProviderState()
        {
            _apiKey = EditorPrefs.GetString(KEY_KEYPREFIX + _provider, "");
            string savedModel = EditorPrefs.GetString(KEY_MODELPREFIX + _provider, Models[0]);
            _modelIndex = Mathf.Max(0, System.Array.IndexOf(Models, savedModel));
        }

        void OnGUI()
        {
            _scroll = EditorGUILayout.BeginScrollView(_scroll);

            DrawHeader();
            EditorGUILayout.Space(6);
            DrawProvider();
            EditorGUILayout.Space(4);
            DrawApiKey();
            EditorGUILayout.Space(4);
            DrawModelRow();
            EditorGUILayout.Space(8);
            DrawPrompt();
            EditorGUILayout.Space(4);
            DrawOptions();
            EditorGUILayout.Space(8);
            DrawGenerateButton();
            EditorGUILayout.Space(6);
            DrawStatus();
            DrawRun();

            EditorGUILayout.EndScrollView();
        }

        // ---- Sections ----------------------------------------------------------

        void DrawHeader()
        {
            EditorGUILayout.LabelField("UnityGUI — AI Game Generator",
                new GUIStyle(EditorStyles.boldLabel) { fontSize = 15 });
            EditorGUILayout.LabelField("Describe a game. A free AI writes it into your project — no paid Claude key.",
                EditorStyles.miniLabel);
        }

        void DrawProvider()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Provider", GUILayout.Width(60));
                int p = EditorGUILayout.Popup((int)_provider, ProviderLabels);
                if (p != (int)_provider)
                {
                    _provider = (LLMProvider)p;
                    EditorPrefs.SetInt(KEY_PROVIDER, p);
                    LoadProviderState();
                }
            }
        }

        void DrawApiKey()
        {
            if (!LLMClient.NeedsKey(_provider))
            {
                using (new EditorGUILayout.HorizontalScope())
                {
                    EditorGUILayout.HelpBox("Ollama runs locally — no key needed. Install it and run: ollama pull " + Models[_modelIndex], MessageType.None);
                    if (GUILayout.Button("Install", GUILayout.Width(70), GUILayout.Height(38)))
                        Application.OpenURL(LLMClient.KeyUrl(_provider));
                }
                return;
            }
            EditorGUILayout.LabelField("Free API key", EditorStyles.boldLabel);
            using (new EditorGUILayout.HorizontalScope())
            {
                string k = EditorGUILayout.PasswordField(_apiKey);
                if (k != _apiKey) { _apiKey = k; EditorPrefs.SetString(KEY_KEYPREFIX + _provider, _apiKey); }
                if (GUILayout.Button("Get free key", GUILayout.Width(96)))
                    Application.OpenURL(LLMClient.KeyUrl(_provider));
            }
            EditorGUILayout.LabelField("Free, no credit card. Stored locally in EditorPrefs.", EditorStyles.miniLabel);
        }

        void DrawModelRow()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Model", GUILayout.Width(60));
                var models = Models;
                _modelIndex = Mathf.Clamp(_modelIndex, 0, models.Length - 1);
                int m = EditorGUILayout.Popup(_modelIndex, models);
                if (m != _modelIndex) { _modelIndex = m; EditorPrefs.SetString(KEY_MODELPREFIX + _provider, models[_modelIndex]); }
            }
        }

        void DrawPrompt()
        {
            EditorGUILayout.LabelField("Describe your game", EditorStyles.boldLabel);
            _promptScroll = EditorGUILayout.BeginScrollView(_promptScroll, GUILayout.Height(90));
            string p = EditorGUILayout.TextArea(_prompt, GUILayout.ExpandHeight(true));
            EditorGUILayout.EndScrollView();
            if (p != _prompt) { _prompt = p; EditorPrefs.SetString(KEY_PROMPT, _prompt); }

            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Examples:", GUILayout.Width(64));
                if (GUILayout.Button("Insert an idea", EditorStyles.miniButton))
                {
                    var menu = new GenericMenu();
                    foreach (var ex in Examples)
                    {
                        string captured = ex;
                        string label = captured.Length > 60 ? captured.Substring(0, 60) + "…" : captured;
                        menu.AddItem(new GUIContent(label), false, () => { _prompt = captured; EditorPrefs.SetString(KEY_PROMPT, _prompt); Repaint(); });
                    }
                    menu.ShowAsContext();
                }
            }
        }

        void DrawOptions()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Output", GUILayout.Width(72));
                int mode = EditorGUILayout.Popup((int)_mode, ModeLabels);
                if (mode != (int)_mode) { _mode = (GenMode)mode; EditorPrefs.SetInt(KEY_MODE, mode); }
            }
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Style", GUILayout.Width(72));
                int st = EditorGUILayout.Popup((int)_style, StyleLabels);
                if (st != (int)_style) { _style = (GameStyle)st; EditorPrefs.SetInt(KEY_STYLE, st); }
            }
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Folder", GUILayout.Width(72));
                string f = EditorGUILayout.TextField(_outputFolder);
                if (f != _outputFolder) { _outputFolder = f; EditorPrefs.SetString(KEY_FOLDER, _outputFolder); }
            }
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Max tokens", GUILayout.Width(72));
                int mt = EditorGUILayout.IntSlider(_maxTokens, 8000, 64000);
                if (mt != _maxTokens) { _maxTokens = mt; EditorPrefs.SetInt(KEY_MAXTOK, _maxTokens); }
            }
            if (_mode == GenMode.Pro)
                EditorGUILayout.LabelField("Pro writes a .unity scene, prefabs and generated art. Best with a capable model.",
                    EditorStyles.miniLabel);
        }

        void DrawGenerateButton()
        {
            bool building = _run != null && _run.phase == "building";
            using (new EditorGUI.DisabledScope(_busy || building))
            {
                string label = _busy ? $"Generating…  ({_elapsed:0}s)"
                             : building ? "Compiling & building…"
                             : "✦  Generate Game";
                if (GUILayout.Button(label, new GUIStyle(GUI.skin.button) { fontStyle = FontStyle.Bold, fixedHeight = 32 }))
                    StartGenerate();
            }
            if (_busy) EditorGUILayout.LabelField("Talking to the model — this can take up to a couple of minutes.", EditorStyles.miniLabel);
        }

        void DrawStatus()
        {
            if (!string.IsNullOrEmpty(_status)) EditorGUILayout.HelpBox(_status, _statusType);
        }

        void DrawRun()
        {
            if (_run == null) return;
            EditorGUILayout.Space(6);

            if (_run.phase == "building")
            {
                EditorGUILayout.HelpBox($"Compiling generated scripts and building “{_run.gameName}” — Unity is recompiling. This panel updates when it's done.", MessageType.Info);
                return;
            }
            if (_run.phase == "error")
            {
                EditorGUILayout.LabelField(_run.gameName, EditorStyles.boldLabel);
                EditorGUILayout.HelpBox(_run.error, MessageType.Error);
                DrawScriptList();
                return;
            }

            EditorGUILayout.LabelField(_run.gameName, EditorStyles.boldLabel);
            if (!string.IsNullOrEmpty(_run.summary)) EditorGUILayout.LabelField(_run.summary, EditorStyles.wordWrappedLabel);

            if (_run.phase == "built")
            {
                EditorGUILayout.Space(3);
                EditorGUILayout.LabelField("Created: " + _run.assetSummary, EditorStyles.miniLabel);
                using (new EditorGUILayout.HorizontalScope())
                {
                    if (!string.IsNullOrEmpty(_run.scenePath) && GUILayout.Button("Open scene", GUILayout.Width(110)))
                    {
                        if (UnityEditor.SceneManagement.EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                            UnityEditor.SceneManagement.EditorSceneManager.OpenScene(_run.scenePath);
                    }
                    if (!string.IsNullOrEmpty(_run.scenePath) && GUILayout.Button("Ping scene", GUILayout.Width(90)))
                    {
                        var o = AssetDatabase.LoadAssetAtPath<Object>(_run.scenePath);
                        if (o != null) EditorGUIUtility.PingObject(o);
                    }
                }
            }

            if (!string.IsNullOrEmpty(_run.setupNotes))
            {
                EditorGUILayout.Space(3);
                EditorGUILayout.LabelField("How to play", EditorStyles.boldLabel);
                EditorGUILayout.HelpBox(_run.setupNotes, MessageType.Info);
            }

            DrawScriptList();

            string tip = _run.phase == "built" ? "Open the scene above and press Play." : "Press Play in an empty scene — the code bootstraps itself.";
            EditorGUILayout.Space(4);
            EditorGUILayout.HelpBox(tip, MessageType.None);
        }

        void DrawScriptList()
        {
            if (_run.scriptPaths == null || _run.scriptPaths.Length == 0) return;
            EditorGUILayout.Space(4);
            EditorGUILayout.LabelField($"Scripts ({_run.scriptPaths.Length})", EditorStyles.boldLabel);
            foreach (var p in _run.scriptPaths)
            {
                using (new EditorGUILayout.HorizontalScope())
                {
                    EditorGUILayout.LabelField("•  " + p, EditorStyles.miniLabel);
                    if (GUILayout.Button("Ping", EditorStyles.miniButton, GUILayout.Width(44)))
                    {
                        var o = AssetDatabase.LoadAssetAtPath<Object>(p);
                        if (o != null) EditorGUIUtility.PingObject(o);
                    }
                }
            }
        }

        // ---- Actions -----------------------------------------------------------

        void StartGenerate()
        {
            if (LLMClient.NeedsKey(_provider) && string.IsNullOrWhiteSpace(_apiKey))
            { SetStatus("Paste your free API key first.", MessageType.Warning); return; }
            if (string.IsNullOrWhiteSpace(_prompt))
            { SetStatus("Describe the game you want to generate.", MessageType.Warning); return; }

            _busy = true; _elapsed = 0f; _run = null; RunStore.Clear();
            SetStatus("", MessageType.None);

            string model = Models[Mathf.Clamp(_modelIndex, 0, Models.Length - 1)];
            string key = LLMClient.NeedsKey(_provider) ? _apiKey : "";

            GameGenerator.Generate(
                _provider, key, model, _prompt, _outputFolder, _mode, _style, _maxTokens,
                onWritten: record =>
                {
                    _busy = false; _run = record;
                    if (record.phase == "building")
                    { SetStatus("Files written. Compiling & building the scene…", MessageType.Info); StartPolling(); }
                    else
                    { SetStatus($"Done. Wrote {record.scriptPaths.Length} script(s) to {_outputFolder}.", MessageType.Info); }
                    Repaint();
                },
                onError: err => { _busy = false; SetStatus(err, MessageType.Error); Repaint(); },
                onProgress: s => { _elapsed = s; Repaint(); });
        }

        // ---- Build polling (survives the domain reload) ------------------------

        void StartPolling() { if (_polling) return; _polling = true; EditorApplication.update += PollBuild; }
        void StopPolling() { if (!_polling) return; _polling = false; EditorApplication.update -= PollBuild; }
        void PollBuild()
        {
            var latest = RunStore.Load();
            if (latest == null) return;
            if (latest.phase != "building")
            {
                _run = latest;
                if (latest.phase == "built") SetStatus($"Built “{latest.gameName}” — {latest.assetSummary}.", MessageType.Info);
                else if (latest.phase == "error") SetStatus(latest.error, MessageType.Error);
                StopPolling(); Repaint();
            }
        }

        void SetStatus(string msg, MessageType type) { _status = msg; _statusType = type; }
    }
}
