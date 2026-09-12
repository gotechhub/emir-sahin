import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report=JSON.parse(fs.readFileSync(path.join(root,'verification/original-videos.json')));
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'site/projects.js'),'utf8'),context);
const files=context.window.projects.flatMap(project=>project.files);
assert.equal(files.length,49);
assert.equal(report.count,49);
assert.equal(fs.readdirSync(path.join(root,'site/videos')).length,49);
for(const record of report.videos){
  const bytes=fs.readFileSync(path.join(root,'site/videos',record.file));
  assert.equal(bytes.length,record.bytes);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,record.file);
  assert(files.includes(record.file),`Unmapped original: ${record.file}`);
}
for(const project of context.window.projects){assert(fs.existsSync(path.join(root,'site/assets',project.cover)),project.cover)}
assert(fs.existsSync(path.join(root,'site/media-store.js')),'Media store missing');
const adminHtml=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
assert(/id="cover-file"[^>]*type="file"/.test(adminHtml),'Cover import input missing');
assert(/id="video-files"[^>]*multiple/.test(adminHtml),'Multiple video import input missing');
assert(fs.readFileSync(path.join(root,'admin/admin.js'),'utf8').includes('mediaStore.put'),'Admin media persistence missing');
for(const directory of ['site','dist']){
  const html=fs.readFileSync(path.join(root,directory,'index.html'),'utf8');
  assert(!/admin|Yönetim/.test(html),'Admin must not be in the public page');
  assert(!fs.existsSync(path.join(root,directory,'admin.html')));
  assert(!fs.existsSync(path.join(root,directory,'admin.js')));
}
vm.runInNewContext(fs.readFileSync(path.join(root,'dist/media-map.js'),'utf8'),context);
for(const record of report.videos){
  const entry=context.window.originalMedia[record.file];
  const bytes=entry?Buffer.concat(entry.chunks.map(f=>fs.readFileSync(path.join(root,'dist',f)))):fs.readFileSync(path.join(root,'dist/videos',record.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,`Published bytes differ: ${record.file}`);
}
for(const key of ['media32.mov','media34.mov','media37.mov']) {
  if(context.window.originalMedia[key]) assert.equal(context.window.originalMedia[key].type,'video/quicktime',key);
}
console.log(`PASS: ${context.window.projects.length} projects, 49 source and 49 published originals verified, ${report.bytes} unchanged bytes, public admin excluded.`);
