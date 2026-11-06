import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    const file = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'}); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port,'127.0.0.1', () => console.log(`Local: http://localhost:${port}`));
