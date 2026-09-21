import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { loadEnv } from 'vite';

// Memetakan /api/x/y ke <apiDir>/x/y.js. Mengembalikan null untuk path yang tidak boleh dilayani
// (traversal, atau file/folder privat berawalan underscore seperti _lib).
export function resolveApiFile(urlPath, apiDir) {
  const rest = urlPath.split('?')[0].replace(/^\/api\//, '');
  if (!rest || rest.includes('..')) return null;

  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.startsWith('_'))) return null;

  const file = path.join(apiDir, ...parts) + '.js';
  return file.startsWith(apiDir + path.sep) ? file : null;
}

const readJsonBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        resolve({});
      }
    });
  });

// Melayani folder api/ (Vercel Functions) saat `npm run dev`, supaya fitur seperti
// "Buat Admin Baru" bisa dicoba lokal tanpa `vercel dev`. Hanya aktif di dev server.
export default function localApi() {
  let apiDir;

  return {
    name: 'local-api',
    apply: 'serve',
    configResolved(config) {
      apiDir = path.resolve(config.root, 'api');
      // Handler membaca process.env (seperti di Vercel), jadi muat semua isi .env / .env.local.
      const env = loadEnv(config.mode, config.root, '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        const file = resolveApiFile(req.url, apiDir);
        if (!file || !fs.existsSync(file)) {
          res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
          return;
        }

        try {
          req.body = await readJsonBody(req);
          const mod = await server.ssrLoadModule(file);
          await mod.default(req, res);
        } catch (err) {
          console.error('[local-api]', err);
          res.status(500).json({ error: 'Kesalahan server lokal: ' + err.message });
        }
      });
    },
  };
}
