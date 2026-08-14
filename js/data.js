/* =========================================================================
   UnityGUI — Shared catalog data (asset types, presets, pricing)
   ========================================================================= */
(function (global) {
  "use strict";

  // Inline SVG icons (stroke uses currentColor)
  const I = {
    ui: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M7 13h4M7 16h7"/></svg>`,
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8v8M8 12h8"/></svg>`,
    thumbnail: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4-4 3 3 3-4 4 5"/></svg>`,
    sprite: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v3h3v6h-3v3H9v-3H6V6h3z"/><path d="M9 9h.01M15 9h.01"/></svg>`,
    character: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>`,
    model3d: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v18M4 7.5l8 4.5 8-4.5"/></svg>`,
    texture: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>`,
    skybox: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="7" r="3"/><path d="M3 20c1.5-3 4-4 6-4s3 1 5 1 3-1 5-2"/><path d="M3 15c1.5-2 3-3 5-2.5"/></svg>`,
  };

  const ASSET_TYPES = [
    { id: "ui",        name: "UI / GUI Kits",   short: "UGUI · UI Toolkit", icon: I.ui,
      desc: "Menus, HUDs, inventory panels & button sets exported as Unity prefabs and 9-sliced sprites." },
    { id: "icon",      name: "Game Icons",      short: "512² · sRGB", icon: I.icon,
      desc: "Crisp ability, item and app icons with transparent PNGs ready for the Unity Asset Store." },
    { id: "thumbnail", name: "Thumbnails",      short: "1280×720", icon: I.thumbnail,
      desc: "High-CTR store banners & YouTube thumbnails tuned for Unity game promos." },
    { id: "sprite",    name: "2D Sprites",      short: "Pixel · Sheet", icon: I.sprite,
      desc: "Characters, items and tiles as sprite sheets that slice straight into the Sprite Editor." },
    { id: "character", name: "Characters",      short: "Concept · Rig-ready", icon: I.character,
      desc: "Stylised hero & NPC concepts with clean silhouettes for your 2D and 2.5D games." },
    { id: "model3d",   name: "3D Props",        short: "FBX + PBR", icon: I.model3d,
      desc: "Low-poly props and modular kits with PBR maps for URP & HDRP scenes." },
    { id: "texture",   name: "Textures",        short: "Seamless · PBR", icon: I.texture,
      desc: "Tileable materials with albedo, normal and roughness maps for any pipeline." },
    { id: "skybox",    name: "Skyboxes",        short: "Panoramic", icon: I.skybox,
      desc: "360° panoramic skies & cubemaps to drop onto your scene lighting in seconds." },
  ];

  const STYLE_PRESETS = [
    "auto", "Nebula", "Ember", "Toxic", "Sunset", "Ocean", "Royal", "Mono", "Lava",
  ];

  const PROMPT_IDEAS = [
    "Sci-fi HUD with health bar and minimap, neon blue",
    "Fantasy inventory panel, ornate golden frame",
    "Glowing fire spell ability icon",
    "Cute slime enemy sprite sheet, green",
    "Cyberpunk pause menu, purple glass UI",
    "Low-poly treasure chest prop",
    "Seamless stone dungeon floor texture",
    "Sunset desert skybox with two moons",
    "Retro pixel coin pickup icon",
    "Mobile game start screen, cartoon style",
  ];

  const PRICING = [
    { name: "Indie", price: "$0", cadence: "forever", desc: "Everything to prototype your first game jam UI.",
      feats: ["25 generations / month", "All 8 asset types", "PNG & sprite export", "Personal projects", "Community showcase"],
      cta: "Start free", featured: false },
    { name: "Pro", price: "$19", cadence: "/ month", desc: "For solo devs & small studios shipping real games.",
      feats: ["1,500 generations / month", "Prefab & FBX export", "4K upscaling", "Private generations", "Style presets & seeds", "Commercial license"],
      cta: "Go Pro", featured: true },
    { name: "Studio", price: "$59", cadence: "/ month", desc: "Unlimited firepower for teams and asset flippers.",
      feats: ["Unlimited generations", "Batch & API access", "Team seats (5)", "URP / HDRP material sets", "Priority queue", "Dedicated support"],
      cta: "Contact sales", featured: false },
  ];

  const FAQ = [
    { q: "How does UnityGUI generate assets?", a: "Describe what you need in plain English, pick an asset type and style, and the engine produces Unity-ready previews in seconds. Each result includes export metadata (resolution, format) so you know exactly what drops into your project." },
    { q: "Which Unity versions & pipelines are supported?", a: "Everything targets Unity 2021 LTS and newer. UI kits export for both uGUI and UI Toolkit, and 3D/texture assets ship PBR maps for Built-in, URP and HDRP." },
    { q: "Can I use generated assets commercially?", a: "Yes — Pro and Studio plans include a full commercial license so you can ship generated assets in games you sell. The free Indie tier covers personal and game-jam use." },
    { q: "Do I need to install anything in Unity?", a: "No plugin is required. Download the PNG, sprite sheet, prefab or FBX and import it like any other asset. An optional Unity package importer is on the roadmap." },
    { q: "Is this the same as the ForgeGUI platform?", a: "UnityGUI is an independent, Unity-focused clone of the ForgeGUI concept — the same describe-to-generate workflow, rebuilt around Unity's asset formats and rendering pipelines." },
    { q: "Can I plug in my own AI model?", a: "Absolutely. The generation engine exposes a single documented seam (UnityGUIGen.remoteGenerate) so you can wire in any image or 3D generation backend without touching the UI." },
  ];

  global.UnityGUIData = { ASSET_TYPES, STYLE_PRESETS, PROMPT_IDEAS, PRICING, FAQ, ICONS: I };
})(typeof window !== "undefined" ? window : this);
