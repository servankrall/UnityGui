// =============================================================================
//  Prompt building + genre quick-starts (shared by main process and tests)
// =============================================================================

function styleLine(style) {
  return style === "2d" ? "Make a 2D game."
    : style === "3d" ? "Make a 3D game."
    : "Choose 2D or 3D based on what best fits the request.";
}

// Genre quick-starts — engine-aware starter prompts (ForgeGUI-style categories).
const GENRES = {
  unity: [
    { id: "platformer", label: "Platformer", icon: "🏃", prompt: "A 2D platformer: run and jump across platforms, collect coins, avoid spikes, reach the flag to win. Arrow keys to move, space to jump." },
    { id: "shooter", label: "Top-down shooter", icon: "🔫", prompt: "A top-down twin-stick shooter: WASD to move, mouse to aim and click to shoot waves of enemies. Health bar and score." },
    { id: "runner", label: "Endless runner", icon: "🌀", prompt: "A 3D endless runner: the player auto-runs forward, swipe/arrow to switch lanes and jump over obstacles. Distance score, speeds up over time." },
    { id: "fps", label: "First-person", icon: "🎯", prompt: "A simple first-person shooter arena: WASD + mouse look, click to shoot targets that spawn around the room. Timer and score." },
    { id: "puzzle", label: "Puzzle", icon: "🧩", prompt: "A grid-based sokoban puzzle: push boxes onto goal tiles to solve each level. Arrow keys to move, R to reset." },
    { id: "tower", label: "Tower defense", icon: "🏰", prompt: "A tower defense: place towers along a path to stop waves of enemies from reaching your base. Gold, lives, and increasing waves." },
    { id: "brick", label: "Brick breaker", icon: "🧱", prompt: "A brick-breaker: move a paddle to bounce the ball and clear all bricks. Lives counter and score, multiple rows of bricks." },
    { id: "flappy", label: "Flappy", icon: "🐤", prompt: "A flappy-bird clone: tap/space to flap and fly between gaps in pipes. Score for each pipe passed, restart on crash." },
  ],
  roblox: [
    { id: "obby", label: "Obby", icon: "🧗", prompt: "An obby: jump across floating platforms with moving parts and kill-bricks to reach the winner pad at the end. Checkpoints along the way." },
    { id: "tycoon", label: "Tycoon", icon: "🏭", prompt: "A simple tycoon: buy droppers that generate cash, collect it from a conveyor, and buy upgrades. Leaderstats with Cash." },
    { id: "simulator", label: "Simulator", icon: "⛏️", prompt: "A clicker/simulator: click to mine blocks and earn coins, buy better pickaxes, and watch a leaderstats coin counter grow." },
    { id: "obby-timed", label: "Deathrun", icon: "💀", prompt: "A deathrun: race across a course while traps trigger. First to the finish wins the round, then it resets. Round timer and leaderboard." },
    { id: "collect", label: "Collect race", icon: "🪙", prompt: "A coin-collecting race: coins spawn around the map, players run to grab them, most coins when the timer ends wins the round." },
    { id: "pvp", label: "Arena PvP", icon: "⚔️", prompt: "A tag/PvP arena: players spawn with a tool, tagging another player scores a point. Leaderstats Points and a round timer." },
    { id: "parkour", label: "Parkour", icon: "🤸", prompt: "A parkour map: wall-jump and sprint across rooftops to reach the goal, with a sprint bar and a checkpoint system." },
    { id: "survival", label: "Survival", icon: "🌋", prompt: "A survival round game: lava rises over time, players jump to higher platforms to stay alive, last one standing wins the round." },
  ],
};

function genresFor(engine) {
  return GENRES[engine] || GENRES.unity;
}

function buildSystemPrompt(engine, style) {
  if (engine === "roblox") {
    return `You are an expert Roblox game engineer. From the user's description you generate a COMPLETE, PLAYABLE Roblox experience as Luau scripts.

RULES
- Pure Luau for Roblox Studio. Build the whole game FROM CODE at runtime: a server Script spawns parts, sets up the map, gameplay, scoring and win/lose; LocalScripts handle input and on-screen GUI (create GUI in code).
- ${styleLine(style)}
- Use Roblox services (game:GetService("Players"), Workspace, ReplicatedStorage, UserInputService, TweenService, RunService, etc.). Do NOT reference external assets or asset IDs.
- Complete, valid Luau — no TODOs, no placeholders. The game must work when the player presses Play.

OUTPUT — respond with ONLY a single JSON object, no markdown or code fences, with EXACTLY these keys:
  "game_name": string,
  "summary": string,
  "setup_notes": string (how to play),
  "files": array of objects, each { "name": string (script name), "kind": "server" | "local" | "module", "content": string (the Luau source) }
Put gameplay/world building in a "server" script, input/GUI in a "local" script, shared helpers in "module". Do not include XML tags such as <thinking>.`;
  }
  // Unity
  return `You are an expert Unity gameplay engineer. From the user's description you generate a COMPLETE, PLAYABLE Unity game as one or more C# scripts for a fresh Unity project.

RULES
- Unity 2021 LTS+, Built-in Render Pipeline, legacy Input Manager (UnityEngine.Input), UnityEngine.UI. Pure C# only; no external packages, prefabs, textures, models, or .unity scene files.
- ${styleLine(style)}
- SELF-BOOTSTRAPPING: include ONE MonoBehaviour with [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void Boot() { ... } that builds the whole game from code (camera, lights, player, level, enemies, UI) so pressing Play in an empty scene just works.
- Namespace types under UnityGUI.Generated. No UnityEditor usage. Complete, valid, compiling C# — no TODOs or placeholders.

OUTPUT — respond with ONLY a single JSON object, no markdown or code fences, with EXACTLY these keys:
  "game_name": string,
  "summary": string,
  "setup_notes": string (how to play),
  "files": array of objects, each { "path": string (under Assets/UnityGUI/Generated/, ends with .cs), "content": string (the full C# source) }
Do not include XML tags such as <thinking>.`;
}

function buildRefinePrompt(prevResult, instruction) {
  const files = ((prevResult && prevResult.files) || []).map(f => {
    const name = f.path || f.name || "file";
    return `--- ${name} ---\n${f.content}`;
  }).join("\n\n");
  return `Here is the current game. Apply this change and return the FULL updated game as the same JSON shape (all files, complete):\n\nCHANGE REQUESTED: ${instruction}\n\nCURRENT FILES:\n${files}`;
}

// Prompt enhancer — expands a short idea into a rich, buildable design brief.
const ENHANCE_SYSTEM =
  "You are a senior game designer. Expand the user's short idea into a single, concrete, buildable game brief in ENGLISH. " +
  "Keep it to 4-7 sentences. Specify: the core loop, player controls, win/lose conditions, and 2-3 concrete mechanics or enemies. " +
  "Do not include headings, lists, markdown, code, or JSON — return only the plain prose brief.";

function buildEnhancePrompt(engine, idea) {
  const eng = engine === "roblox" ? "Roblox Studio (Luau)" : "Unity (C#)";
  return `Target engine: ${eng}. Turn this idea into a detailed, buildable game brief:\n\n"${idea}"`;
}

module.exports = {
  styleLine, GENRES, genresFor,
  buildSystemPrompt, buildRefinePrompt,
  ENHANCE_SYSTEM, buildEnhancePrompt,
};
