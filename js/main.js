/* =========================================================================
   UnityGUI — Landing page behaviour
   ========================================================================= */
(function () {
  "use strict";
  const D = window.UnityGUIData;
  const Gen = window.UnityGUIGen;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---- Sticky nav shadow + mobile toggle ------------------------------ */
  const nav = $(".nav");
  const onScroll = () => nav && nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = $(".nav-toggle");
  if (toggle) toggle.addEventListener("click", () => $(".nav-links").classList.toggle("open"));
  $$(".nav-links a").forEach(a => a.addEventListener("click", () => $(".nav-links").classList.remove("open")));

  /* ---- Reveal on scroll ----------------------------------------------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  $$(".reveal").forEach(el => io.observe(el));

  /* ---- Hero: typing prompt demo --------------------------------------- */
  const pdText = $("#pd-text");
  if (pdText && D) {
    const ideas = D.PROMPT_IDEAS;
    let i = 0, j = 0, deleting = false;
    const tick = () => {
      const word = ideas[i % ideas.length];
      j += deleting ? -1 : 1;
      pdText.innerHTML = word.slice(0, j).replace(/</g, "&lt;") + '<span class="cursor"></span>';
      let delay = deleting ? 26 : 46;
      if (!deleting && j === word.length) { delay = 1700; deleting = true; }
      else if (deleting && j === 0) { deleting = false; i++; delay = 350; }
      setTimeout(tick, delay);
    };
    tick();
  }

  /* ---- Hero preview thumbs -------------------------------------------- */
  const strip = $("#hero-strip");
  if (strip && Gen) {
    const picks = [
      ["ui", "Sci-fi HUD neon blue", "HUD"],
      ["character", "Fantasy knight hero", "Player"],
      ["icon", "Fire spell ability icon", "Pickup"],
      ["thumbnail", "EPIC QUEST banner", "Title screen"],
      ["model3d", "Low-poly treasure chest", "Level prop"],
    ];
    Promise.all(picks.map(([t, p], k) => Gen.generateOne(t, p, { seed: 100 + k * 13 })))
      .then(results => {
        strip.innerHTML = results.map((res, k) =>
          `<div class="hero-thumb reveal">${res.svg}<span class="ht-label">${picks[k][2]}</span></div>`).join("");
        $$(".hero-thumb", strip).forEach((el, k) => setTimeout(() => el.classList.add("in"), 120 * k));
      });
  }

  /* ---- Asset types grid ----------------------------------------------- */
  const grid = $("#asset-grid");
  if (grid && D) {
    grid.innerHTML = D.GENRES.map(a => `
      <a class="asset-card reveal" href="studio.html">
        <span class="badge ac-tag">${a.short}</span>
        <span class="ac-icon" style="color:var(--violet-2)">${a.icon}</span>
        <h3>${a.name}</h3>
        <p>${a.desc}</p>
      </a>`).join("");
    $$(".asset-card", grid).forEach(el => io.observe(el));
  }

  /* ---- Showcase gallery ------------------------------------------------ */
  const showcase = $("#showcase-grid");
  if (showcase && Gen) {
    const items = [
      ["ui", "Pause menu", "Twin-stick shooter"],
      ["icon", "Ability pickup", "Platformer"],
      ["character", "Player avatar", "Top-down arcade"],
      ["sprite", "Slime enemy", "Runner"],
      ["thumbnail", "SPACE RAIDERS", "Title screen"],
      ["texture", "Dungeon floor", "Maze"],
      ["model3d", "Level crate", "Platformer"],
      ["skybox", "Sky backdrop", "First-person maze"],
      ["icon", "Health pickup", "Brick breaker"],
      ["ui", "Start screen", "Arcade"],
      ["character", "Companion bot", "Shooter"],
      ["sprite", "Coin pickup", "Runner"],
    ];
    Promise.all(items.map(([t, p], k) => Gen.generateOne(t, p, { seed: 40 + k * 17 })))
      .then(results => {
        showcase.innerHTML = results.map((res, k) =>
          `<div class="sc-item">${res.svg}<div class="sc-meta">${items[k][1]} · ${items[k][2]}</div></div>`).join("");
      });
  }

  /* ---- Pricing --------------------------------------------------------- */
  const pricing = $("#pricing-grid");
  if (pricing && D) {
    pricing.innerHTML = D.PRICING.map(p => `
      <div class="price-card card reveal ${p.featured ? "featured" : ""}">
        ${p.featured ? '<span class="pc-badge">Most popular</span>' : ""}
        <h3>${p.name}</h3>
        <div class="pc-price">${p.price} <small>${p.cadence}</small></div>
        <p class="pc-desc">${p.desc}</p>
        <ul class="pc-feats">
          ${p.feats.map(f => `<li><span class="chk">✦</span> ${f}</li>`).join("")}
        </ul>
        <a class="btn ${p.featured ? "btn-primary" : "btn-ghost"}" href="studio.html">${p.cta}</a>
      </div>`).join("");
    $$(".price-card", pricing).forEach(el => io.observe(el));
  }

  /* ---- FAQ ------------------------------------------------------------- */
  const faq = $("#faq");
  if (faq && D) {
    faq.innerHTML = D.FAQ.map(f => `
      <details>
        <summary>${f.q}<span class="chev">▾</span></summary>
        <p>${f.a}</p>
      </details>`).join("");
  }

  /* ---- Year in footer -------------------------------------------------- */
  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();
})();
