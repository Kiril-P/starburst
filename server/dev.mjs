// Local API for development: the same handler as the Worker, on node:sqlite. `npm run server:dev` -> http://localhost:8787
// then `VITE_API_URL=http://localhost:8787 npm run dev` points the game at it. Data lives in tmp/server-dev.sqlite.
import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { handle } from './src/handler.js';
import { openDb } from './src/d1shim.js';

const port = Number(process.env.PORT) || 8787;
mkdirSync('tmp', { recursive: true });
const env = { DB: openDb(process.env.DB_FILE || 'tmp/server-dev.sqlite'), ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'dev' };

http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await handle(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`starburst api (dev) on http://localhost:${port}  admin token: ${env.ADMIN_TOKEN}`));
