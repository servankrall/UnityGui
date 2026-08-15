// Project tag ("collection") helpers — pure, so they're unit-testable.

// Normalize a raw tag list: strip junk chars, trim, collapse inner spaces,
// lowercase, cap each tag's length, dedupe, and cap the total count. Keeps the
// UI honest and the on-disk store small.
function sanitizeTags(raw, { maxTags = 8, maxLen = 24 } = {}) {
  const arr = Array.isArray(raw) ? raw : String(raw == null ? "" : raw).split(",");
  const out = [];
  for (const t of arr) {
    const clean = String(t == null ? "" : t)
      .replace(/[^\w \-]+/g, "")   // letters/numbers/underscore, space, dash only
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .slice(0, maxLen);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= maxTags) break;
  }
  return out;
}

module.exports = { sanitizeTags };
