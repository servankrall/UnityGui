// =============================================================================
//  Free AI image generation — Pollinations (no key, no account, no cost).
//  Returns a URL that responds with a generated PNG/JPEG for the given prompt.
// =============================================================================

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}

// Build the image URL. width/height are clamped to sane sprite/background sizes.
function artUrl(prompt, opts = {}) {
  const w = clampInt(opts.width, 64, 1536, 512);
  const h = clampInt(opts.height, 64, 1536, 512);
  const p = encodeURIComponent(String(prompt || "game art").slice(0, 400));
  const params = new URLSearchParams({ width: String(w), height: String(h), nologo: "true", model: opts.model || "flux" });
  if (opts.seed != null && Number.isFinite(Number(opts.seed))) params.set("seed", String(Math.round(Number(opts.seed))));
  return `https://image.pollinations.ai/prompt/${p}?${params.toString()}`;
}

module.exports = { artUrl, clampInt };
