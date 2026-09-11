// Offline regression tests. No real Supabase records, uploads or camera access.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = name => name in mocks ? mocks[name] : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}
const shared = load('lib/moments.ts');
const images = load('lib/moments-image.ts', { './moments': shared });
const ids = Array.from({length:8}, (_,i) => `${i+1}`.repeat(8)+'-'+`${i+1}`.repeat(4)+'-4'+`${i+1}`.repeat(3)+'-8'+`${i+1}`.repeat(3)+'-'+`${i+1}`.repeat(12));
const viewer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const jpeg = (w,h) => new Uint8Array([255,216,255,192,0,8,8,h>>8,h&255,w>>8,w&255,1,255,217]);
const json = async response => (await response.json()).data;
function fixture() {
  const state = { now: Date.now(), rows: new Map(), views: new Set(), downloads: [], failDownload: false, afterDownload: null };
  const key = (id,v) => `${id}:${v}`;
  function add(id, offset = 0, captured = true) {
    const created = new Date(state.now - 60000 + offset).toISOString();
    state.rows.set(id,{id,status:'published',created_at:created,captured_at:captured?created:null,expires_at:new Date(state.now+86400000).toISOString(),image_path:`moments/${id}/original.jpg`,preview_path:`moments/${id}/preview.jpg`,created_by_ref:'owner'});
  }
  const active = v => [...state.rows.values()].filter(m=>m.status==='published'&&Date.parse(m.expires_at)>state.now&&!state.views.has(key(m.id,v))).sort((a,b)=>Date.parse(a.captured_at??a.created_at)-Date.parse(b.captured_at??b.created_at)||a.id.localeCompare(b.id));
  const store = { rpc(name,args) {
    if(name==='mark_moment_viewed') {
      const row = state.rows.get(args.p_moment_id), k=key(args.p_moment_id,args.p_viewer_id);
      if(row?.status==='published'&&Date.parse(row.expires_at)>state.now) state.views.add(k);
      return Promise.resolve({data:state.views.has(k),error:null});
    }
    assert.equal(name,'list_unviewed_moments');
    let match=null,single=false;
    const query={eq(_name,id){match=id;return query},maybeSingle(){single=true;return query},then(resolve,reject){
      try {let rows=active(args.p_viewer_id);if(args.p_limit!==null)rows=rows.slice(0,args.p_limit);if(match)rows=rows.filter(m=>m.id===match);resolve({data:single?rows[0]??null:rows,error:null})}catch(err){reject(err)}
    }};return query;
  }, storage: { from(bucket) {
    assert.equal(bucket, 'moments');
    return { async download(key) {
      state.downloads.push(key);
      if (state.failDownload) return { data: null, error: new Error('offline') };
      state.afterDownload?.();
      return { data: new Blob([jpeg(1200,1600)], { type: 'image/jpeg' }), error: null };
    } };
  } } };
  const server = load('lib/moments-server.ts', {'server-only':{},'@supabase/supabase-js':{createClient:()=>store},'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'@/lib/auth':{getOwnerSession:async()=>null,getEditorSession:async()=>null}});
  const tracking = load('lib/moment-viewer-server.ts', {'server-only':{},'./moments':shared,'./moments-server':server});
  const mocks={'@/lib/moments':shared,'@/lib/moments-image':images,'@/lib/moments-server':server,'@/lib/moment-viewer-server':tracking};
  const feed=load('app/api/moments/route.ts',mocks).GET,queue=load('app/api/moments/queue/route.ts',mocks).GET;
  const original=load('app/api/moments/[id]/original/route.ts',mocks).GET,view=load('app/api/moments/[id]/view/route.ts',mocks).POST;
  function request(v=viewer,method='GET',origin) {return new Request('http://localhost/api/moments',{method,headers:{...(v?{'x-moment-viewer-id':v}:{}),...(origin?{origin}:{})}})}
  return {state,add,server,request,feed:(v)=>feed(request(v)),queue:(v)=>queue(request(v)),original:(id,v)=>original(request(v),{params:{id}}),view:(id,v,origin)=>view(request(v,'POST',origin),{params:{id}})};
}

test('new browser gets active unviewed previews only, capped at 3; queue is oldest-first with captured_at fallback',async()=>{
  const f=fixture();f.add(ids[2],2000);f.add(ids[0],0,false);f.add(ids[1],1000);f.add(ids[3],3000);
  const feed=await json(await f.feed());assert.deepEqual(feed.items.map(m=>m.id),ids.slice(0,3));
  assert.doesNotMatch(JSON.stringify(feed),/original|image_path|preview_path|created_by|signed/);
  const queue=await json(await f.queue());assert.deepEqual(queue.items.map(m=>m.id),ids.slice(0,4));assert.equal(f.state.downloads.length,0);assert.equal(f.state.views.size,0);
});
test('only display acknowledgement consumes: download alone does not; close/reopen and reload start at M2',async()=>{
  const f=fixture();ids.slice(0,3).forEach((id,i)=>f.add(id,i));
  const response=await f.original(ids[0]);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(f.state.views.size,0);
  assert.equal((await json(await f.queue())).items.length,3);
  assert.equal((await f.view(ids[0])).status,200);assert.equal(f.state.views.size,1);
  for(let i=0;i<3;i++){assert.deepEqual((await json(await f.queue())).items.map(m=>m.id),ids.slice(1,3));assert.equal((await f.original(ids[0])).status,404)}
});
test('all consumed becomes viewer-specific empty, and a new upload makes only the new Moment available',async()=>{
  const f=fixture();ids.slice(0,3).forEach((id,i)=>f.add(id,i));
  for(const id of ids.slice(0,3))await f.view(id);
  assert.deepEqual((await json(await f.feed())).items,[]);assert.equal((await json(await f.feed(other))).items.length,3);
  f.add(ids[3],3000);assert.deepEqual((await json(await f.queue())).items.map(m=>m.id),[ids[3]]);
});
test('new uploads never mutate a snapshot queue or its progress length',async()=>{
  const f=fixture();ids.slice(0,3).forEach((id,i)=>f.add(id,i));const snapshot=await json(await f.queue());
  f.add(ids[3],3000);assert.deepEqual(snapshot.items.map(m=>m.id),ids.slice(0,3));assert.equal(snapshot.items.length,3);
  for(const id of ids.slice(0,3))await f.view(id);
  assert.deepEqual((await json(await f.queue())).items.map(m=>m.id),[ids[3]]);
});
test('deleted and expired originals are denied, including expiry/delete during storage download',async()=>{
  for(const mutate of [f=>f.state.rows.delete(ids[0]),f=>{f.state.rows.get(ids[0]).expires_at=new Date(f.state.now).toISOString()}]){
    const f=fixture();f.add(ids[0]);const queue=await json(await f.queue());mutate(f);assert.equal(queue.items.length,1);assert.equal((await f.original(ids[0])).status,404);assert.equal(f.state.views.size,0);
    const slow=fixture();slow.add(ids[0]);slow.state.afterDownload=()=>mutate(slow);assert.equal((await slow.original(ids[0])).status,404);assert.equal(slow.state.views.size,0);
  }
});
test('a parallel tab acknowledgement blocks an in-flight original after download',async()=>{
  const f=fixture();f.add(ids[0]);f.state.afterDownload=()=>f.state.views.add(`${ids[0]}:${viewer}`);assert.equal((await f.original(ids[0])).status,404);
});
test('network failure before display leaves Moment unviewed and retryable',async()=>{
  const f=fixture();f.add(ids[0]);f.state.failDownload=true;assert.equal((await f.original(ids[0])).status,503);assert.equal(f.state.views.size,0);assert.equal((await json(await f.queue())).items.length,1);
  f.state.failDownload=false;assert.equal((await f.original(ids[0])).status,200);assert.equal(f.state.views.size,0);
});
test('view acknowledgements are idempotent, malformed IDs and cross-site writes are rejected',async()=>{
  const f=fixture();f.add(ids[0]);await Promise.all(Array.from({length:5},()=>f.view(ids[0])));assert.equal(f.state.views.size,1);
  assert.equal((await f.feed('bad')).status,400);assert.equal((await f.feed(null)).status,400);assert.equal((await f.original('bad')).status,404);
  assert.equal((await f.view(ids[0],viewer,'https://evil.example')).status,403);
});
test('migration is additive, unique/FK/index protected, service-role only and database-time filtered',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase-migration-moments-views.sql'),'utf8');
  assert.match(sql,/PRIMARY KEY \(moment_id, viewer_id\)/);assert.match(sql,/REFERENCES public.moments\(id\) ON DELETE CASCADE/);assert.match(sql,/ON public.moment_views \(viewer_id, moment_id\)/);assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public.moment_views FROM PUBLIC, anon, authenticated/);assert.match(sql,/REVOKE ALL ON FUNCTION public.mark_moment_viewed\(UUID, UUID\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/expires_at > now\(\)/);assert.match(sql,/COALESCE\(m.captured_at, m.created_at\) ASC/);assert.doesNotMatch(sql,/ALTER TABLE public.moments|UPDATE public.moments|storage.buckets/);
});
test('preview now has a 144px short edge, keeps native aspect and still accepts legacy previews',async()=>{
  for(const [w,h]of[[1200,1600],[1600,1200],[1000,1000]]){
    const size=shared.momentPreviewSize(w,h);assert.equal(Math.min(size.width,size.height),144);assert.ok(Math.max(size.width,size.height)<=384);
    const data=await images.validateMomentImages(new Blob([jpeg(w,h)],{type:'image/jpeg'}),new Blob([jpeg(size.width,size.height)],{type:'image/jpeg'}));assert.equal(data.width,w);
  }
  assert.deepEqual(shared.momentPreviewSize(1920,200),{width:384,height:40});
  await images.validateMomentImages(new Blob([jpeg(1200,1600)],{type:'image/jpeg'}),new Blob([jpeg(12,16)],{type:'image/jpeg'}));
});

function clientFixture() {
  const values=new Map(),previousWindow=global.window,previousFetch=global.fetch;
  global.window={localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},crypto:webcrypto};
  const client=load('lib/moment-viewer-client.ts',{'./moments':shared});
  return{client,values,restore(){global.window=previousWindow;global.fetch=previousFetch}};
}
test('anonymous identity is a persistent secure UUID; fallback uses cryptographic random bytes, not fingerprinting',()=>{
  const f=clientFixture();try{const first=f.client.getMomentViewerId();assert.ok(shared.isMomentId(first));assert.equal(f.client.getMomentViewerId(),first);
    const reloaded=load('lib/moment-viewer-client.ts',{'./moments':shared});assert.equal(reloaded.getMomentViewerId(),first);
    f.values.clear();global.window.crypto={getRandomValues:array=>webcrypto.getRandomValues(array)};const fallback=reloaded.getMomentViewerId();assert.ok(shared.isMomentId(fallback));assert.notEqual(fallback,first);
  }finally{f.restore()}
});
test('display immediately persists outbox; keepalive acknowledgement survives close/reload and retries safely',async()=>{
  const f=clientFixture();try{
    let requests=0;global.fetch=async(_url,options)=>{requests++;assert.equal(options.keepalive,true);assert.equal(options.headers['x-moment-viewer-id'],viewer);throw new Error('offline')};
    const pending=f.client.acknowledgeMomentView(viewer,ids[0]);assert.deepEqual(f.client.pendingMomentViews(viewer),[ids[0]]);await pending;
    assert.deepEqual(f.client.pendingMomentViews(viewer),[ids[0]]);
    const reloaded=load('lib/moment-viewer-client.ts',{'./moments':shared});global.fetch=async()=>{requests++;return Response.json({success:true,data:{recorded:true}})};
    await reloaded.flushMomentViews(viewer);assert.deepEqual(reloaded.pendingMomentViews(viewer),[]);assert.equal(requests,2);
  }finally{f.restore()}
});
test('viewer source keeps immutable queue, forward-only navigation, decode-before-display acknowledgement and accessible controls',()=>{
  const source=fs.readFileSync(path.join(root,'components/moments/MomentViewer.tsx'),'utf8');
  assert.match(source,/useState\(\(\) => \[\.\.\.snapshot.items\]\)/);assert.match(source,/position.current(?:\+\+| \+= 1)/);assert.doesNotMatch(source,/position.current--|setIndex\(index -|history\.|setInterval/);
  assert.ok(source.indexOf('await decoded.decode()')<source.indexOf('acknowledgeMomentView(viewerId, id)'));
  assert.match(source,/onLoad=\{recordDisplayed\}/);assert.match(source,/document.hidden/);assert.match(source,/response.status === 404 \|\| response.status === 410/);
  assert.match(source,/role="dialog" aria-modal="true"/);assert.match(source,/event.key === ["']Escape["']/);assert.match(source,/event.key !== ["']Tab["']/);assert.match(source,/URL.revokeObjectURL/);assert.match(source,/overflow-hidden/);
});

test('resting deck keeps real upcoming cards visible, caps at three, and never fills short queues with duplicates',()=>{
  const {getMomentDeck}=load('components/moments/moment-deck.ts');
  const now=Date.now();
  const queue=Object.freeze(ids.slice(0,4).map(id=>Object.freeze({id,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString()})));
  assert.deepEqual(getMomentDeck(queue,0,undefined,now).map(m=>m.id),ids.slice(0,3));
  assert.deepEqual(getMomentDeck(queue,1,undefined,now).map(m=>m.id),ids.slice(1,4));
  assert.deepEqual(getMomentDeck(queue,2,undefined,now).map(m=>m.id),ids.slice(2,4));
  assert.deepEqual(getMomentDeck(queue,3,undefined,now).map(m=>m.id),[ids[3]]);
  assert.deepEqual(getMomentDeck([],0,undefined,now),[]);
  assert.deepEqual(queue.map(m=>m.id),ids.slice(0,4));
});

test('deck keeps the outgoing card only during exchange and removes expired rear cards',()=>{
  const {getMomentDeck}=load('components/moments/moment-deck.ts');
  const now=Date.now();
  const queue=ids.slice(0,4).map((id,i)=>({id,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+(i===2?1000:60000)).toISOString()}));
  assert.deepEqual(getMomentDeck(queue,1,0,now).map(m=>m.id),ids.slice(0,3));
  assert.deepEqual(getMomentDeck(queue,1,undefined,now+1000).map(m=>m.id),[ids[1],ids[3]]);
  assert.deepEqual(getMomentDeck(queue,1,0,now+60000),[]);
});

test('rear cards render obscured preview URLs only, without original fetches or display acknowledgement',()=>{
  const time=load('lib/moment-time.ts');
  const Frame=load('components/moments/MomentCardFrame.tsx',{'@/lib/moment-time':time});
  const Preview=load('components/moments/MomentStackPreview.tsx',{'./MomentCardFrame':Frame}).default;
  const React=require('react');
  const {renderToStaticMarkup}=require('react-dom/server');
  const markup=renderToStaticMarkup(React.createElement(Preview,{item:{id:ids[0],createdAt:'2026-08-30T00:00:00Z',expiresAt:'2026-08-31T00:00:00Z'}}));
  assert.match(markup,new RegExp(`/api/moments/${ids[0]}/preview`));
  assert.match(markup,/aria-hidden="true"/);
  assert.match(markup,/blur-\[4px\]/);
  assert.doesNotMatch(markup,/\/original|Momen kelas/);
});
