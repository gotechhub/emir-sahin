// Local preview: site and separate admin share an origin for local draft storage.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const pageHandler=require('../api/page.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain; charset=utf-8','.mov':'video/quicktime','.mp4':'video/mp4','.part':'application/octet-stream'};
http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if(pathname==='/'||/^\/(projeler|albumler)\//.test(pathname)||['/sitemap.xml','/llms.txt'].includes(pathname)){
    const parts=pathname.split('/').filter(Boolean);
    req.query={kind:parts[0]==='projeler'?'project':parts[0]==='albumler'?'album':parts[0]==='sitemap.xml'?'sitemap':parts[0]==='llms.txt'?'llms':'home',id:parts[1]};
    pageHandler(req,res).catch(()=>res.writeHead(500).end('Page unavailable'));return;
  }
  if(pathname==='/admin'){res.writeHead(302,{Location:'/admin/'}).end();return}
  if(pathname==='/runtime-config.js'&&process.env.SUPABASE_URL){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end('window.__SUPABASE_CONFIG__='+JSON.stringify({url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY}));return}
  let relative = pathname.replace(/^\//, '');
  if (!/^(admin|site|dist)\//.test(relative)) relative = 'site/' + relative;
  if (relative.endsWith('/')) relative += 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || /(^|[/\\])\./.test(relative)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end('Not found'); return; }
  const size = fs.statSync(file).size;
  const headers = {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control':'no-cache'};
  let start = 0, end = size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, {'Content-Range':`bytes */${size}`}).end(); return; }
    if (!match[1]) start = Math.max(0, size - Number(match[2]));
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (start > end || start >= size) { res.writeHead(416, {'Content-Range':`bytes */${size}`}).end(); return; }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(req.headers.range ? 206 : 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = fs.createReadStream(file, {start,end});
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}).listen(Number(process.env.PORT||8766), '127.0.0.1', () => console.log('Portfolio preview ready'));
