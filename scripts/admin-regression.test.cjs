const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const crypto=require('node:crypto');
const cloudSource=fs.readFileSync('admin/cloud.js','utf8');
const adminSource=fs.readFileSync('admin/admin.js','utf8').replace(/renderAll\(\);\s*boot\(\);\s*$/,'');
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
const reply=(status,data)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(data)});
function client(fetcher,expired=false){
  const ctx=vm.createContext({fetch:fetcher,AbortSignal,Date});vm.runInContext(cloudSource,ctx);
  const store=storage();store.setItem('emirSupabaseSession.v2',JSON.stringify({url:'https://example.test',access_token:'test-access',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+(expired?-1:3600)}));
  return ctx.PortfolioCloud.createClient({url:'https://example.test',publishableKey:'test-key'},{fetch:fetcher,storage:store});
}
test('network loss after commit is recovered by reading the saved payload',async()=>{
  const payload={site:{},projects:[]};let writes=0;
  const c=client(async(url,init)=>{if(init.method==='PATCH'){writes++;throw Error('offline')}return reply(200,[{payload,updated_at:'new'}])});
  assert.equal((await c.save(payload,'old')).updated_at,'new');assert.equal(writes,1);
});
test('concurrent editor changes are never overwritten',async()=>{
  const c=client(async(url,init)=>reply(200,init.method==='PATCH'?[]:[{payload:{site:{title:'other editor'},projects:[]},updated_at:'new'}]));
  await assert.rejects(c.save({site:{},projects:[]},'old'),e=>e.code==='conflict');
});
test('expired sessions refresh once for concurrent reads',async()=>{
  let refreshes=0;const c=client(async(url)=>{
    if(url.includes('refresh_token')){refreshes++;await new Promise(r=>setTimeout(r,5));return reply(200,{access_token:'new',refresh_token:'r',expires_in:3600})}
    return reply(200,[]);
  },true);
  await Promise.all([c.read(),c.read()]);assert.equal(refreshes,1);
});
test('invalid API config does not erase a valid session or trigger a refresh',async()=>{
  let calls=0;const c=client(async()=>{calls++;return reply(401,{message:'Invalid API key'})});
  await assert.rejects(c.read(),e=>e.code==='config');assert.equal(calls,1);assert.equal(c.hasSession(),true);
});
test('interrupted response body is a retryable network failure',async()=>{
  const c=client(async()=>({status:200,ok:true,text:async()=>{throw Error('disconnected')}}));
  await assert.rejects(c.read(),e=>e.code==='network');
});
function adminHarness(){
  const nodes=new Map();let closes=0,puts=0;const removed=[];
  const node=key=>{if(!nodes.has(key))nodes.set(key,{hidden:false,value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},replaceChildren(){},append(){},remove(){},setAttribute(){},querySelector:s=>node(s),querySelectorAll:()=>[],close(){closes++},elements:{}});return nodes.get(key)};
  const cloud={save:async payload=>({payload,updated_at:'r2'}),read:async()=>null,hasSession:()=>false};
  const mediaStore={isRef:v=>typeof v==='string'&&v.startsWith('upload:'),put:async()=>String(++puts),get:async ref=>({id:ref.slice(7),blob:{},name:'test.jpg'}),remove:async ref=>removed.push(ref)};
  cloud.upload=async entry=>'https://example.test/'+entry.id+'.jpg';
  const ctx=vm.createContext({console,crypto,URL,Blob,AbortSignal,setTimeout:()=>1,clearTimeout(){},navigator:{onLine:false},document:{querySelector:node,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},window:{projects:[],mediaStore,localStorage:storage(),addEventListener(){},__SUPABASE_CONFIG__:{url:'https://example.test',publishableKey:'test'}}});
  vm.runInContext(cloudSource,ctx);ctx.PortfolioCloud=ctx.window.PortfolioCloud;ctx.PortfolioCloud.createClient=()=>cloud;
  vm.runInContext(adminSource,ctx);
  vm.runInContext("initialized=true;revision='r1';state={site:{},projects:[],albums:[]};renderAll=()=>{};renderVideoList=()=>{};renderCoverPreview=()=>{};",ctx);
  return {ctx,cloud,node,removed,get closes(){return closes},get puts(){return puts},run:s=>vm.runInContext(s,ctx)};
}
test('edits made during a save are serialized and both reach the server',async()=>{
  const h=adminHarness();let release;const requests=[];
  h.cloud.save=async(payload,revision)=>{requests.push({payload,revision});if(requests.length===1)await new Promise(r=>release=r);return {updated_at:'r'+(requests.length+1)}};
  const first=h.run("state.site.title='first';persist()");
  while(!release)await new Promise(r=>setImmediate(r));
  const second=h.run("state.site.title='second';persist()");release();
  assert.equal(await first,true);assert.equal(await second,true);
  assert.equal(requests.length,2);assert.equal(requests[0].payload.site.title,'first');assert.equal(requests[1].payload.site.title,'second');assert.equal(requests[1].revision,'r2');assert.equal(h.run('dirty'),false);
});
test('failed project publish retains the dialog and media; retry creates no duplicates',async()=>{
  const h=adminHarness();const form=h.node('#project-form');
  for(const [key,value] of Object.entries({id:'',cover:'',brand:'Test',title:'Test project',role:'Camera',files:'',featured:false}))form.elements[key]={value,checked:false};
  h.ctx.testForm=form;h.run('pendingCoverFile={name:"test.jpg"};');
  h.cloud.save=async()=>{throw new h.ctx.PortfolioCloud.CloudError('Offline','network')};
  await h.run('saveProject(testForm)');
  assert.equal(h.closes,0);assert.equal(h.puts,1);assert.equal(h.removed.length,0);assert.equal(h.run('dirty'),true);
  const draft=JSON.parse(h.ctx.window.localStorage.getItem('emirPortfolioDraft.v2'));assert.equal(draft.state.projects.length,1);
  h.cloud.save=async()=>({updated_at:'r2'});await h.run('saveProject(testForm)');
  assert.equal(h.closes,1);assert.equal(h.puts,1);assert.equal(h.run('state.projects.length'),1);assert.equal(h.run('dirty'),false);
});
test('conflict keeps the local draft without issuing a write',async()=>{
  const h=adminHarness();h.cloud.save=async()=>{assert.fail('must not write')};
  assert.equal(await h.run("conflict=true;state.site.title='draft';persist()"),false);
  assert.equal(h.run('dirty'),true);assert.equal(JSON.parse(h.ctx.window.localStorage.getItem('emirPortfolioDraft.v2')).state.site.title,'draft');
});
test('failed album publish keeps imported photos and retries the same album',async()=>{
  const h=adminHarness();
  h.ctx.document.createElement=()=>h.node('#album-dialog');h.ctx.document.body.append=()=>{};
  const form=h.node('#album-form');form.elements.title={value:'Test album'};form.elements.description={value:'Test'};
  vm.runInContext(fs.readFileSync('admin/albums.js','utf8'),h.ctx);
  h.run('renderAlbums=()=>{};renderAlbumPhotos=()=>{};albumDraft={id:"album-test",title:"Test",cover:"blob:test",photos:[{src:"blob:test",alt:"Photo",file:{name:"photo.jpg"}}]};');
  h.cloud.save=async()=>{throw new h.ctx.PortfolioCloud.CloudError('Offline','network')};
  await form.onsubmit({preventDefault(){},currentTarget:form});
  assert.equal(h.closes,0);assert.equal(h.puts,1);assert.equal(h.removed.length,0);assert.equal(h.run('state.albums.length'),1);
  assert.equal(h.run('albumDraft.photos[0].file'),undefined);
  h.cloud.save=async()=>({updated_at:'r2'});await form.onsubmit({preventDefault(){},currentTarget:form});
  assert.equal(h.closes,1);assert.equal(h.puts,1);assert.equal(h.run('state.albums.length'),1);assert.equal(h.run('dirty'),false);
});
test('canonical and robots use the primary www domain',()=>{
  const render=require('../site/render.js');assert.equal(render.ORIGIN,'https://www.emrsahin.com');
  assert.match(fs.readFileSync('site/robots.txt','utf8'),/Sitemap: https:\/\/www\.emrsahin\.com\/sitemap.xml/);
});
