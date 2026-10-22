import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as enquiry from './functions/api/enquire.js';
import * as events from './functions/api/events.js';
import './build-site.cjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const redirects = (await readFile(path.join(root, '_redirects'), 'utf8')).split('\n').filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/));
const mime = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.woff2': 'font/woff2'};
// This preview runs the real validation/error path. It never mocks mail delivery.
// Email credentials are read from the process environment, never bundled into assets.
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    const redirect = redirects.find(([source]) => source === url.pathname);
    if (redirect) { res.writeHead(Number(redirect[2] || 302), {Location: redirect[1] + url.search}); res.end(); return; }
    const api = {'/api/enquire': enquiry, '/api/events': events}[url.pathname];
    if (api) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 25000) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
      const headers = {...req.headers};
      const request = new Request(url, {method: req.method, headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? {body: Buffer.concat(chunks)} : {})});
      const handler = api[`onRequest${req.method[0]}${req.method.slice(1).toLowerCase()}`];
      const response = handler ? await handler({request, env: process.env}) : new Response('Method not allowed', {status: 405});
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, '.' + (path.extname(pathname) ? pathname : pathname + '.html'));
    if (!file.startsWith(root + path.sep) || !mime[path.extname(file)] || /(?:^|[/\\])(?:functions|tests|dist|node_modules|\.git)(?:[/\\]|$)/.test(pathname) || pathname.includes('..')) throw new Error('Not found');
    const data = await readFile(file);
    res.writeHead(200, {'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store'}); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'}); res.end(req.method === 'HEAD' ? undefined : await readFile(path.join(root, '404.html'))); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}`));
