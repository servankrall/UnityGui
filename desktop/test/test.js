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
const zip = require("../lib/zip");
const unity = require("../lib/unity");
const art = require("../lib/art");

let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ---- providers / engines ---------------------------------------------------
test("providers: gemini uses current (non-1.5) models", () => {
  assert.ok(PROVIDERS.gemini, "gemini provider exists");
  assert.strictEqual(PROVIDERS.gemini.defaultModel, "gemini-2.5-flash");
  for (const m of PROVIDERS.gemini.models) assert.ok(!/1\.5/.test(m), "no retired 1.5 model: " + m);
});
test("engines: unity + roblox + web present", () => {
  assert.deepStrictEqual(Object.keys(ENGINES).sort(), ["roblox", "unity", "web"]);
});

// ---- genres ----------------------------------------------------------------
test("genres: all engines have non-empty starter prompts", () => {
  for (const eng of ["unity", "roblox", "web"]) {
    const list = prompts.genresFor(eng);
    assert.ok(Array.isArray(list) && list.length >= 4, eng + " has genres");
    for (const g of list) {
      assert.ok(g.id && g.label && g.prompt, "genre has id/label/prompt");
      assert.ok(g.prompt.length > 20, "genre prompt is substantial");
    }
  }
});

// ---- modifiers -------------------------------------------------------------
test("modifiers: non-empty spice list with id/label/text", () => {
  assert.ok(Array.isArray(prompts.MODIFIERS) && prompts.MODIFIERS.length >= 6);
  for (const m of prompts.MODIFIERS) {
    assert.ok(m.id && m.label && m.text, "modifier has id/label/text");
    assert.ok(m.text.length > 10, "modifier text is a real instruction");
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
test("prompt: web system prompt asks for one self-contained index.html", () => {
  const p = prompts.buildSystemPrompt("web", "auto");
  assert.ok(/index\.html/.test(p));
  assert.ok(/canvas/i.test(p));
  assert.ok(/Web Audio|AudioContext/.test(p), "asks for procedural sound");
  assert.ok(/no external|no CDN|self-contained/i.test(p));
});
test("prompt: refine embeds instruction + previous file contents", () => {
  const prev = { files: [{ name: "Main", content: "print('hi')" }] };
  const r = prompts.buildRefinePrompt(prev, "make it faster");
  assert.ok(/make it faster/.test(r));
  assert.ok(/print\('hi'\)/.test(r));
});
test("prompt: buildFixPrompt lists the runtime errors to fix", () => {
  const p = prompts.buildFixPrompt(["ReferenceError: foo is not defined", "TypeError: bar"]);
  assert.ok(/runtime errors|console errors/i.test(p));
  assert.ok(p.includes("ReferenceError: foo is not defined"));
  assert.ok(p.includes("TypeError: bar"));
  assert.ok(/full corrected game/i.test(p));
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
test("parseResult: recovers a truncated response (Unterminated string)", () => {
  // Simulates output cut off by the token limit mid-way through a code string.
  const truncated = '{"game_name":"Big","summary":"s","files":[{"path":"A.cs","content":"line1\\nline2\\nunterminated code that never clos';
  const d = llm.parseResult(truncated);
  assert.strictEqual(d.game_name, "Big");
  assert.ok(Array.isArray(d.files) && d.files.length === 1, "recovered the in-progress file");
  assert.ok(d.files[0].content.startsWith("line1"), "kept the partial content");
});
test("parseResult: recovers when cut off between files (drops incomplete tail)", () => {
  const truncated = '{"game_name":"G","files":[{"path":"A.cs","content":"ok"},{"path":"B.cs","content":"half';
  const d = llm.parseResult(truncated);
  assert.strictEqual(d.game_name, "G");
  assert.ok(d.files.length >= 1 && d.files[0].content === "ok", "kept the complete first file");
});
test("isTruncated: recognises MAX_TOKENS / length finish reasons", () => {
  assert.ok(llm.isTruncated("MAX_TOKENS"));
  assert.ok(llm.isTruncated("length"));
  assert.ok(!llm.isTruncated("stop"));
  assert.ok(!llm.isTruncated(null));
});
test("extractBalanced / closeTruncated behave", () => {
  assert.strictEqual(llm.extractBalanced('{"a":1} trailing'), '{"a":1}');
  assert.strictEqual(llm.extractBalanced('{"a":1'), null); // truncated → no balanced object
  const closed = llm.closeTruncated('{"a":"b');
  assert.deepStrictEqual(JSON.parse(closed), { a: "b" });
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

// ---- Web writer ------------------------------------------------------------
test("writeWebProject: writes index.html and opens it", () => {
  const dir = mkTmp();
  const html = "<!doctype html><canvas></canvas><script>/* game */</script>";
  const out = writers.writeWebProject(dir, { game_name: "Canvas Runner", files: [{ path: "index.html", content: html }] });
  assert.ok(out.openTarget.endsWith("index.html"), "opens index.html");
  assert.strictEqual(fs.readFileSync(out.openTarget, "utf8"), html);
  assert.ok(out.root.includes("Web-CanvasRunner"));
  assert.ok(fs.existsSync(path.join(out.root, "HOW-TO-PLAY.txt")));
});
test("writeWebProject: blocks path traversal and always leaves something openable", () => {
  const dir = mkTmp();
  const out = writers.writeWebProject(dir, { game_name: "Edge", files: [{ path: "../../evil.html", content: "x" }] });
  const rootResolved = path.resolve(out.root);
  assert.ok(path.resolve(out.openTarget).startsWith(rootResolved), "open target stays inside the project");
  assert.ok(fs.existsSync(out.openTarget), "an index.html exists");
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

// ---- rate-limit detection + resilient fallback -----------------------------
test("isRateLimited: recognises 429 / quota / exhausted", () => {
  assert.ok(llm.isRateLimited("anything", 429));
  assert.ok(llm.isRateLimited("Resource has been exhausted (check quota)", 400));
  assert.ok(llm.isRateLimited("Rate limit reached for requests", 200));
  assert.ok(!llm.isRateLimited("bad request: prompt too long", 400));
});

test("buildCandidates: active provider first, multi-key, Ollama last", () => {
  const cfg = { provider: "groq", model: "llama-3.3-70b-versatile", keys: { groq: ["g1", "g2"], gemini: "k1" } };
  const cands = llm.buildCandidates(cfg);
  assert.strictEqual(cands[0].provider, "groq");
  assert.strictEqual(cands[0].apiKey, "g1");
  assert.strictEqual(cands[1].apiKey, "g2");         // second groq key
  assert.ok(cands.some(c => c.provider === "gemini" && c.apiKey === "k1"));
  assert.strictEqual(cands[cands.length - 1].provider, "ollama"); // unlimited last resort
});

test("generateResilient: rotates to the next key when the first is rate-limited", async () => {
  const seen = [];
  global.fetch = async (url) => {
    const key = String(url).match(/key=([^&]+)/)[1];
    seen.push(key);
    if (key === "k1") return mockRes(false, 429, JSON.stringify({ error: { message: "quota exhausted" } }));
    return mockRes(true, 200, JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }));
  };
  const cfg = { provider: "gemini", model: "gemini-2.5-flash", keys: { gemini: ["k1", "k2"] } };
  const r = await llm.generateResilient(cfg, "sys", "hi", false, 20, { retriesPer429: 0, sleep: async () => {} });
  assert.strictEqual(r.text, "OK");
  assert.strictEqual(r.provider, "gemini");
  assert.ok(seen.includes("k2"), "used the second key after the first was exhausted");
});

test("generateResilient: falls back to another provider when one is exhausted", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("generativelanguage")) return mockRes(false, 429, JSON.stringify({ error: { message: "RESOURCE_EXHAUSTED" } }));
    if (String(url).includes("api.groq.com")) return mockRes(true, 200, JSON.stringify({ choices: [{ message: { content: "GROQ_OK" } }] }));
    throw new Error("unexpected host");
  };
  const cfg = { provider: "gemini", model: "gemini-2.5-flash", keys: { gemini: "gk", groq: "qk" } };
  const r = await llm.generateResilient(cfg, "sys", "hi", true, 20, { retriesPer429: 0, sleep: async () => {} });
  assert.strictEqual(r.provider, "groq");
  assert.strictEqual(r.text, "GROQ_OK");
});

test("generateResilient: when everything fails, error points to Ollama", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("11434")) throw new Error("ECONNREFUSED"); // ollama not running
    return mockRes(false, 429, JSON.stringify({ error: { message: "quota exhausted" } }));
  };
  const cfg = { provider: "gemini", model: "gemini-2.5-flash", keys: { gemini: "gk", groq: "qk" } };
  await assert.rejects(
    () => llm.generateResilient(cfg, "sys", "hi", true, 20, { retriesPer429: 0, sleep: async () => {} }),
    /Ollama/,
  );
});

// ---- reference image embedding ---------------------------------------------
const PNG1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
test("writeUnityProject: embeds an attached image under Resources/", () => {
  const dir = mkTmp();
  const out = writers.writeUnityProject(dir, { game_name: "Img", files: [{ path: "A.cs", content: "//" }] }, { image: { base64: PNG1x1 } });
  assert.ok(fs.existsSync(path.join(out.root, "Assets", "UnityGUI", "Generated", "Resources", "reference.png")), "reference.png in Resources");
});
test("writeWebProject: embeds an attached image under assets/", () => {
  const dir = mkTmp();
  const out = writers.writeWebProject(dir, { game_name: "Img", files: [{ path: "index.html", content: "<img src='assets/reference.png'>" }] }, { image: { base64: PNG1x1 } });
  assert.ok(fs.existsSync(path.join(out.root, "assets", "reference.png")), "reference.png in assets");
});
test("assetList + multi-asset embed: named images land in Resources/ and assets/", () => {
  const opts = { images: [{ name: "player", base64: PNG1x1 }, { name: "enemy!!", base64: PNG1x1 }] };
  const names = writers.assetList(opts).map(a => a.name);
  assert.deepStrictEqual(names, ["player", "enemy"], "names sanitized for filenames");
  const u = writers.writeUnityProject(mkTmp(), { game_name: "Multi", files: [{ path: "A.cs", content: "//" }] }, opts);
  assert.ok(fs.existsSync(path.join(u.root, "Assets", "UnityGUI", "Generated", "Resources", "player.png")));
  assert.ok(fs.existsSync(path.join(u.root, "Assets", "UnityGUI", "Generated", "Resources", "enemy.png")));
  const w = writers.writeWebProject(mkTmp(), { game_name: "Multi", files: [{ path: "index.html", content: "<canvas>" }] }, opts);
  assert.ok(fs.existsSync(path.join(w.root, "assets", "player.png")) && fs.existsSync(path.join(w.root, "assets", "enemy.png")));
});
test("buildAssetHint: names + correct load path per engine", () => {
  assert.strictEqual(prompts.buildAssetHint("web", []), "");
  const web = prompts.buildAssetHint("web", ["player", "enemy"]);
  assert.ok(/assets\/player\.png/.test(web) && /assets\/enemy\.png/.test(web));
  const uni = prompts.buildAssetHint("unity", ["player"]);
  assert.ok(/Resources\.Load<Texture2D>/.test(uni) && /player/.test(uni));
});

// ---- inline editor: safe path join -----------------------------------------
test("safeJoin: keeps paths inside the project, blocks traversal", () => {
  const root = mkTmp();
  assert.ok(writers.safeJoin(root, "index.html"), "in-project path allowed");
  assert.ok(writers.safeJoin(root, "a/b/c.js"), "nested path allowed");
  assert.strictEqual(writers.safeJoin(root, "../../etc/passwd"), null, "traversal blocked");
  assert.strictEqual(writers.safeJoin(root, "a/../../evil"), null, "traversal via .. blocked");
  // a leading-slash rel is neutralised into the project by path.join (stays inside, not an escape)
  const abs = writers.safeJoin(root, "/abs/evil");
  assert.ok(abs && abs.startsWith(path.resolve(root)), "absolute-looking rel is contained inside the project");
});
test("diskRelFor: maps a file to its on-disk path per engine", () => {
  assert.strictEqual(writers.diskRelFor("web", { path: "index.html" }), "index.html");
  assert.strictEqual(writers.diskRelFor("web", { name: "game" }), "game.html"); // ext added
  assert.strictEqual(writers.diskRelFor("unity", { path: "Assets/UnityGUI/Generated/Boot.cs" }), "Assets/UnityGUI/Generated/Boot.cs");
  assert.strictEqual(writers.diskRelFor("unity", { name: "Player" }), "Assets/UnityGUI/Generated/Player.cs");
  assert.strictEqual(writers.diskRelFor("roblox", { name: "World" }), null); // not editable
});
test("Unity inline-edit round-trip: diskRelFor points at the written .cs", () => {
  const dir = mkTmp();
  const file = { path: "Assets/UnityGUI/Generated/Boot.cs", name: "Boot", content: "// old" };
  const out = writers.writeUnityProject(dir, { game_name: "Edit", files: [file] });
  const rel = writers.diskRelFor("unity", file);
  const target = writers.safeJoin(out.root, rel);
  assert.ok(target && fs.existsSync(target), "the .cs the writer produced is found via diskRelFor");
  fs.writeFileSync(target, "// new code", "utf8");
  assert.strictEqual(fs.readFileSync(target, "utf8"), "// new code");
});
test("safeJoin round-trip: an edit written back is read the same", () => {
  const dir = mkTmp();
  const out = writers.writeWebProject(dir, { game_name: "Edit", files: [{ path: "index.html", content: "<canvas>old</canvas>" }] });
  const target = writers.safeJoin(out.root, "index.html");
  const edited = "<canvas>new — with \"quotes\" and\nnewlines</canvas>";
  fs.writeFileSync(target, edited, "utf8");
  assert.strictEqual(fs.readFileSync(out.openTarget, "utf8"), edited, "edit persisted verbatim");
});

// ---- single-file HTML export -----------------------------------------------
test("inlineHtmlAssets: turns a local image src into a data URI", () => {
  const html = '<img src="assets/reference.png"><a href="https://x/y.png">keep</a><img src="data:image/png;base64,AA">';
  const out = writers.inlineHtmlAssets(html, (rel) => rel === "assets/reference.png" ? Buffer.from("hello") : null);
  assert.ok(out.includes("data:image/png;base64," + Buffer.from("hello").toString("base64")), "local asset inlined");
  assert.ok(out.includes('href="https://x/y.png"'), "remote url left alone");
});
test("writeStandaloneHtml: produces one self-contained file with the asset inlined", () => {
  const dir = mkTmp();
  const out = writers.writeWebProject(dir, { game_name: "Solo", files: [{ path: "index.html", content: "<canvas></canvas><img src='assets/reference.png'>" }] }, { image: { base64: PNG1x1 } });
  const solo = writers.writeStandaloneHtml(out.root);
  assert.ok(solo && solo.endsWith("-standalone.html"), "wrote a -standalone.html");
  const text = fs.readFileSync(solo, "utf8");
  assert.ok(text.includes("data:image/png;base64,"), "asset inlined into the single file");
  assert.ok(!/src=['"]assets\//.test(text), "no leftover relative asset references");
});

// ---- Unity locator ---------------------------------------------------------
test("unity.pickNewest: chooses the newest editor version", () => {
  assert.strictEqual(unity.pickNewest(["2021.3.10f1", "2022.3.40f1", "2020.3.1f1"]), "2022.3.40f1");
  assert.strictEqual(unity.pickNewest(["2022.3.9f1", "2022.3.40f1"]), "2022.3.40f1");
  assert.strictEqual(unity.pickNewest([]), null);
});
test("unity.findUnityExe: locates Unity.exe under a Hub editor root (mocked fs)", () => {
  // Build a fake fs that reports an editor version dir + the exe underneath.
  const roots = unity.editorRoots();
  const rel = unity.exeRelParts().join(require("path").sep);
  const exePath = require("path").join(roots[0], "2022.3.40f1", ...unity.exeRelParts());
  const fakeFs = {
    readdirSync: (d) => (d === roots[0] ? ["2022.3.40f1", "readme.txt"] : (() => { throw new Error("nope"); })()),
    existsSync: (p) => p === exePath,
  };
  const found = unity.findUnityExe(fakeFs);
  assert.ok(found && found.includes("2022.3.40f1") && found.endsWith(rel), "found the newest exe");
});

// ---- image (vision) passthrough --------------------------------------------
test("callGemini: sends an attached image as inline_data", async () => {
  let sentBody = null;
  global.fetch = async (url, opts) => { sentBody = JSON.parse(opts.body); return mockRes(true, 200, JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] })); };
  const r = await llm.callGemini("k", "gemini-2.5-flash", "sys", "make a game", true, 100, [{ mime: "image/png", data: "AAAA" }]);
  assert.strictEqual(r.text, "OK");
  const parts = sentBody.contents[0].parts;
  const img = parts.find(p => p.inline_data);
  assert.ok(img && img.inline_data.data === "AAAA" && img.inline_data.mime_type === "image/png", "image inlined");
});
test("generateResilient: image requires Gemini (errors without a Gemini key)", async () => {
  const cfg = { provider: "groq", model: "llama-3.3-70b-versatile", keys: { groq: "qk" } };
  await assert.rejects(
    () => llm.generateResilient(cfg, "sys", "hi", true, 100, { images: [{ mime: "image/png", data: "AAAA" }], retriesPer429: 0, sleep: async () => {} }),
    /Gemini/,
  );
});

// ---- free AI art (Pollinations) --------------------------------------------
test("art.artUrl: encodes the prompt and clamps size", () => {
  const u = art.artUrl("a cute pixel dragon", { width: 999999, height: 10, seed: 7 });
  assert.ok(u.startsWith("https://image.pollinations.ai/prompt/"));
  assert.ok(u.includes("a%20cute%20pixel%20dragon"), "prompt url-encoded");
  assert.ok(/width=1536/.test(u), "width clamped to max");
  assert.ok(/height=64/.test(u), "height clamped to min");
  assert.ok(/nologo=true/.test(u) && /seed=7/.test(u));
});
test("art.clampInt: bounds and defaults", () => {
  assert.strictEqual(art.clampInt(5000, 64, 1536, 512), 1536);
  assert.strictEqual(art.clampInt(1, 64, 1536, 512), 64);
  assert.strictEqual(art.clampInt("nope", 64, 1536, 512), 512);
});

// ---- ZIP writer ------------------------------------------------------------
test("zip: crc32 matches the PKZIP reference vector", () => {
  assert.strictEqual(zip.crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("zip: buffer has PK signatures and round-trips its entries", () => {
  const zlib = require("zlib");
  const entries = [
    { name: "Game/Boot.cs", data: "using UnityEngine; // " + "x".repeat(500) },
    { name: "Game/readme.txt", data: "hi" },
  ];
  const buf = zip.zipBuffer(entries);
  assert.strictEqual(buf.readUInt32LE(0), 0x04034b50, "local file header signature");
  // EOCD near the end with the right entry count
  const eocd = buf.length - 22;
  assert.strictEqual(buf.readUInt32LE(eocd), 0x06054b50, "EOCD signature");
  assert.strictEqual(buf.readUInt16LE(eocd + 10), entries.length, "total entries");
  // decode the first local entry and compare the bytes back
  const method = buf.readUInt16LE(8);
  const nameLen = buf.readUInt16LE(26), extraLen = buf.readUInt16LE(28);
  const compSize = buf.readUInt32LE(18);
  const start = 30 + nameLen + extraLen;
  const body = buf.subarray(start, start + compSize);
  const out = method === 8 ? zlib.inflateRawSync(body) : body;
  assert.strictEqual(out.toString("utf8"), entries[0].data, "first entry round-trips");
});

test("zip: zipDir packs a real project directory", () => {
  const dir = mkTmp();
  const out = writers.writeUnityProject(dir, { game_name: "Zippable", files: [{ path: "A.cs", content: "// a" }] });
  const zipPath = zip.zipDir(out.root);
  assert.ok(fs.existsSync(zipPath) && zipPath.endsWith(".zip"));
  assert.ok(fs.statSync(zipPath).size > 100, "zip has content");
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
