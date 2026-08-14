// =============================================================================
//  LLM client (free providers) with automatic model fallback + JSON repair.
//  Uses global fetch (Node 18+ / Electron). No external packages.
// =============================================================================
const { PROVIDERS } = require("./providers");

async function httpJson(url, options, timeoutMs = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try { res = await fetch(url, { ...options, signal: controller.signal }); }
  catch (e) { clearTimeout(timer); throw new Error(e.name === "AbortError" ? "Request timed out." : "Network error: " + e.message); }
  clearTimeout(timer);
  return { ok: res.ok, status: res.status, raw: await res.text() };
}

function apiError(raw, status, provider) {
  try { const j = JSON.parse(raw); const m = (j.error && (j.error.message || j.error)) || j.message; if (m) return `${provider} error (${status}): ${typeof m === "string" ? m : JSON.stringify(m)}`; } catch {}
  return `${provider} request failed (${status}).`;
}

// A model-availability error we can recover from by trying another model.
function isModelUnavailable(msg, status) {
  if (status === 404) return true;
  const m = String(msg || "").toLowerCase();
  return /not found|does not exist|no longer|decommission|deprecat|unsupported|not supported|invalid model|unknown model|model_not_found|is not allowed|does not have access/.test(m);
}

// ---- Single-model calls ----------------------------------------------------
async function callGemini(apiKey, model, system, prompt, jsonMode, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
  };
  if (jsonMode) body.generationConfig.responseMimeType = "application/json";
  const { ok, status, raw } = await httpJson(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!ok) { const e = new Error(apiError(raw, status, "Gemini")); e.status = status; throw e; }
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Gemini response."); }
  if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error("Gemini blocked the prompt (" + j.promptFeedback.blockReason + "). Rephrase it.");
  const cand = (j.candidates || [])[0];
  const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
  const text = parts.map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini returned no text (finishReason: " + (cand && cand.finishReason) + ").");
  return text;
}
async function callGroq(apiKey, model, system, prompt, jsonMode, maxTokens) {
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.8 };
  if (jsonMode) body.response_format = { type: "json_object" };
  const { ok, status, raw } = await httpJson("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + apiKey }, body: JSON.stringify(body),
  });
  if (!ok) { const e = new Error(apiError(raw, status, "Groq")); e.status = status; throw e; }
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Groq response."); }
  const text = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
  if (!text) throw new Error("Groq returned no text.");
  return text;
}
async function callOllama(model, system, prompt, jsonMode, maxTokens) {
  const base = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], stream: false, options: { num_predict: maxTokens } };
  if (jsonMode) body.format = "json";
  let r;
  try { r = await httpJson(base + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Couldn't reach Ollama at " + base + ". Is Ollama running? (install from ollama.com)"); }
  if (!r.ok) { const e = new Error(apiError(r.raw, r.status, "Ollama")); e.status = r.status; throw e; }
  let j; try { j = JSON.parse(r.raw); } catch { throw new Error("Could not parse Ollama response."); }
  const text = j.message && j.message.content ? j.message.content : "";
  if (!text) throw new Error("Ollama returned no text. Try: ollama pull " + model);
  return text;
}

function callOne(provider, apiKey, model, system, prompt, jsonMode, maxTokens) {
  if (provider === "gemini") return callGemini(apiKey, model, system, prompt, jsonMode, maxTokens);
  if (provider === "groq") return callGroq(apiKey, model, system, prompt, jsonMode, maxTokens);
  if (provider === "ollama") return callOllama(model, system, prompt, jsonMode, maxTokens);
  return Promise.reject(new Error("Unknown provider: " + provider));
}

// ---- Public: call with automatic model fallback ----------------------------
// Returns { text, model } where `model` is whichever model actually worked.
async function callLLM(provider, apiKey, model, system, prompt, jsonMode, maxTokens) {
  const listed = (PROVIDERS[provider] && PROVIDERS[provider].models) || [];
  const primary = model || (PROVIDERS[provider] && PROVIDERS[provider].defaultModel);
  const candidates = [primary, ...listed.filter(m => m && m !== primary)];
  const tried = [];
  let lastErr;
  for (const m of candidates) {
    try {
      const text = await callOne(provider, apiKey, m, system, prompt, jsonMode, maxTokens);
      return { text, model: m };
    } catch (e) {
      lastErr = e;
      tried.push(m);
      // Only fall back when the model itself is unavailable — otherwise surface it.
      if (!isModelUnavailable(e.message, e.status)) throw e;
    }
  }
  const extra = tried.length > 1 ? ` (tried: ${tried.join(", ")})` : "";
  throw new Error((lastErr ? lastErr.message : "No model available") + extra);
}

// ---- JSON extraction + light repair ----------------------------------------
function stripFences(s) {
  s = String(s).trim();
  if (s.startsWith("```")) { const nl = s.indexOf("\n"); if (nl >= 0) s = s.slice(nl + 1); if (s.endsWith("```")) s = s.slice(0, -3); s = s.trim(); }
  return s;
}
function parseResult(text) {
  let s = stripFences(text);
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  try { return JSON.parse(s); }
  catch (e) {
    // light repair: drop trailing commas before } or ]
    const repaired = s.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired);
  }
}

module.exports = {
  httpJson, apiError, isModelUnavailable,
  callGemini, callGroq, callOllama, callOne, callLLM,
  stripFences, parseResult,
};
