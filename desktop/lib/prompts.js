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
    { id: "racing", label: "Racing", icon: "🏎️", prompt: "A top-down racing game: drive a car around a looping track for the fastest lap. Arrow keys to steer and accelerate, a lap timer and best-lap display." },
    { id: "snake", label: "Snake", icon: "🐍", prompt: "A classic snake: the snake grows each time it eats food on a grid; don't hit the walls or yourself. Arrow keys to turn, score for each food." },
    { id: "space", label: "Space shooter", icon: "🚀", prompt: "A vertical space shooter: fly a ship at the bottom, shoot descending alien waves, dodge their bullets. Lives and score, boss after several waves." },
    { id: "match3", label: "Match-3", icon: "💎", prompt: "A match-3 puzzle: swap adjacent gems on a grid to line up 3+ of the same color, which clear and drop new gems. Score and a move counter." },
    { id: "dungeon", label: "Dungeon crawler", icon: "🗡️", prompt: "A top-down dungeon crawler: explore procedurally-placed rooms, fight enemies with a melee attack, pick up health, reach the exit. WASD + click." },
    { id: "stealth", label: "Stealth", icon: "🕵️", prompt: "A top-down stealth game: sneak past guards with vision cones to reach the exit without being seen. WASD to move, crouch to move quietly." },
    { id: "rhythm", label: "Rhythm", icon: "🎵", prompt: "A rhythm game: notes fall down four lanes to a beat, press D/F/J/K to hit them on time. Combo counter, accuracy, and score." },
    { id: "idle", label: "Idle clicker", icon: "🍪", prompt: "An idle/incremental clicker: click the big button to earn points, buy auto-generators that earn points per second, and watch upgrades stack." },
  ],
  web: [
    { id: "platformer", label: "Platformer", icon: "🏃", prompt: "A 2D canvas platformer: run and jump across platforms, collect coins, avoid spikes, reach the flag. Arrow keys + space, score and lives." },
    { id: "shooter", label: "Space shooter", icon: "🚀", prompt: "A vertical space shooter on canvas: move a ship with arrows, space to fire at descending enemy waves, dodge bullets. Lives and score." },
    { id: "snake", label: "Snake", icon: "🐍", prompt: "Classic snake on a grid canvas: eat food to grow, don't hit walls or yourself. Arrow keys, score and speed-up, restart on death." },
    { id: "breakout", label: "Breakout", icon: "🧱", prompt: "A breakout/brick-breaker on canvas: mouse-move the paddle to bounce the ball and clear rows of bricks. Lives, score, win screen." },
    { id: "flappy", label: "Flappy", icon: "🐤", prompt: "A flappy clone on canvas: click/space to flap between pipe gaps. Score per pipe, restart on crash, day/night background." },
    { id: "runner", label: "Runner", icon: "🌀", prompt: "A side-scrolling endless runner on canvas: auto-run, jump over and slide under obstacles. Distance score, speeds up, restart on hit." },
    { id: "pong", label: "Pong", icon: "🏓", prompt: "A pong game on canvas: player paddle vs a simple AI paddle, ball bounces and speeds up, first to 5 points wins. W/S or mouse." },
    { id: "memory", label: "Memory match", icon: "🃏", prompt: "A memory card-matching game on canvas/DOM: flip cards to find pairs, moves and timer, win when all pairs are found." },
    { id: "tetris", label: "Blocks", icon: "🟦", prompt: "A falling-blocks puzzle on canvas: rotate and move tetromino pieces to clear full lines. Arrow keys, level, score and next-piece." },
    { id: "clicker", label: "Clicker", icon: "🍪", prompt: "An incremental clicker (DOM/canvas): click to earn points, buy auto-generators and upgrades that boost points-per-second." },
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
    { id: "hide", label: "Hide & seek", icon: "🙈", prompt: "A hide-and-seek round game: one player is the seeker, the rest hide around the map before a timer; found players join the seekers. Round timer and results." },
    { id: "disaster", label: "Natural disaster", icon: "🌪️", prompt: "A survive-the-disaster game: players spawn on a map, a random disaster (flood, tornado, meteors) strikes each round, survivors earn points." },
    { id: "dropper", label: "Dropper", icon: "🪂", prompt: "A dropper: players fall down a long vertical shaft dodging obstacles to land safely on the pad at the bottom. Multiple levels, checkpoints." },
    { id: "sword", label: "Sword fights", icon: "🗡️", prompt: "A sword-fighting arena: everyone spawns with a sword tool, hitting another player scores a kill on the leaderboard. Respawns and round resets." },
    { id: "escape", label: "Escape room", icon: "🔑", prompt: "A co-op escape room: players solve button and lever puzzles across a few rooms to unlock the exit door before a timer runs out." },
    { id: "petsim", label: "Pet sim", icon: "🐾", prompt: "A pet simulator: collect coins around the map, buy eggs that hatch random pets, and pets add to your coin multiplier. Leaderstats Coins and Pets." },
    { id: "koth", label: "King of the hill", icon: "👑", prompt: "A king-of-the-hill: stand inside the glowing zone to earn points over time while others try to push you out. First to the target score wins the round." },
    { id: "race", label: "Free-for-all race", icon: "🏁", prompt: "A foot race: all players sprint from the start to the finish line across an obstacle course; first three to finish earn podium points." },
  ],
};

function genresFor(engine) {
  return GENRES[engine] || GENRES.unity;
}

// One-tap prompt "spice" — quick modifiers appended to the prompt to enrich a game.
const MODIFIERS = [
  { id: "harder", icon: "🔥", label: "Harder", text: "Make it more challenging — faster pace and smarter/tougher enemies." },
  { id: "levels", icon: "🗺️", label: "Levels", text: "Add multiple levels of increasing difficulty." },
  { id: "powerups", icon: "🍄", label: "Power-ups", text: "Add collectible power-ups that change gameplay." },
  { id: "juice", icon: "🧃", label: "More juice", text: "Add game feel: tweening, squash-and-stretch, and satisfying feedback." },
  { id: "particles", icon: "✨", label: "Particles", text: "Add particle effects and a little screen shake for impact." },
  { id: "neon", icon: "🌈", label: "Neon", text: "Use a vibrant neon / glow visual style." },
  { id: "retro", icon: "🕹️", label: "Retro", text: "Give it a retro 8-bit pixel look with chiptune-style beeps." },
  { id: "sfx", icon: "🔊", label: "More SFX", text: "Add more distinct sound effects for every action." },
  { id: "highscore", icon: "🏆", label: "High score", text: "Add a persistent high-score and a combo/multiplier system." },
];

function buildSystemPrompt(engine, style) {
  if (engine === "web") {
    return `You are an expert HTML5 game developer. From the user's description you generate a COMPLETE, PLAYABLE browser game as ONE self-contained HTML file that runs by simply opening it — no server, no build, no external files or CDNs.

RULES
- A single index.html with ALL CSS and JavaScript inline. Vanilla JS only (no frameworks, no external <script src>, no CDN links, no imported assets/fonts/images).
- Render with an HTML5 <canvas> (or DOM for card/clicker games) sized to the window; a requestAnimationFrame game loop; keyboard/mouse/touch input.
- ${styleLine(style)}
- PROCEDURAL ART: draw ALL graphics in code (canvas shapes, gradients, paths) — no image files. Give it real visual polish (colors, gradients, simple particles/animation).
- PROCEDURAL SOUND: synthesize sound effects with the Web Audio API (AudioContext oscillators/gain) — short beeps/blips for actions, and start audio on first user interaction. No audio files.
- Include a start screen and a game-over/restart, an on-screen score/lives HUD, and win/lose logic. Complete, valid, runnable code — no TODOs or placeholders.

OUTPUT — respond with ONLY a single JSON object, no markdown or code fences, with EXACTLY these keys:
  "game_name": string,
  "summary": string,
  "setup_notes": string (how to play),
  "files": array with a SINGLE object { "path": "index.html", "content": string (the full HTML document) }
Do not include XML tags such as <thinking>.`;
  }
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

// Turn captured runtime errors into a concrete "fix these" refine instruction.
function buildFixPrompt(errors) {
  const list = (errors || []).slice(0, 8).map(e => "- " + String(e).slice(0, 300)).join("\n");
  return `The game produced these runtime errors / console errors when it ran. Fix ALL of them and return the full corrected game (same JSON shape):\n${list}`;
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
  styleLine, GENRES, genresFor, MODIFIERS,
  buildSystemPrompt, buildRefinePrompt, buildFixPrompt,
  ENHANCE_SYSTEM, buildEnhancePrompt,
};
