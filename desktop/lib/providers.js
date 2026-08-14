// =============================================================================
//  Providers + engines (shared by main process and tests)
//  All providers are FREE — no paid Claude key required.
// =============================================================================

const PROVIDERS = {
  gemini: {
    label: "Google Gemini — free",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "Free API key from Google AI Studio — no credit card.",
    needsKey: true,
    // Current models (the old 1.5 ids were retired — those caused the errors).
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"],
    defaultModel: "gemini-2.5-flash",
  },
  groq: {
    label: "Groq — free & fast",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "Free API key from Groq — no credit card.",
    needsKey: true,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"],
    defaultModel: "llama-3.3-70b-versatile",
  },
  ollama: {
    label: "Ollama — local, offline, no key",
    keyUrl: "https://ollama.com/download",
    keyHint: "Runs models on your own PC. Install Ollama, then: ollama pull qwen2.5-coder",
    needsKey: false,
    models: ["qwen2.5-coder:7b", "llama3.1:8b", "codellama:13b", "deepseek-coder-v2:16b"],
    defaultModel: "qwen2.5-coder:7b",
  },
};

const ENGINES = { unity: "Unity (C#)", roblox: "Roblox Studio (Luau)" };

module.exports = { PROVIDERS, ENGINES };
