// =============================================================================
//  UnityGUI Desktop — unit tests (no Electron, no network). Run: npm test
// =============================================================================
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { PROVIDERS, ENGINES } = require("../lib/providers");
const prompts = require("../lib/prompts");
const writers = require("../lib/writers");
const llm = require("../lib/llm");

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ---- providers / engines ---------------------------------------------------
test("providers: gemini uses current (non-1.5) models", () => {
  assert.ok(PROVIDERS.gemini, "gemini provider exists");
  assert.strictEqual(PROVIDERS.gemini.defaultModel, "gemini-2.5-flash");
  for (const m of PROVIDERS.gemini.models) assert.ok(!/1\.5/.test(m), "no retired 1.5 model: " + m);
});
test("engines: unity + roblox present", () => {
  assert.deepStrictEqual(Object.keys(ENGINES).sort(), ["roblox", "unity"]);
});

// ---- genres ----------------------------------------------------------------
test("genres: both engines have non-empty starter prompts", () => {
  for (const eng of ["unity", "roblox"]) {
    const list = prompts.genresFor(eng);
    assert.ok(Array.isArray(list) && list.length >= 4, eng + " has genres");
    for (const g of list) {
      assert.ok(g.id && g.label && g.prompt, "genre has id/label/prompt");
      assert.ok(g.prompt.length > 20, "genre prompt is substantial");
    }
  }
});

// ---- prompts ---------------------------------------------------------------
test("prompt: unity system prompt asks for self-bootstrapping C#", () => {
  const p = prompts.buildSystemPrompt("unity", "auto");
  assert.ok(/RuntimeInitializeOnLoadMethod/.test(p));
  assert.ok(/UnityGUI\.Generated/.test(p));
  assert.ok(/\.cs/.test(p));
});
test("prompt: roblox system prompt asks for Luau + services", () => {
  const p = prompts.buildSystemPrompt("roblox", "2d");
  assert.ok(/Luau/.test(p));
  assert.ok(/GetService/.test(p));
  assert.ok(/Make a 2D game/.test(p));
});
test("prompt: refine embeds instruction + previous file contents", () => {
  const prev = { files: [{ name: "Main", content: "print('hi')" }] };
  const r = prompts.buildRefinePrompt(prev, "make it faster");
  assert.ok(/make it faster/.test(r));
  assert.ok(/print\('hi'\)/.test(r));
});
test("prompt: enhance prompt carries the idea + engine", () => {
  const r = prompts.buildEnhancePrompt("roblox", "a lava obby");
  assert.ok(/lava obby/.test(r));
  assert.ok(/Roblox/.test(r));
});

// ---- JSON parse / repair ---------------------------------------------------
test("parseResult: strips ``` fences", () => {
  const d = llm.parseResult('```json\n{"a":1}\n```');
  assert.strictEqual(d.a, 1);
});
test("parseResult: extracts JSON from surrounding prose", () => {
  const d = llm.parseResult('Sure! Here you go: {"game_name":"X","files":[]} — enjoy');
  assert.strictEqual(d.game_name, "X");
});
test("parseResult: repairs trailing commas", () => {
  const d = llm.parseResult('{"files":[1,2,],"ok":true,}');
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.files.length, 2);
});

// ---- model availability detection ------------------------------------------
test("isModelUnavailable: recognises retired-model errors and 404", () => {
  assert.ok(llm.isModelUnavailable("models/gemini-1.5-flash is not found", 404));
  assert.ok(llm.isModelUnavailable("model has been decommissioned", 400));
  assert.ok(llm.isModelUnavailable("anything", 404));
  assert.ok(!llm.isModelUnavailable("API key not valid", 401));
  assert.ok(!llm.isModelUnavailable("rate limit exceeded", 429));
});

// ---- Unity writer ----------------------------------------------------------
test("writeUnityProject: writes scripts + project files, blocks traversal", () => {
  const dir = mkTmp();
  const data = {
    game_name: "My Cool Game!",
    summary: "s", setup_notes: "play",
    files: [
      { path: "Assets/UnityGUI/Generated/Boot.cs", content: "// boot" },
      { path: "../../../../etc/evil.cs", content: "// evil" }, // traversal attempt
    ],
  };
  const out = writers.writeUnityProject(dir, data);
  const genDir = path.join(out.root, "Assets", "UnityGUI", "Generated");
  assert.ok(fs.existsSync(path.join(genDir, "Boot.cs")), "Boot.cs written");
  assert.ok(fs.existsSync(path.join(genDir, "evil.cs")), "traversal neutralised into Generated");
  // nothing escaped above the project root
  assert.ok(out.root.includes("Unity-MyCoolGame"), "sanitized project name");
  assert.ok(fs.existsSync(path.join(out.root, "ProjectSettings", "ProjectVersion.txt")));
  const manifest = JSON.parse(fs.readFileSync(path.join(out.root, "Packages", "manifest.json"), "utf8"));
  assert.ok(manifest.dependencies["com.unity.ugui"], "ugui dependency present");
});

// ---- Roblox writer + .rbxlx ------------------------------------------------
test("writeRobloxPlace: writes .rbxlx + raw .luau files", () => {
  const dir = mkTmp();
  const data = {
    game_name: "Lava Obby",
    files: [
      { name: "World", kind: "server", content: "print('server')" },
      { name: "Input", kind: "local", content: "print('local')" },
      { name: "Util", kind: "module", content: "return {}" },
    ],
  };
  const out = writers.writeRobloxPlace(dir, data);
  assert.ok(out.openTarget.endsWith(".rbxlx"), "opens the place file");
  assert.ok(fs.existsSync(out.openTarget), ".rbxlx exists");
  assert.ok(fs.existsSync(path.join(out.root, "Scripts", "World.server.luau")));
  assert.ok(fs.existsSync(path.join(out.root, "Scripts", "Input.client.luau")));
  assert.ok(fs.existsSync(path.join(out.root, "Scripts", "Util.module.luau")));
});

test("buildRbxlx: well-formed XML with baseplate + spawn", () => {
  const xml = writers.buildRbxlx("Game", [{ name: "S", content: "print(1)" }], [], []);
  assert.ok(xml.startsWith("<roblox"), "roblox root");
  assert.ok(/class="SpawnLocation"/.test(xml), "has spawn");
  assert.ok(/class="Baseplate"|Name">Baseplate/.test(xml), "has baseplate");
  assert.ok(xmlWellFormed(xml), "tags balanced (XML well-formed)");
});

test("buildRbxlx: escapes the ]]> CDATA edge case and stays well-formed", () => {
  const nasty = "local s = ']]>' -- tricky\nprint(s)";
  const xml = writers.buildRbxlx("Edge", [{ name: "S", content: nasty }], [], []);
  assert.ok(xml.includes("]]]]><![CDATA[>"), "]]> was escaped");
  assert.ok(xmlWellFormed(xml), "still well-formed with ]]> inside source");
});

test("xmlEsc: escapes &, <, > in names", () => {
  assert.strictEqual(writers.xmlEsc('a & b < c > d'), "a &amp; b &lt; c &gt; d");
});

// ---- callLLM model fallback (mock fetch) -----------------------------------
test("callLLM: falls back to next Gemini model when the first is retired", async () => {
  const calls = [];
  global.fetch = async (url) => {
    const model = decodeURIComponent(String(url).match(/models\/([^:]+):/)[1]);
    calls.push(model);
    if (model === "gemini-2.5-flash") {
      return mockRes(false, 404, JSON.stringify({ error: { message: "models/" + model + " is not found", status: "NOT_FOUND" } }));
    }
    return mockRes(true, 200, JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }));
  };
  const r = await llm.callLLM("gemini", "key", "gemini-2.5-flash", "sys", "hi", false, 20);
  assert.strictEqual(r.text, "OK");
  assert.notStrictEqual(r.model, "gemini-2.5-flash", "used a fallback model");
  assert.ok(calls.length >= 2, "tried more than one model");
});

test("callLLM: does NOT fall back on an auth error (fails fast)", async () => {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    return mockRes(false, 401, JSON.stringify({ error: { message: "API key not valid" } }));
  };
  await assert.rejects(
    () => llm.callLLM("gemini", "badkey", "gemini-2.5-flash", "sys", "hi", false, 20),
    /API key not valid/,
  );
  assert.strictEqual(calls.length, 1, "auth error tried exactly one model");
});

// ---- helpers ---------------------------------------------------------------
function mkTmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "unitygui-test-")); }
function mockRes(ok, status, body) { return { ok, status, text: async () => body }; }
function xmlWellFormed(xml) {
  const noCdata = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const stack = [];
  const re = /<(\/?)([A-Za-z][\w:.-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(noCdata))) {
    const closing = m[1] === "/", name = m[2], selfClose = m[4] === "/";
    if (closing) { if (stack.pop() !== name) return false; }
    else if (!selfClose) { stack.push(name); }
  }
  return stack.length === 0;
}

// ---- runner ----------------------------------------------------------------
(async () => {
  for (const [name, fn] of tests) {
    try { await fn(); passed++; console.log("  ✓ " + name); }
    catch (e) { console.error("  ✗ " + name + "\n      " + (e && e.message)); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${tests.length} passed`);
  if (passed !== tests.length) process.exitCode = 1;
})();
