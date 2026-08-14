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
  if (strip && Gen && D) {
    const picks = [
      ["ui", "Sci-fi HUD neon blue"],
      ["character", "Fantasy knight hero"],
      ["icon", "Fire spell ability icon"],
      ["thumbnail", "EPIC QUEST banner"],
      ["model3d", "Low-poly treasure chest"],
    ];
    Promise.all(picks.map(([t, p], k) => Gen.generateOne(t, p, { seed: 100 + k * 13 })))
      .then(results => {
        strip.innerHTML = results.map((res, k) => {
          const label = D.ASSET_TYPES.find(a => a.id === picks[k][0]).name;
          return `<div class="hero-thumb reveal">${res.svg}<span class="ht-label">${label}</span></div>`;
        }).join("");
        $$(".hero-thumb", strip).forEach((el, k) => setTimeout(() => el.classList.add("in"), 120 * k));
      });
  }

  /* ---- Asset types grid ----------------------------------------------- */
  const grid = $("#asset-grid");
  if (grid && D) {
    grid.innerHTML = D.ASSET_TYPES.map(a => `
      <a class="asset-card reveal" href="studio.html?type=${a.id}">
        <span class="badge ac-tag">${a.short}</span>
        <span class="ac-icon" style="color:var(--violet-2)">${a.icon}</span>
        <h3>${a.name}</h3>
        <p>${a.desc}</p>
      </a>`).join("");
    $$(".asset-card", grid).forEach(el => io.observe(el));
  }

  /* ---- Showcase gallery ------------------------------------------------ */
  const showcase = $("#showcase-grid");
  if (showcase && Gen && D) {
    const items = [
      ["ui", "Cyberpunk pause menu purple glass"],
      ["icon", "Glowing lightning icon"],
      ["character", "Cute mage character"],
      ["sprite", "Green slime enemy"],
      ["thumbnail", "SPACE RAIDERS banner"],
      ["texture", "Seamless stone floor"],
      ["model3d", "Modular sci-fi crate"],
      ["skybox", "Sunset desert sky"],
      ["icon", "Health potion icon"],
      ["ui", "Mobile start screen cartoon"],
      ["character", "Robot companion"],
      ["sprite", "Retro coin pickup"],
    ];
    Promise.all(items.map(([t, p], k) => Gen.generateOne(t, p, { seed: 40 + k * 17 })))
      .then(results => {
        showcase.innerHTML = results.map((res, k) => {
          const label = D.ASSET_TYPES.find(a => a.id === items[k][0]).name;
          return `<div class="sc-item">${res.svg}<div class="sc-meta">“${items[k][1]}” · ${label}</div></div>`;
        }).join("");
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
