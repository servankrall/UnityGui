// =============================================================================
//  UnityGUI — AI Game Generator window
//  Open from:  Window ▸ UnityGUI ▸ AI Game Generator
//  Describe a game, press Generate, and Claude writes ready-to-run C# into your
//  project. Press Play in an empty scene to try it.
// =============================================================================
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace UnityGUI.EditorTools
{
    public class UnityGUIWindow : EditorWindow
    {
        // EditorPrefs keys
        const string KEY_API = "UnityGUI.ApiKey";
        const string KEY_MODEL = "UnityGUI.Model";
        const string KEY_PROMPT = "UnityGUI.Prompt";
        const string KEY_FOLDER = "UnityGUI.OutputFolder";
        const string KEY_MAXTOK = "UnityGUI.MaxTokens";

        static readonly string[] Models =
        {
            "claude-opus-5",      // most capable (default)
            "claude-sonnet-5",    // faster / cheaper, near-Opus quality
            "claude-opus-4-8",    // previous flagship
            "claude-haiku-4-5",   // fastest / cheapest
        };

        static readonly string[] Examples =
        {
            "A 2D endless runner where a cube jumps over incoming obstacles. Space to jump, score for distance.",
            "A top-down twin-stick shooter: WASD to move, mouse to aim and shoot spawning enemies. Health bar and score.",
            "A simple 3D first-person maze: WASD + mouse look, find the glowing exit. Timer on screen.",
            "A brick-breaker (breakout) game: paddle on arrow keys, bounce the ball to clear all bricks, lives counter.",
            "A tiny platformer: a capsule collects coins on floating platforms. Arrow keys to move, space to jump.",
        };

        string _apiKey = "";
        int _modelIndex = 0;
        string _prompt = "";
        string _outputFolder = "Assets/UnityGUI/Generated";
        int _maxTokens = GameGenerator.DefaultMaxTokens;

        bool _busy;
        float _elapsed;
        string _status = "";
        MessageType _statusType = MessageType.None;
        GameGenerator.WriteReport _lastReport;
        Vector2 _scroll;
        Vector2 _promptScroll;

        [MenuItem("Window/UnityGUI/AI Game Generator")]
        public static void Open()
        {
            var w = GetWindow<UnityGUIWindow>("UnityGUI");
            w.minSize = new Vector2(420, 560);
            w.Show();
        }

        void OnEnable()
        {
            _apiKey = EditorPrefs.GetString(KEY_API, "");
            _prompt = EditorPrefs.GetString(KEY_PROMPT, "");
            _outputFolder = EditorPrefs.GetString(KEY_FOLDER, "Assets/UnityGUI/Generated");
            _maxTokens = EditorPrefs.GetInt(KEY_MAXTOK, GameGenerator.DefaultMaxTokens);
            string savedModel = EditorPrefs.GetString(KEY_MODEL, Models[0]);
            _modelIndex = Mathf.Max(0, System.Array.IndexOf(Models, savedModel));
        }

        void OnGUI()
        {
            _scroll = EditorGUILayout.BeginScrollView(_scroll);

            DrawHeader();
            EditorGUILayout.Space(6);
            DrawApiKey();
            EditorGUILayout.Space(4);
            DrawModel();
            EditorGUILayout.Space(8);
            DrawPrompt();
            EditorGUILayout.Space(4);
            DrawOptions();
            EditorGUILayout.Space(8);
            DrawGenerateButton();
            EditorGUILayout.Space(6);
            DrawStatus();
            DrawReport();

            EditorGUILayout.EndScrollView();
        }

        // ---- Sections ----------------------------------------------------------

        void DrawHeader()
        {
            var titleStyle = new GUIStyle(EditorStyles.boldLabel) { fontSize = 15 };
            EditorGUILayout.LabelField("UnityGUI — AI Game Generator", titleStyle);
            EditorGUILayout.LabelField("Describe a game. Claude writes ready-to-run C# into your project.",
                EditorStyles.miniLabel);
        }

        void DrawApiKey()
        {
            EditorGUILayout.LabelField("Anthropic API key", EditorStyles.boldLabel);
            using (new EditorGUILayout.HorizontalScope())
            {
                string newKey = EditorGUILayout.PasswordField(_apiKey);
                if (newKey != _apiKey)
                {
                    _apiKey = newKey;
                    EditorPrefs.SetString(KEY_API, _apiKey);
                }
                if (GUILayout.Button("Get a key", GUILayout.Width(80)))
                    Application.OpenURL("https://console.anthropic.com/settings/keys");
            }
            EditorGUILayout.LabelField("Stored locally in EditorPrefs on this machine. Never committed.",
                EditorStyles.miniLabel);
        }

        void DrawModel()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Model", GUILayout.Width(50));
                int newIndex = EditorGUILayout.Popup(_modelIndex, Models);
                if (newIndex != _modelIndex)
                {
                    _modelIndex = newIndex;
                    EditorPrefs.SetString(KEY_MODEL, Models[_modelIndex]);
                }
            }
        }

        void DrawPrompt()
        {
            EditorGUILayout.LabelField("Describe your game", EditorStyles.boldLabel);
            _promptScroll = EditorGUILayout.BeginScrollView(_promptScroll, GUILayout.Height(90));
            string newPrompt = EditorGUILayout.TextArea(_prompt, GUILayout.ExpandHeight(true));
            EditorGUILayout.EndScrollView();
            if (newPrompt != _prompt)
            {
                _prompt = newPrompt;
                EditorPrefs.SetString(KEY_PROMPT, _prompt);
            }

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
                        menu.AddItem(new GUIContent(label), false, () =>
                        {
                            _prompt = captured;
                            EditorPrefs.SetString(KEY_PROMPT, _prompt);
                            Repaint();
                        });
                    }
                    menu.ShowAsContext();
                }
            }
        }

        void DrawOptions()
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Output folder", GUILayout.Width(90));
                string newFolder = EditorGUILayout.TextField(_outputFolder);
                if (newFolder != _outputFolder)
                {
                    _outputFolder = newFolder;
                    EditorPrefs.SetString(KEY_FOLDER, _outputFolder);
                }
            }
            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField("Max tokens", GUILayout.Width(90));
                int newMax = EditorGUILayout.IntSlider(_maxTokens, 4000, 64000);
                if (newMax != _maxTokens)
                {
                    _maxTokens = newMax;
                    EditorPrefs.SetInt(KEY_MAXTOK, _maxTokens);
                }
            }
        }

        void DrawGenerateButton()
        {
            using (new EditorGUI.DisabledScope(_busy))
            {
                var btnStyle = new GUIStyle(GUI.skin.button) { fontStyle = FontStyle.Bold, fixedHeight = 32 };
                string label = _busy ? $"Generating…  ({_elapsed:0}s)" : "✦  Generate Game";
                if (GUILayout.Button(label, btnStyle))
                    StartGenerate();
            }
            if (_busy)
                EditorGUILayout.LabelField("Talking to Claude — this can take up to a minute or two.",
                    EditorStyles.miniLabel);
        }

        void DrawStatus()
        {
            if (!string.IsNullOrEmpty(_status))
                EditorGUILayout.HelpBox(_status, _statusType);
        }

        void DrawReport()
        {
            if (_lastReport == null) return;
            EditorGUILayout.Space(6);
            EditorGUILayout.LabelField(_lastReport.gameName, EditorStyles.boldLabel);
            if (!string.IsNullOrEmpty(_lastReport.summary))
                EditorGUILayout.LabelField(_lastReport.summary, EditorStyles.wordWrappedLabel);

            if (!string.IsNullOrEmpty(_lastReport.setupNotes))
            {
                EditorGUILayout.Space(4);
                EditorGUILayout.LabelField("How to play", EditorStyles.boldLabel);
                EditorGUILayout.HelpBox(_lastReport.setupNotes, MessageType.Info);
            }

            EditorGUILayout.Space(4);
            EditorGUILayout.LabelField($"Files written ({_lastReport.writtenPaths.Count})", EditorStyles.boldLabel);
            foreach (var p in _lastReport.writtenPaths)
            {
                using (new EditorGUILayout.HorizontalScope())
                {
                    EditorGUILayout.LabelField("•  " + p, EditorStyles.miniLabel);
                    if (GUILayout.Button("Ping", EditorStyles.miniButton, GUILayout.Width(44)))
                    {
                        var obj = AssetDatabase.LoadAssetAtPath<Object>(p);
                        if (obj != null) EditorGUIUtility.PingObject(obj);
                    }
                }
            }

            if (_lastReport.writtenPaths.Count > 0)
            {
                EditorGUILayout.Space(4);
                EditorGUILayout.HelpBox("Press Play in an empty scene to try your game. " +
                    "The generated code bootstraps itself — no manual scene setup needed.", MessageType.None);
            }
        }

        // ---- Actions -----------------------------------------------------------

        void StartGenerate()
        {
            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                SetStatus("Paste your Anthropic API key first.", MessageType.Warning);
                return;
            }
            if (string.IsNullOrWhiteSpace(_prompt))
            {
                SetStatus("Describe the game you want to generate.", MessageType.Warning);
                return;
            }

            _busy = true;
            _elapsed = 0f;
            _lastReport = null;
            SetStatus("", MessageType.None);

            GameGenerator.Generate(
                _apiKey, Models[_modelIndex], _prompt, _outputFolder, _maxTokens,
                onDone: report =>
                {
                    _busy = false;
                    _lastReport = report;
                    int n = report.writtenPaths.Count;
                    SetStatus($"Done. Wrote {n} file{(n == 1 ? "" : "s")} to {_outputFolder}.", MessageType.Info);
                    Repaint();
                },
                onError: err =>
                {
                    _busy = false;
                    SetStatus(err, MessageType.Error);
                    Repaint();
                },
                onProgress: secs =>
                {
                    _elapsed = secs;
                    Repaint();
                });
        }

        void SetStatus(string msg, MessageType type)
        {
            _status = msg;
            _statusType = type;
        }
    }
}
