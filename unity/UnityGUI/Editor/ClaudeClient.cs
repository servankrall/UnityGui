// =============================================================================
//  UnityGUI — Claude API client (Unity Editor)
//  Talks directly to the Anthropic Messages API from inside the Unity Editor
//  using UnityWebRequest. No third-party packages required.
//
//  API reference:  POST https://api.anthropic.com/v1/messages
//  Headers:        x-api-key, anthropic-version: 2023-06-01, content-type
// =============================================================================
using System;
using System.Text;
using UnityEditor;
using UnityEngine;
using UnityEngine.Networking;

namespace UnityGUI.EditorTools
{
    /// <summary>
    /// Minimal, dependency-free client for the Anthropic Messages API.
    /// Runs the request asynchronously and polls it from EditorApplication.update
    /// so the Editor UI stays responsive.
    /// </summary>
    public static class ClaudeClient
    {
        public const string Endpoint = "https://api.anthropic.com/v1/messages";
        public const string ApiVersion = "2023-06-01";

        /// <summary>
        /// Send a single Messages API request.
        /// </summary>
        /// <param name="apiKey">Anthropic API key (sk-ant-...).</param>
        /// <param name="model">Model id, e.g. claude-opus-5.</param>
        /// <param name="system">System prompt.</param>
        /// <param name="userPrompt">The user message content.</param>
        /// <param name="jsonSchema">Raw JSON Schema string for structured output (or null to disable).</param>
        /// <param name="maxTokens">Output token cap.</param>
        /// <param name="onSuccess">Called with the assistant's text content on success.</param>
        /// <param name="onError">Called with a human-readable error message on failure.</param>
        /// <param name="onProgress">Optional: called periodically with elapsed seconds.</param>
        public static void SendMessage(
            string apiKey,
            string model,
            string system,
            string userPrompt,
            string jsonSchema,
            int maxTokens,
            Action<string> onSuccess,
            Action<string> onError,
            Action<float> onProgress = null)
        {
            if (string.IsNullOrEmpty(apiKey))
            {
                onError?.Invoke("No API key set. Paste your Anthropic API key in the UnityGUI window.");
                return;
            }

            string body = BuildRequestBody(model, system, userPrompt, jsonSchema, maxTokens);

            var request = new UnityWebRequest(Endpoint, UnityWebRequest.kHttpVerbPOST);
            byte[] payload = Encoding.UTF8.GetBytes(body);
            request.uploadHandler = new UploadHandlerRaw(payload);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("content-type", "application/json");
            request.SetRequestHeader("x-api-key", apiKey);
            request.SetRequestHeader("anthropic-version", ApiVersion);
            request.timeout = 600; // generous; game generation can take a while

            var op = request.SendWebRequest();
            double startTime = EditorApplication.timeSinceStartup;

            void Poll()
            {
                onProgress?.Invoke((float)(EditorApplication.timeSinceStartup - startTime));
                if (!op.isDone) return;

                EditorApplication.update -= Poll;

                try
                {
#if UNITY_2020_1_OR_NEWER
                    bool failed = request.result != UnityWebRequest.Result.Success;
#else
                    bool failed = request.isNetworkError || request.isHttpError;
#endif
                    string text = request.downloadHandler != null ? request.downloadHandler.text : null;

                    if (failed)
                    {
                        string apiMsg = TryExtractApiError(text);
                        string msg = !string.IsNullOrEmpty(apiMsg)
                            ? apiMsg
                            : $"Request failed ({request.responseCode}): {request.error}";
                        onError?.Invoke(msg);
                        return;
                    }

                    string assistantText = ExtractAssistantText(text, out string stopReason, out string parseErr);
                    if (!string.IsNullOrEmpty(parseErr))
                    {
                        onError?.Invoke(parseErr);
                        return;
                    }
                    if (stopReason == "refusal")
                    {
                        onError?.Invoke("The model declined this request (stop_reason: refusal). Try rephrasing the prompt.");
                        return;
                    }
                    if (string.IsNullOrEmpty(assistantText))
                    {
                        onError?.Invoke("The model returned no text content. Try again or raise Max Tokens.");
                        return;
                    }

                    onSuccess?.Invoke(assistantText);
                }
                finally
                {
                    request.Dispose();
                }
            }

            EditorApplication.update += Poll;
        }

        // ---- Request assembly --------------------------------------------------

        static string BuildRequestBody(string model, string system, string userPrompt, string jsonSchema, int maxTokens)
        {
            var sb = new StringBuilder(4096);
            sb.Append('{');
            sb.Append("\"model\":").Append(JsonString(model)).Append(',');
            sb.Append("\"max_tokens\":").Append(maxTokens).Append(',');
            // We intentionally omit the "thinking" field so each model uses its own
            // default (adaptive on Opus 5 / Sonnet 5). To force it, add e.g.
            //   sb.Append("\"thinking\":{\"type\":\"adaptive\"},");
            sb.Append("\"system\":").Append(JsonString(system)).Append(',');
            if (!string.IsNullOrEmpty(jsonSchema))
            {
                // Structured outputs: constrain the response to our game-files schema.
                sb.Append("\"output_config\":{\"format\":{\"type\":\"json_schema\",\"schema\":")
                  .Append(jsonSchema).Append("}},");
            }
            sb.Append("\"messages\":[{\"role\":\"user\",\"content\":").Append(JsonString(userPrompt)).Append("}]");
            sb.Append('}');
            return sb.ToString();
        }

        // ---- Response parsing --------------------------------------------------

        [Serializable] class AnthResponse { public AnthBlock[] content; public string stop_reason; public string model; }
        [Serializable] class AnthBlock { public string type; public string text; }
        [Serializable] class AnthErrorEnvelope { public string type; public AnthError error; }
        [Serializable] class AnthError { public string type; public string message; }

        static string ExtractAssistantText(string json, out string stopReason, out string parseError)
        {
            stopReason = null;
            parseError = null;
            if (string.IsNullOrEmpty(json))
            {
                parseError = "Empty response from the API.";
                return null;
            }
            try
            {
                var resp = JsonUtility.FromJson<AnthResponse>(json);
                stopReason = resp != null ? resp.stop_reason : null;
                if (resp == null || resp.content == null) return null;
                var chosen = new StringBuilder();
                foreach (var block in resp.content)
                {
                    if (block != null && block.type == "text" && !string.IsNullOrEmpty(block.text))
                        chosen.Append(block.text);
                }
                return chosen.ToString();
            }
            catch (Exception e)
            {
                parseError = "Could not parse the API response: " + e.Message;
                return null;
            }
        }

        static string TryExtractApiError(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            try
            {
                var env = JsonUtility.FromJson<AnthErrorEnvelope>(json);
                if (env != null && env.error != null && !string.IsNullOrEmpty(env.error.message))
                    return $"{env.error.type}: {env.error.message}";
            }
            catch { /* not an error envelope */ }
            return null;
        }

        // ---- JSON string encoding ---------------------------------------------

        /// <summary>Encode a C# string as a JSON string literal (with surrounding quotes).</summary>
        public static string JsonString(string s)
        {
            if (s == null) return "\"\"";
            var sb = new StringBuilder(s.Length + 16);
            sb.Append('"');
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
            sb.Append('"');
            return sb.ToString();
        }
    }
}
