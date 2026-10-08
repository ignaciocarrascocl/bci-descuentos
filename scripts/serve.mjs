/**
 * Servidor estático mínimo (sin dependencias).
 * Sirve el proyecto tal cual para previsualizarlo cuando esbuild/vite no puede
 * levantar su servicio (p. ej. entornos sin named pipes).
 *
 *   node scripts/serve.mjs [puerto]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || 5273);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = normalize(join(root, decoded));
  if (!target.startsWith(root + sep) && target !== root) return null;
  return target;
}

const PUBLIC_DIR = join(ROOT, 'public');

const server = createServer(async (req, res) => {
  const urlPath = req.url || '/';
  // Igual que Vite: primero el contenido de public/, luego la raíz del proyecto.
  let path = safeJoin(PUBLIC_DIR, urlPath) || safeJoin(ROOT, urlPath);
  if (urlPath === '/' || urlPath === '') path = join(ROOT, 'index.html');
  if (!path) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    let info = await stat(path).catch(() => null);
    if (!info) {
      const alt = safeJoin(ROOT, urlPath);
      if (alt) {
        const altInfo = await stat(alt).catch(() => null);
        if (altInfo) {
          path = alt;
          info = altInfo;
        }
      }
    }
    if (info?.isDirectory()) {
      path = join(path, 'index.html');
      info = await stat(path).catch(() => null);
    }
    if (!info) {
      // Fallback tipo SPA.
      path = join(ROOT, 'index.html');
      info = await stat(path).catch(() => null);
      if (!info) {
        res.writeHead(404).end('Not found');
        return;
      }
    }
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': MIME[extname(path).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(`Error: ${err.message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Preview estático en http://127.0.0.1:${PORT}/`);
});
