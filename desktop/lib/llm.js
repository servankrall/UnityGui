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
// Per-provider ceilings on output tokens (avoids API errors on huge requests).
const OUTPUT_CAP = { gemini: 60000, groq: 32000, ollama: 32000, pollinations: 16000 };

async function callGemini(apiKey, model, system, prompt, jsonMode, maxTokens, images) {
  maxTokens = Math.min(maxTokens, OUTPUT_CAP.gemini);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const userParts = [{ text: prompt }];
  for (const im of images || []) if (im && im.data) userParts.push({ inline_data: { mime_type: im.mime || "image/png", data: im.data } });
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: userParts }],
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
  return { text, finishReason: cand && cand.finishReason };
}
async function callGroq(apiKey, model, system, prompt, jsonMode, maxTokens) {
  maxTokens = Math.min(maxTokens, OUTPUT_CAP.groq);
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.8 };
  if (jsonMode) body.response_format = { type: "json_object" };
  const { ok, status, raw } = await httpJson("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + apiKey }, body: JSON.stringify(body),
  });
  if (!ok) { const e = new Error(apiError(raw, status, "Groq")); e.status = status; throw e; }
  let j; try { j = JSON.parse(raw); } catch { throw new Error("Could not parse Groq response."); }
  const choice = j.choices && j.choices[0];
  const text = choice && choice.message ? choice.message.content : "";
  if (!text) throw new Error("Groq returned no text.");
  return { text, finishReason: choice && choice.finish_reason };
}
async function callOllama(model, system, prompt, jsonMode, maxTokens) {
  maxTokens = Math.min(maxTokens, OUTPUT_CAP.ollama);
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
  return { text, finishReason: j.done_reason || (j.done === false ? "length" : null) };
}

// Free, hosted, no-key AI (Pollinations) — OpenAI-compatible chat endpoint.
async function callPollinations(model, system, prompt, jsonMode, maxTokens) {
  maxTokens = Math.min(maxTokens, OUTPUT_CAP.pollinations);
  const body = {
    model: model || "openai",
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    max_tokens: maxTokens, temperature: 0.8, referrer: "unitygui", private: true,
  };
  if (jsonMode) body.response_format = { type: "json_object" };
  const { ok, status, raw } = await httpJson("https://text.pollinations.ai/openai", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!ok) { const e = new Error(apiError(raw, status, "Free AI")); e.status = status; throw e; }
  let j;
  try { j = JSON.parse(raw); }
  catch { if (raw && raw.trim()) return { text: raw, finishReason: null }; throw new Error("Could not parse the Free AI response."); }
  const choice = j.choices && j.choices[0];
  const text = choice && choice.message ? choice.message.content : (typeof j === "string" ? j : "");
  if (!text) throw new Error("The Free AI returned no text. Try again, or pick another provider.");
  return { text, finishReason: choice && choice.finish_reason };
}

function callOne(provider, apiKey, model, system, prompt, jsonMode, maxTokens, images) {
  if (provider === "gemini") return callGemini(apiKey, model, system, prompt, jsonMode, maxTokens, images);
  if (provider === "groq") return callGroq(apiKey, model, system, prompt, jsonMode, maxTokens);
  if (provider === "ollama") return callOllama(model, system, prompt, jsonMode, maxTokens);
  if (provider === "pollinations") return callPollinations(model, system, prompt, jsonMode, maxTokens);
  return Promise.reject(new Error("Unknown provider: " + provider));
}

// For Ollama, the model tags that are actually installed vary per machine — so
// never guess. Ask the local server which models exist and try THOSE (preferring
// the requested one, or one with the same base name). This fixes the common
// "model 'x' not found (404)" error from hard-coded tags that aren't pulled.
async function ollamaCandidateModels(preferred, host) {
  const st = await ollamaStatus(host);
  if (!st.running) throw new Error("Ollama isn't running. Install it from ollama.com, start it, then run:  ollama pull qwen2.5-coder");
  const installed = (st.models || []).slice();
  if (!installed.length) throw new Error("No Ollama models are installed yet. Run one of:  ollama pull qwen2.5-coder   ·   ollama pull llama3.2");
  const base = (m) => String(m || "").split(":")[0];
  if (preferred) {
    const pick = installed.find(m => m === preferred) || installed.find(m => base(m) === base(preferred));
    if (pick) return [pick, ...installed.filter(m => m !== pick)];
  }
  return installed;
}

// ---- Public: call with automatic model fallback ----------------------------
// Returns { text, model, finishReason } where `model` is whichever worked.
async function callLLM(provider, apiKey, model, system, prompt, jsonMode, maxTokens, images) {
  let candidates;
  if (provider === "ollama") {
    candidates = await ollamaCandidateModels(model); // only models that are actually installed
  } else {
    const listed = (PROVIDERS[provider] && PROVIDERS[provider].models) || [];
    const primary = model || (PROVIDERS[provider] && PROVIDERS[provider].defaultModel);
    candidates = [primary, ...listed.filter(m => m && m !== primary)];
  }
  const tried = [];
  let lastErr;
  for (const m of candidates) {
    try {
      const r = await callOne(provider, apiKey, m, system, prompt, jsonMode, maxTokens, images);
      return { text: r.text, model: m, finishReason: r.finishReason };
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

// Ollama status — is the local, unlimited, no-key server running, and which
// models are pulled? Used to guide users to a provider that never runs out.
async function ollamaStatus(host) {
  const base = (host || process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");
  try {
    const r = await httpJson(base + "/api/tags", { method: "GET" }, 5000);
    if (!r.ok) return { running: false, base, error: "HTTP " + r.status };
    let j; try { j = JSON.parse(r.raw); } catch { return { running: true, base, models: [] }; }
    const models = (j.models || []).map(m => m && m.name).filter(Boolean);
    return { running: true, base, models };
  } catch (e) { return { running: false, base, error: e.message }; }
}

// A rate-limit / quota-exhausted error — recover by waiting or switching key/provider.
function isRateLimited(msg, status) {
  if (status === 429) return true;
  const m = String(msg || "").toLowerCase();
  return /rate limit|rate-limit|quota|exhaust|resource_exhausted|too many requests|overloaded|capacity|billing|insufficient/.test(m);
}

// keys for a provider — supports a single string or an array (multi-key rotation).
function keyList(cfg, provider) {
  const k = cfg && cfg.keys ? cfg.keys[provider] : null;
  if (Array.isArray(k)) return k.map(s => String(s || "").trim()).filter(Boolean);
  const s = String(k || "").trim();
  return s ? [s] : [];
}

// Build the full ordered list of (provider, key, model) attempts:
// the active provider's keys first, then every other provider that has a key,
// and finally Ollama (local, no key, unlimited) as the last resort.
function buildCandidates(cfg) {
  const active = cfg && cfg.provider && PROVIDERS[cfg.provider] ? cfg.provider : "gemini";
  const order = [active, ...Object.keys(PROVIDERS).filter(p => p !== active)];
  const out = [];
  for (const p of order) {
    const prov = PROVIDERS[p];
    if (!prov.needsKey) {
      // No-key providers (Ollama): prefer the user's chosen model; callLLM then
      // maps it to whatever is actually installed.
      const model = (p === active && cfg.model) ? cfg.model : prov.defaultModel;
      out.push({ provider: p, apiKey: "", model });
      continue;
    }
    keyList(cfg, p).forEach((k, i) => {
      const model = (p === active && i === 0 && cfg.model) ? cfg.model : prov.defaultModel;
      out.push({ provider: p, apiKey: k, model });
    });
  }
  return out;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Try every candidate until one works. Recovers from rate-limit/quota (retry a
// couple of times, then rotate to the next key/provider), retired models, and
// bad keys. Returns { text, provider, model }.
async function generateResilient(cfg, system, prompt, jsonMode, maxTokens, opts = {}) {
  let cands = buildCandidates(cfg);
  if (!cands.length) throw new Error("No provider configured. Add a free API key, or install Ollama.");
  const images = opts.images && opts.images.length ? opts.images : null;
  if (images) {
    // Only Gemini reads images among the free providers — restrict to it.
    cands = cands.filter(c => c.provider === "gemini");
    if (!cands.length) throw new Error("Add a free Google Gemini key to use an image — it's the free provider that can see pictures.");
  }
  const wait = opts.sleep || sleep;
  const maxRetry = opts.retriesPer429 != null ? opts.retriesPer429 : 2;
  const backoff = opts.backoff || ((n) => n * 1500);
  const errs = [];
  for (const c of cands) {
    let attempt = 0;
    for (;;) {
      try {
        const { text, model, finishReason } = await callLLM(c.provider, c.apiKey, c.model, system, prompt, jsonMode, maxTokens, images);
        return { text, provider: c.provider, model, finishReason };
      } catch (e) {
        if (isRateLimited(e.message, e.status) && attempt < maxRetry) { attempt++; await wait(backoff(attempt)); continue; }
        errs.push(`${c.provider}: ${e.message}`);
        break; // move on to the next key / provider
      }
    }
  }
  const providers = [...new Set(cands.map(c => c.provider))].join(", ");
  throw new Error(
    `All options failed (tried: ${providers}). ${errs.slice(0, 4).join(" | ")}` +
    ` — tip: install Ollama (ollama.com) to generate 100% free & unlimited with no key/limits.`,
  );
}

// The model stopped because it hit the output-token limit → the JSON is cut off.
function isTruncated(finishReason) {
  return /max[_ ]?tokens|max_output|length|truncat/i.test(String(finishReason || ""));
}

// ---- JSON extraction + truncation-tolerant repair --------------------------
function stripFences(s) {
  s = String(s).trim();
  if (s.startsWith("```")) { const nl = s.indexOf("\n"); if (nl >= 0) s = s.slice(nl + 1); if (s.endsWith("```")) s = s.slice(0, -3); s = s.trim(); }
  return s;
}
function dropTrailingCommas(s) { return s.replace(/,\s*([}\]])/g, "$1"); }

// Return the first complete, balanced {...} object (respecting strings), or null
// if the object never closes (i.e. the output was truncated).
function extractBalanced(s) {
  let inStr = false, esc = false, depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}") { depth--; if (depth === 0 && start >= 0) return s.slice(start, i + 1); }
  }
  return null;
}

// Close an unterminated string and any open [ / { so a truncated blob parses.
function closeTruncated(s) {
  let inStr = false, esc = false; const stack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = s;
  if (inStr) { if (esc) out = out.slice(0, -1); out += '"'; } // drop a dangling backslash, then close
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}

// Parse a model result into an object. Tolerates code fences, surrounding prose,
// trailing commas, and — crucially — output cut off by the token limit.
function parseResult(text) {
  let s = stripFences(text);
  const a = s.indexOf("{");
  if (a > 0) s = s.slice(a);
  const balanced = extractBalanced(s);        // full object if not truncated
  const candidate = balanced || s;            // else the whole remainder
  try { return JSON.parse(candidate); } catch {}
  try { return JSON.parse(dropTrailingCommas(candidate)); } catch {}
  // last resort: close the truncated tail, then drop any trailing comma it created
  return JSON.parse(dropTrailingCommas(closeTruncated(s)));
}

// A generated file object in the shape each engine's writer expects.
function fileObjFor(engine, key, i, content) {
  content = String(content);
  if (engine === "roblox") {
    const k = String(key || "");
    const kind = /local|client/i.test(k) ? "local" : /module/i.test(k) ? "module" : "server";
    return { name: (k && /[a-z]/i.test(k)) ? k.replace(/\.[^.]+$/, "").replace(/[^\w]+/g, "") : ("Script" + i), kind, content };
  }
  if (engine === "web") {
    const p = (typeof key === "string" && /[.\/]/.test(key)) ? key : (i === 0 ? "index.html" : "file" + i + ".html");
    return { path: p, content };
  }
  const p = (typeof key === "string" && /\.cs$/i.test(key)) ? key : "Assets/UnityGUI/Generated/Generated" + (i || "") + ".cs";
  return { path: p, content };
}
function firstCodeLike(d, engine) {
  const keys = ["html", "index_html", "indexhtml", "code", "content", "source", "game", "script", "index"];
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (typeof v !== "string" || v.length < 24) continue;
    if (keys.includes(k.toLowerCase()) && (engine !== "web" || /<|function|const|let|var|=>|canvas/i.test(v))) return v;
  }
  if (engine === "web") for (const k of Object.keys(d)) { const v = d[k]; if (typeof v === "string" && /<(!doctype|html|canvas|script|div|body|style)/i.test(v)) return v; }
  return null;
}
// Some (weaker) models return the right CONTENT in the WRONG shape — no top-level
// `files` array. Salvage the common variants so the game still gets written
// instead of failing with "no usable files". Returns a well-shaped result or null.
function coerceFiles(d, engine) {
  if (typeof d === "string") return d.trim().length >= 10 ? { game_name: "Game", summary: "", setup_notes: "", files: [fileObjFor(engine, null, 0, d)] } : null;
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  if (Array.isArray(d.files) && d.files.some(f => f && typeof f === "object" && f.content != null)) return d; // already valid
  const meta = { game_name: d.game_name || d.name || d.title || "Game", summary: d.summary || d.description || "", setup_notes: d.setup_notes || d.instructions || d.how_to_play || "" };
  if (Array.isArray(d.files) && d.files.length && typeof d.files[0] === "string") {
    const arr = d.files.map((c, i) => fileObjFor(engine, null, i, c)).filter(f => f.content);
    if (arr.length) return { ...meta, files: arr };
  }
  if (d.files && typeof d.files === "object" && !Array.isArray(d.files)) {
    const arr = Object.entries(d.files).map(([k, v], i) => fileObjFor(engine, k, i, typeof v === "string" ? v : (v && (v.content || v.code || v.source)) || "")).filter(f => f.content);
    if (arr.length) return { ...meta, files: arr };
  }
  const single = firstCodeLike(d, engine);
  if (single) return { ...meta, files: [fileObjFor(engine, null, 0, single)] };
  const codeKeys = Object.keys(d).filter(k => typeof d[k] === "string" && d[k].length > 24 && (/[\/.]/.test(k) || /^(server|local|module|client)/i.test(k)));
  if (codeKeys.length) return { ...meta, files: codeKeys.map((k, i) => fileObjFor(engine, k, i, d[k])) };
  return null;
}

module.exports = {
  httpJson, apiError, isModelUnavailable, isRateLimited, isTruncated,
  callGemini, callGroq, callOllama, callPollinations, callOne, callLLM, ollamaCandidateModels,
  keyList, buildCandidates, generateResilient, ollamaStatus,
  stripFences, parseResult, extractBalanced, closeTruncated, coerceFiles,
};
