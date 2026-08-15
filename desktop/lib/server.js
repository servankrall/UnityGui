// =============================================================================
//  Tiny dependency-free static file server — used to "Play on phone": serve a
//  generated Web game over the LAN so a phone on the same Wi-Fi can open it.
// =============================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".txt": "text/plain; charset=utf-8",
};
function contentType(ext) { return TYPES[String(ext).toLowerCase()] || "application/octet-stream"; }

// First non-internal IPv4 address (the one a phone on the LAN can reach).
function lanIp(ifaces) {
  const nets = ifaces || os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      const fam = typeof ni.family === "string" ? ni.family : (ni.family === 4 ? "IPv4" : "");
      if (fam === "IPv4" && !ni.internal) return ni.address;
    }
  }
  return "127.0.0.1";
}

// Serve `root` over HTTP. Resolves to { server, port, url }.
function startStaticServer(root, opts = {}) {
  const host = opts.host || "0.0.0.0";
  const port = opts.port != null ? opts.port : 0;
  const rootR = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(String(req.url || "/").split("?")[0]);
        if (urlPath.endsWith("/")) urlPath += "index.html";
        const target = path.resolve(path.join(rootR, urlPath));
        if (target !== rootR && !target.startsWith(rootR + path.sep)) { res.writeHead(403); res.end("Forbidden"); return; }
        fs.readFile(target, (err, data) => {
          if (err) { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found"); return; }
          res.writeHead(200, { "content-type": contentType(path.extname(target)), "cache-control": "no-store" });
          res.end(data);
        });
      } catch { res.writeHead(500); res.end("Error"); }
    });
    server.on("error", reject);
    server.listen(port, host, () => {
      const p = server.address().port;
      resolve({ server, port: p, url: `http://${lanIp()}:${p}/` });
    });
  });
}

module.exports = { contentType, lanIp, startStaticServer };
