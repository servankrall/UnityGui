// =============================================================================
//  UnityGUI — LLM client (Unity Editor)
//  Talks to FREE AI providers from inside the Editor via UnityWebRequest:
//    • Gemini  — Google AI Studio free key (generativelanguage.googleapis.com)
//    • Groq    — free key, OpenAI-compatible (api.groq.com)
//    • Ollama  — local, no key (localhost:11434)
//  No paid Claude key required, no third-party packages.
// =============================================================================
using System;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.Networking;

namespace UnityGUI.EditorTools
{
    public enum LLMProvider { Gemini, Groq, Ollama }

    public static class LLMClient
    {
        public static string[] ModelsFor(LLMProvider p)
        {
            switch (p)
            {
                case LLMProvider.Gemini: return new[] { "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-flash-latest" };
                case LLMProvider.Groq:   return new[] { "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b" };
                default:                 return new[] { "qwen2.5-coder:7b", "llama3.1:8b", "codellama:13b" };
            }
        }
        public static bool NeedsKey(LLMProvider p) => p != LLMProvider.Ollama;
        public static string KeyUrl(LLMProvider p) =>
            p == LLMProvider.Gemini ? "https://aistudio.google.com/app/apikey"
          : p == LLMProvider.Groq ? "https://console.groq.com/keys"
          : "https://ollama.com/download";

        /// <summary>Send one chat/generation request. Calls back on the main thread.</summary>
        public static void Send(
            LLMProvider provider, string apiKey, string model, string system, string userPrompt,
            bool jsonMode, int maxTokens,
            Action<string> onSuccess, Action<string> onError, Action<float> onProgress = null)
        {
            if (NeedsKey(provider) && string.IsNullOrEmpty(apiKey))
            {
                onError?.Invoke("No API key set. Paste your free key in the UnityGUI window.");
                return;
            }

            string url, body;
            var headers = new System.Collections.Generic.List<(string, string)> { ("content-type", "application/json") };

            switch (provider)
            {
                case LLMProvider.Gemini:
                    url = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(apiKey)}";
                    body = GeminiBody(system, userPrompt, jsonMode, maxTokens);
                    break;
                case LLMProvider.Groq:
                    url = "https://api.groq.com/openai/v1/chat/completions";
                    headers.Add(("authorization", "Bearer " + apiKey));
                    body = OpenAiBody(model, system, userPrompt, jsonMode, maxTokens);
                    break;
                default: // Ollama
                    url = (Environment.GetEnvironmentVariable("OLLAMA_HOST") ?? "http://localhost:11434").TrimEnd('/') + "/api/chat";
                    body = OllamaBody(model, system, userPrompt, jsonMode, maxTokens);
                    break;
            }

            var request = new UnityWebRequest(url, UnityWebRequest.kHttpVerbPOST)
            {
                uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body)),
                downloadHandler = new DownloadHandlerBuffer(),
                timeout = 600,
            };
            foreach (var h in headers) request.SetRequestHeader(h.Item1, h.Item2);

            var op = request.SendWebRequest();
            double t0 = EditorApplication.timeSinceStartup;

            void Poll()
            {
                onProgress?.Invoke((float)(EditorApplication.timeSinceStartup - t0));
                if (!op.isDone) return;
                EditorApplication.update -= Poll;
                try
                {
#if UNITY_2020_1_OR_NEWER
                    bool failed = request.result != UnityWebRequest.Result.Success;
#else
                    bool failed = request.isNetworkError || request.isHttpError;
#endif
                    string raw = request.downloadHandler != null ? request.downloadHandler.text : null;
                    if (failed)
                    {
                        string apiMsg = ExtractError(raw);
                        onError?.Invoke(!string.IsNullOrEmpty(apiMsg)
                            ? apiMsg
                            : $"{provider} request failed ({request.responseCode}): {request.error}");
                        return;
                    }
                    string text = ExtractText(provider, raw, out string err);
                    if (!string.IsNullOrEmpty(err)) { onError?.Invoke(err); return; }
                    if (string.IsNullOrEmpty(text)) { onError?.Invoke("The model returned no text. Try again or raise Max Tokens."); return; }
                    onSuccess?.Invoke(text);
                }
                finally { request.Dispose(); }
            }
            EditorApplication.update += Poll;
        }

        // ---- Request bodies ----------------------------------------------------
        static string GeminiBody(string system, string prompt, bool json, int maxTokens)
        {
            var sb = new StringBuilder();
            sb.Append("{\"systemInstruction\":{\"parts\":[{\"text\":").Append(J(system)).Append("}]},");
            sb.Append("\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":").Append(J(prompt)).Append("}]}],");
            sb.Append("\"generationConfig\":{\"maxOutputTokens\":").Append(maxTokens).Append(",\"temperature\":0.8");
            if (json) sb.Append(",\"responseMimeType\":\"application/json\"");
            sb.Append("}}");
            return sb.ToString();
        }
        static string OpenAiBody(string model, string system, string prompt, bool json, int maxTokens)
        {
            var sb = new StringBuilder();
            sb.Append("{\"model\":").Append(J(model)).Append(",\"messages\":[");
            sb.Append("{\"role\":\"system\",\"content\":").Append(J(system)).Append("},");
            sb.Append("{\"role\":\"user\",\"content\":").Append(J(prompt)).Append("}],");
            sb.Append("\"max_tokens\":").Append(maxTokens).Append(",\"temperature\":0.8");
            if (json) sb.Append(",\"response_format\":{\"type\":\"json_object\"}");
            sb.Append("}");
            return sb.ToString();
        }
        static string OllamaBody(string model, string system, string prompt, bool json, int maxTokens)
        {
            var sb = new StringBuilder();
            sb.Append("{\"model\":").Append(J(model)).Append(",\"messages\":[");
            sb.Append("{\"role\":\"system\",\"content\":").Append(J(system)).Append("},");
            sb.Append("{\"role\":\"user\",\"content\":").Append(J(prompt)).Append("}],");
            sb.Append("\"stream\":false,\"options\":{\"num_predict\":").Append(maxTokens).Append("}");
            if (json) sb.Append(",\"format\":\"json\"");
            sb.Append("}");
            return sb.ToString();
        }

        // ---- Response parsing --------------------------------------------------
        [Serializable] class GemResp { public GemCand[] candidates; public GemFeedback promptFeedback; }
        [Serializable] class GemCand { public GemContent content; public string finishReason; }
        [Serializable] class GemContent { public GemPart[] parts; }
        [Serializable] class GemPart { public string text; }
        [Serializable] class GemFeedback { public string blockReason; }
        [Serializable] class OaiResp { public OaiChoice[] choices; }
        [Serializable] class OaiChoice { public OaiMsg message; }
        [Serializable] class OaiMsg { public string content; }
        [Serializable] class OllResp { public OllMsg message; }
        [Serializable] class OllMsg { public string content; }
        [Serializable] class ErrEnvelope { public ErrBody error; }
        [Serializable] class ErrBody { public string message; public string status; }

        static string ExtractText(LLMProvider provider, string raw, out string error)
        {
            error = null;
            if (string.IsNullOrEmpty(raw)) { error = "Empty response."; return null; }
            try
            {
                if (provider == LLMProvider.Gemini)
                {
                    var r = JsonUtility.FromJson<GemResp>(raw);
                    if (r != null && r.promptFeedback != null && !string.IsNullOrEmpty(r.promptFeedback.blockReason))
                    { error = "Gemini blocked the prompt (" + r.promptFeedback.blockReason + "). Rephrase it."; return null; }
                    if (r == null || r.candidates == null || r.candidates.Length == 0) return null;
                    var parts = r.candidates[0].content != null ? r.candidates[0].content.parts : null;
                    if (parts == null) return null;
                    var sb = new StringBuilder();
                    foreach (var p in parts) if (p != null && p.text != null) sb.Append(p.text);
                    return sb.ToString();
                }
                if (provider == LLMProvider.Groq)
                {
                    var r = JsonUtility.FromJson<OaiResp>(raw);
                    return r != null && r.choices != null && r.choices.Length > 0 && r.choices[0].message != null
                        ? r.choices[0].message.content : null;
                }
                var o = JsonUtility.FromJson<OllResp>(raw);
                return o != null && o.message != null ? o.message.content : null;
            }
            catch (Exception e) { error = "Could not parse the response: " + e.Message; return null; }
        }

        static string ExtractError(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return null;
            try
            {
                var e = JsonUtility.FromJson<ErrEnvelope>(raw);
                if (e != null && e.error != null && !string.IsNullOrEmpty(e.error.message)) return e.error.message;
            }
            catch { }
            // Ollama returns {"error":"..."} (string); grab it loosely.
            int i = raw.IndexOf("\"error\"", StringComparison.Ordinal);
            if (i >= 0)
            {
                int c = raw.IndexOf(':', i); int q1 = raw.IndexOf('"', c + 1);
                if (q1 >= 0) { int q2 = raw.IndexOf('"', q1 + 1); if (q2 > q1) return raw.Substring(q1 + 1, q2 - q1 - 1); }
            }
            return null;
        }

        // ---- JSON string encoding ---------------------------------------------
        public static string J(string s)
        {
            if (s == null) return "\"\"";
            var sb = new StringBuilder(s.Length + 16).Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }
    }
}
