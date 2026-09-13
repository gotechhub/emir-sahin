import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const render=require('../site/render.js');
const defaultContent=require('../site/content.json');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const dist = path.join(root, 'dist');
if (dist !== path.join(root, 'dist')) throw new Error('Unsafe output directory');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
// Keep the admin application on its own unlinked /admin/ route.
// It shares the same origin as the public site so local browser drafts work,
// while the public page itself contains no admin navigation or references.
fs.cpSync(path.join(root, 'admin'), path.join(dist, 'admin'), { recursive: true });
for (const entry of fs.readdirSync(site)) {
  if (entry !== 'videos') fs.cpSync(path.join(site, entry), path.join(dist, entry), { recursive: true });
}
const runtimeConfig = {
  url: process.env.SUPABASE_URL || '',
  publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ''
};
fs.writeFileSync(path.join(dist, 'runtime-config.js'), `window.__SUPABASE_CONFIG__=${JSON.stringify(runtimeConfig)};\n`);
fs.writeFileSync(path.join(dist,'index.html'),render.page(fs.readFileSync(path.join(site,'index.html'),'utf8'),defaultContent));
fs.mkdirSync(path.join(dist, 'videos'), { recursive: true });
fs.mkdirSync(path.join(dist, 'chunks'), { recursive: true });
const report = JSON.parse(fs.readFileSync(path.join(root, 'verification/original-videos.json')));
const map = {};
const chunkSize = 20 * 1024 * 1024;
for (const record of report.videos) {
  const bytes = fs.readFileSync(path.join(site, 'videos', record.file));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== record.sha256) throw new Error(`Original changed: ${record.file}`);
  if (process.argv.includes('--vercel') || bytes.length <= 25 * 1024 * 1024) {
    fs.writeFileSync(path.join(dist, 'videos', record.file), bytes);
    continue;
  }
  // Storage chunks only: no video codec, frame, audio, or byte is altered.
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const name = `chunks/${record.file}.${chunks.length}.part`;
    fs.writeFileSync(path.join(dist, name), bytes.subarray(offset, offset + chunkSize));
    chunks.push(name);
  }
  const reconstructed = Buffer.concat(chunks.map(name => fs.readFileSync(path.join(dist, name))));
  if (!reconstructed.equals(bytes)) throw new Error('Chunk reconstruction changed original bytes');
  map[record.file] = { chunks, bytes: bytes.length, sha256: record.sha256,
    type: /\.mov$/i.test(record.file) ? 'video/quicktime' : 'video/mp4' };
}
fs.writeFileSync(path.join(dist, 'media-map.js'), `window.originalMedia=${JSON.stringify(map)};\n`);
console.log(`v1 ready: ${report.count} byte-identical original videos, ${report.bytes} bytes. ${Object.keys(map).length} large files delivered in lossless storage chunks. Admin available at /admin/ (unlinked).`);
