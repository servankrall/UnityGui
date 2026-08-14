/* =========================================================================
   UnityGUI — Shared catalog data (game genres, prompts, pricing, FAQ)
   ========================================================================= */
(function (global) {
  "use strict";

  // Inline SVG icons (stroke uses currentColor)
  const I = {
    platformer: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="7" r="2.5"/><path d="M3 14h6M13 11h8M15 17h6"/></svg>`,
    shooter: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M12 12h.01"/></svg>`,
    runner: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a2 2 0 1 0 0-.01"/><path d="M7 21l3-6 3 2 1 4M10 15l-2-4 4-2 3 3 3-1"/></svg>`,
    breakout: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h4M10 5h4M16 5h4M4 9h4M10 9h4M16 9h4"/><circle cx="12" cy="16" r="1.6"/><path d="M8 20h8"/></svg>`,
    maze: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h6v6M15 3v6h6M9 21v-6h6"/></svg>`,
    topdown: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l3 6 6 .9-4.5 4.2 1.1 6-5.6-3-5.6 3 1.1-6L3 9.9 9 9z"/></svg>`,
    puzzle: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H4v-3a2 2 0 1 1 0-4z"/></svg>`,
    tower: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M6 20V9l6-4 6 4v11M10 20v-5h4v5"/></svg>`,
    editor: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v18M4 7.5l8 4.5 8-4.5"/></svg>`,
  };

  // Genres you can generate (rendered in the "what you can build" grid)
  const GENRES = [
    { id: "platformer", name: "2D Platformer", short: "jump · collect", icon: I.platformer,
      desc: "Run, jump and collect across platforms with gravity, coins and a goal." },
    { id: "runner", name: "Endless Runner", short: "auto-run · dodge", icon: I.runner,
      desc: "Auto-scrolling dodge-'em-up with spawning obstacles and a distance score." },
    { id: "shooter", name: "Twin-stick Shooter", short: "move · aim · fire", icon: I.shooter,
      desc: "Move with WASD, aim with the mouse, and blast waves of enemies." },
    { id: "breakout", name: "Brick Breaker", short: "paddle · ball", icon: I.breakout,
      desc: "Bounce a ball off a paddle to clear a wall of bricks. Lives and score." },
    { id: "maze", name: "First-person Maze", short: "explore · escape", icon: I.maze,
      desc: "WASD + mouse-look through a maze to find the exit against a timer." },
    { id: "topdown", name: "Top-down Arcade", short: "collect · survive", icon: I.topdown,
      desc: "Overhead movement, pickups and hazards — arcade loops from a sentence." },
    { id: "puzzle", name: "Grid Puzzle", short: "match · solve", icon: I.puzzle,
      desc: "Click-and-solve grid mechanics with a win condition and move counter." },
    { id: "tower", name: "Tower Defense", short: "place · defend", icon: I.tower,
      desc: "Place towers to stop waves of enemies marching along a path." },
  ];
  // Back-compat alias (older code paths referenced ASSET_TYPES)
  const ASSET_TYPES = GENRES;

  const PROMPT_IDEAS = [
    "A 2D endless runner where a cube jumps over incoming obstacles. Space to jump, score for distance.",
    "A top-down twin-stick shooter: WASD to move, mouse to aim and shoot spawning enemies. Health bar and score.",
    "A first-person maze: WASD + mouse look, find the glowing exit before the timer runs out.",
    "A brick-breaker: paddle on arrow keys, bounce the ball to clear all bricks, lives counter.",
    "A tiny platformer: a capsule collects coins on floating platforms. Arrow keys + space to jump.",
    "A tower defense where cubes march a path and you place turrets to stop them.",
    "A one-button flappy-style game: tap to flap through gaps in scrolling pipes.",
    "A snake game on a grid: eat food to grow, don't hit the walls or yourself.",
    "An asteroids clone: rotate and thrust a ship, shoot drifting asteroids into pieces.",
    "A whack-a-mole: cubes pop up from holes, click them fast to score before time runs out.",
  ];

  const PRICING = [
    { name: "The Plugin", price: "Free", cadence: "open source", desc: "The UnityGUI Editor plugin itself. Yours to use, read and modify.",
      feats: ["Full C# source (MIT)", "Editor-only, no build bloat", "All game genres", "Self-bootstrapping output", "No account required"],
      cta: "Get the plugin", featured: false },
    { name: "The AI", price: "Free", cadence: "free providers", desc: "Runs on a free AI provider — Google Gemini, Groq, or local Ollama. No paid Claude key.",
      feats: ["Free Gemini / Groq key", "Ollama runs offline (no key)", "Choose your model", "Key stays on your machine", "No middleman"],
      cta: "Get a free key", featured: true },
    { name: "Open source", price: "$0", cadence: "forever", desc: "Fork it, extend the genres, or wire in your own backend — the seams are documented.",
      feats: ["Clear generation seam", "Structured-output schema", "Contributions welcome", "No lock-in", "Self-host friendly"],
      cta: "View the repo", featured: false },
  ];

  const FAQ = [
    { q: "What exactly does UnityGUI generate?", a: "A complete, playable Unity game as C# scripts, written straight into your project. Each game is self-bootstrapping — it builds its own camera, player, level and UI from code — so you just press Play in an empty scene." },
    { q: "Is it free? Do I need a paid Claude key?", a: "It's free. Generation runs on a free AI provider — Google Gemini (free tier, no credit card), Groq (free), or Ollama (100% free and offline, no key at all). You pick the provider and paste its free key; it's stored locally and nothing is proxied through us." },
    { q: "Which Unity version and pipeline?", a: "Unity 2021 LTS or newer on the Built-in Render Pipeline, using the legacy Input Manager. The generated code avoids external packages, prefabs and art assets so it runs anywhere." },
    { q: "Does it create scenes, prefabs or art?", a: "Yes — in Pro mode it generates a real .unity scene, prefabs, and procedural art assets (PNG sprites, materials and meshes) wired into a playable scene. A Lite mode is also available that writes self-bootstrapping scripts only, with no extra asset files." },
    { q: "Which models can I use?", a: "Free ones: Gemini 2.0 Flash / 1.5 Flash (Google), Llama 3.3 70B and others (Groq), or any local model via Ollama (qwen2.5-coder, llama3.1, …). Pick the provider and model right in the app or plugin window." },
    { q: "Is it really the ForgeGUI idea for Unity?", a: "Yes — same describe-to-generate concept, rebuilt as a Unity Editor tool that produces runnable games instead of a hosted asset service." },
  ];

  global.UnityGUIData = { GENRES, ASSET_TYPES, PROMPT_IDEAS, PRICING, FAQ, ICONS: I };
})(typeof window !== "undefined" ? window : this);
