// QA helpers for generated Web games — pure, so they're unit-testable.
// `img` is an Electron NativeImage-like object: { getSize(), toBitmap() } where
// toBitmap() returns a BGRA byte buffer (4 bytes per pixel).

// Is a captured frame essentially blank / a single flat colour (nothing drawn)?
// Catches "black screen" games that throw no console error.
function isBlankImage(img) {
  try {
    const size = img && img.getSize ? img.getSize() : { width: 0, height: 0 };
    if (!size.width || !size.height) return true;
    const buf = img.toBitmap(); // BGRA, 4 bytes per pixel
    if (!buf || buf.length < 64) return true;
    const b0 = buf[0], g0 = buf[1], r0 = buf[2];
    let diff = 0, n = 0;
    const step = Math.max(1, Math.floor(buf.length / 4 / 3000)) * 4; // sample ~3000 px
    for (let i = 0; i + 2 < buf.length; i += step) {
      diff += Math.abs(buf[i] - b0) + Math.abs(buf[i + 1] - g0) + Math.abs(buf[i + 2] - r0);
      n++;
    }
    return n > 0 && (diff / n) < 2.5; // near-uniform → nothing meaningful is drawn
  } catch { return false; }
}

module.exports = { isBlankImage };
