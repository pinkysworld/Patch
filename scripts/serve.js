import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.patch':'text/plain', '.md':'text/plain' };
http.createServer((req,res) => {
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, pathname === '/' ? 'web/index.html' : pathname);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (e,data) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}); res.end(data);
    });
  });
}).listen(4173, () => console.log('Patch Play: http://localhost:4173'));
