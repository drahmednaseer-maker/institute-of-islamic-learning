/* Tiny local preview server that mirrors Vercel's cleanUrls behaviour. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const ROOT = join(process.cwd(), 'dist');
const PORT = Number(process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const tryFiles = (p) => [p, p + '.html', join(p, 'index.html')];
createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  for (const cand of tryFiles(base)) {
    try {
      const s = await stat(cand);
      if (!s.isFile()) continue;
      const body = await readFile(cand);
      res.writeHead(200, { 'Content-Type': TYPES[extname(cand)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(body);
    } catch {}
  }
  const nf = await readFile(join(ROOT, '404.html')).catch(() => 'Not found');
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(nf);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
