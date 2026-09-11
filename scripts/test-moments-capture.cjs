// Offline regression suite: mocked camera/storage/roles. Never writes to Supabase.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
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
const momentTime = load('lib/moment-time.ts');
const image = load('lib/moments-image.ts', { './moments': shared });
const camera = load('lib/moment-camera.ts', { './moments': shared });
const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-08-30T12:00:00Z');
const jpeg = (w, h) => new Uint8Array([255,216,255,192,0,8,8,h>>8,h&255,w>>8,w&255,1,255,217]);
const blob = (w, h) => new Blob([jpeg(w,h)], { type: 'image/jpeg' });
const frame = () => image.validateMomentImages(blob(1200,1600), blob(12,16));
const session = role => ({ role, label: role, slot_id: role === 'admin' ? 1 : null, temp_key_id: role === 'temp_admin' ? 'temp' : null, expires_at: null });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };

function fixture(role = 'owner') {
  const state = { rows: new Map(), files: new Map(), uploads: [], removals: [], role, failUpload: false, failRemove: false, failDelete: false, failPublish: false, lostPublish: false, revoke: false };
  function builder(rpc = false, manage = false) {
    let action = 'select', payload, filters = [], max = Infinity, single = false;
    const chain = {
      select() { return chain; }, insert(value) { action='insert';payload=value;return chain; },
      update(value) { action='update';payload=value;return chain; }, delete() { action='delete';return chain; },
      eq(key,value) { filters.push([key,value]);return chain; }, limit(value) { max=value;return chain; },
      maybeSingle() { single=true;return chain; },
      async then(resolve,reject) {
        try {
          if (action === 'insert') {
            if (state.rows.has(payload.id)) return resolve({data:null,error:{code:'23505'}});
            state.rows.set(payload.id,{...payload,status:'pending',created_at:new Date(now).toISOString(),expires_at:new Date(now+86400000).toISOString()});
            return resolve({data:null,error:null});
          }
          let rows = [...state.rows.values()].filter(row => filters.every(([key,value])=>row[key]===value));
          if (rpc) rows = rows.filter(row => row.status==='published' && Date.parse(row.expires_at)>now || manage && (['failed','deleting'].includes(row.status) || row.status==='pending' && Date.parse(row.created_at)<now-120000));
          rows = rows.slice(0,max);
          if (action === 'update') {
            if (payload.status==='published' && state.failPublish) return resolve({data:null,error:{message:'publish failed'}});
            rows.forEach(row=>Object.assign(row,payload));
            if (payload.status==='published' && state.lostPublish) return resolve({data:null,error:{message:'response lost'}});
          }
          if (action === 'delete') {
            if (state.failDelete) return resolve({data:null,error:{message:'delete failed'}});
            rows.forEach(row=>state.rows.delete(row.id));
          }
          resolve({data:single ? rows[0]??null : rows,error:null});
        } catch(error) { reject(error); }
      },
    }; return chain;
  }
  const store = { from:()=>builder(), rpc:(_name,args)=>builder(true,args.p_manage), storage:{from:()=>({
    async upload(key,data) { state.uploads.push(key); if (state.failUpload && key.endsWith('preview.jpg')) return {error:{message:'upload failed'}};state.files.set(key,data);return {error:null}; },
    async remove(keys) { state.removals.push(keys);if(state.failRemove)return {error:{message:'storage down'}};keys.forEach(key=>state.files.delete(key));return {error:null}; },
    async download(key) { return {data: state.files.has(key)?new Blob([state.files.get(key)],{type:'image/jpeg'}):null,error:null}; },
  })} };
  const server = load('lib/moments-server.ts', { 'server-only':{}, '@supabase/supabase-js':{createClient:()=>store}, 'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}}, '@/lib/auth':{
    getOwnerSession:async()=>state.role==='owner'&&!state.revoke?session('owner'):null,
    getEditorSession:async()=>state.role&&!state.revoke?session(state.role):null,
  } });
  const publish = load('lib/moments-publish.ts', {'server-only':{},'./moments-server':server,'./moments-image':image});
  const form = load('lib/moments-form.ts', {'server-only':{},'./moments':shared,'./moments-server':server});
  const viewerServer = load('lib/moment-viewer-server.ts', {'server-only':{},'./moments':shared,'./moments-server':server});
  const mocks = {'@/lib/moments':shared,'@/lib/moment-time':momentTime,'@/lib/moments-image':image,'@/lib/moments-publish':publish,'@/lib/moments-server':server,'@/lib/moments-form':form,'@/lib/moment-viewer-server':viewerServer,'@/lib/auth':{logActivity:async()=>{}}};
  return {state,server,publish,
    upload:load('app/api/admin/moments/route.ts',mocks).POST,
    remove:load('app/api/owner/moments/[id]/route.ts',mocks).DELETE,
    manage:load('app/api/owner/moments/route.ts',mocks).GET,
    publicList:()=>load('app/api/moments/route.ts',mocks).GET(new Request('http://localhost/api/moments',{headers:{'x-moment-viewer-id':ID}})),
    preview:load('app/api/moments/[id]/preview/route.ts',mocks).GET,
  };
}
function request(id=ID, fields={}) {
  const form=new FormData();form.set('id',id);form.set('image',fields.image??blob(1200,1600),'moment.jpg');form.set('preview',fields.preview??blob(12,16),'preview.jpg');
  form.set('role','owner'); // Ignored: authenticated session, never client fields.
  if (fields.capturedAt !== undefined) form.set('captured_at', fields.capturedAt);
  return new Request('http://localhost/api/admin/moments',{method:'POST',body:form,headers:fields.headers});
}
const deletion=()=>new Request('http://localhost/api/owner/moments/'+ID,{method:'DELETE'});

test('JPEG validation reads dimensions/orientation, limits bytes and rejects bad MIME/headers/preview',async()=>{
  assert.equal((await frame()).orientation,'portrait');
  for(const [original,preview] of [[blob(1930,1600),blob(16,13)],[blob(1200,1600),blob(120,160)],[blob(1200,1600),blob(16,12)],[new Blob(['bad'],{type:'image/jpeg'}),blob(12,16)],[new Blob([jpeg(1200,1600)],{type:'text/html'}),blob(12,16)],[new Blob([new Uint8Array(shared.MOMENT_MAX_BYTES+1)],{type:'image/jpeg'}),blob(12,16)]]) await assert.rejects(()=>image.validateMomentImages(original,preview));
  assert.equal(shared.momentOrientation(100,100),'square');assert.equal(shared.momentOrientation(200,100),'landscape');
});
for(const role of ['owner','admin','temp_admin']) test(`${role} can capture/publish; client role is ignored`,async()=>{
  const f=fixture(role),response=await f.upload(request()); assert.equal(response.status,200); assert.equal(f.state.rows.size,1);assert.equal(f.state.rows.get(ID).status,'published');assert.equal(f.state.rows.get(ID).created_by_role,role);assert.equal(f.state.uploads.length,2);
});
for(const role of [null,'admin','temp_admin']) test(`${role??'anonymous'} cannot DELETE or list Owner management`,async()=>{
  const f=fixture(role);assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,403);assert.equal((await f.manage()).status,403);assert.equal(f.state.removals.length,0);
});
test('anonymous/revoked session cannot upload; bad UUID, oversized body and cross-site writes are rejected',async()=>{
  const f=fixture(null);assert.equal((await f.upload(request())).status,401);
  f.state.role='temp_admin';f.state.revoke=true;assert.equal((await f.upload(request())).status,401);
  f.state.revoke=false;assert.equal((await f.upload(request('bad'))).status,400);
  assert.equal((await f.upload(request(ID,{headers:{origin:'https://evil.example'}}))).status,403);
  const huge=new Request('http://localhost/api/admin/moments',{method:'POST',headers:{'content-length':'99999999'},body:'x'});assert.equal((await f.upload(huge)).status,413);
  assert.equal(f.state.rows.size,0);
});
test('parallel duplicate UUID publishes exactly one Moment and never upserts photos',async()=>{
  const f=fixture(),data=await frame();const results=await Promise.allSettled([f.publish.publishMoment(ID,data,session('owner')),f.publish.publishMoment(ID,data,session('owner'))]);
  assert.ok(results.some(result=>result.status==='fulfilled'));assert.equal(f.state.rows.size,1);assert.equal(f.state.uploads.length,2);
  assert.deepEqual(await f.publish.publishMoment(ID,data,session('owner')),{id:ID});assert.equal(f.state.uploads.length,2);
});
test('upload failure stays unpublished, cleans storage, and retains a traceable cleanup record',async()=>{
  const f=fixture();f.state.failUpload=true;assert.equal((await f.upload(request())).status,500);assert.equal(f.state.rows.get(ID).status,'failed');assert.equal(f.state.files.size,0);
  assert.equal((await f.server.listMoments()).length,0);assert.equal((await f.server.listMoments(true)).length,1);
});
test('failed cleanup never makes an upload public and remains retryable by Owner',async()=>{
  const f=fixture();f.state.failUpload=true;f.state.failRemove=true;await f.upload(request());assert.equal(f.state.rows.get(ID).status,'failed');assert.equal(f.state.files.size,1);
  f.state.failRemove=false;assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,200);assert.equal(f.state.files.size,0);assert.equal(f.state.rows.size,0);
});
test('failed DB publication cleans uploaded files; lost publication response preserves committed photos',async()=>{
  const failed=fixture();failed.state.failPublish=true;await failed.upload(request());assert.equal(failed.state.files.size,0);assert.equal(failed.state.rows.get(ID).status,'failed');
  const lost=fixture();lost.state.lostPublish=true;assert.equal((await lost.upload(request())).status,200);assert.equal(lost.state.rows.get(ID).status,'published');assert.equal(lost.state.files.size,2);assert.equal(lost.state.removals.length,0);
});
test('Owner deletion hides immediately, reports partial failure honestly and can retry',async()=>{
  const f=fixture();await f.upload(request());f.state.failRemove=true;
  assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,500);assert.equal((await f.server.listMoments()).length,0);assert.equal(f.state.rows.get(ID).status,'deleting');
  f.state.failRemove=false;f.state.failDelete=true;assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,500);assert.equal(f.state.files.size,0);assert.equal(f.state.rows.size,1);
  f.state.failDelete=false;assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,200);assert.equal(f.state.rows.size,0);assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,200);
});
test('recent pending upload cannot be deleted while files are being sent',async()=>{
  const f=fixture();f.state.rows.set(ID,{id:ID,status:'pending',created_at:new Date(now).toISOString()});assert.equal((await f.remove(deletion(),{params:{id:ID}})).status,409);assert.equal(f.state.removals.length,0);
});
test('public DTO exposes only tiny preview, max 3; expired/deleted records and originals are never served',async()=>{
  const f=fixture();await f.upload(request());await f.upload(request(ID2));f.state.rows.get(ID2).expires_at=new Date(now).toISOString();
  const response=await f.publicList();const body=await response.json();assert.equal(body.data.items.length,1);assert.doesNotMatch(JSON.stringify(body),/original|image_path|preview_path|created_by|signed/);
  const preview=await f.preview(null,{params:{id:ID}});assert.equal(preview.status,200);assert.equal(preview.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(image.jpegDimensions(new Uint8Array(await preview.arrayBuffer())).height,16);
  assert.equal((await f.preview(null,{params:{id:ID2}})).status,404);
  f.state.files.set(`moments/${ID}/preview.jpg`,jpeg(1000,1000));assert.equal((await f.preview(null,{params:{id:ID}})).status,500);
});
test('SQL lifetime is database-controlled, RLS/private bucket enabled and RPC not public',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase-migration-moments.sql'),'utf8');assert.match(sql,/expires_at > now\(\)/);assert.match(sql,/NEW.expires_at := NEW.created_at \+ INTERVAL '24 hours'/);assert.match(sql,/NEW.status = 'published' AND OLD.status = 'pending'/);assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/REVOKE ALL ON FUNCTION public.list_moments\(BOOLEAN\) FROM PUBLIC, anon, authenticated/);assert.match(sql,/'moments', 'moments', FALSE/);assert.match(sql,/AS RESTRICTIVE\s+FOR ALL TO anon, authenticated/);assert.match(sql,/USING \(bucket_id <> 'moments'\) WITH CHECK \(bucket_id <> 'moments'\)/);assert.doesNotMatch(sql,/web-kelas',/);
});
test('empty/non-JSON/4xx/5xx responses cannot crash frontend JSON handling',async()=>{
  for(const response of [new Response(''),new Response('<html>error</html>',{status:502}),Response.json({success:false,error:'denied'},{status:403}),Response.json(null)]) await assert.rejects(()=>shared.readMomentResponse(response));
  assert.deepEqual(await shared.readMomentResponse(Response.json({success:true,data:{id:ID}})),{id:ID});
});
function fakeStream() {let stops=0;return {getTracks:()=>[{stop:()=>stops++}],get stops(){return stops}};}
test('late camera open after close is stopped and StrictMode replay keeps only newest stream',async()=>{
  const c=new camera.MomentCamera(),a=deferred(),b=deferred(),first=fakeStream(),second=fakeStream();
  const initial=c.open({getUserMedia:()=>a.promise});c.stop();const replay=c.open({getUserMedia:()=>b.promise});
  a.resolve(first);assert.equal(await initial,null);assert.equal(first.stops,1);b.resolve(second);assert.equal(await replay,second);c.stop();assert.equal(second.stops,1);
});
test('switch stops old tracks first, uses exact device and never requests audio',async()=>{
  const c=new camera.MomentCamera(),first=fakeStream(),second=fakeStream();let constraints;
  await c.open({getUserMedia:async options=>{constraints=options;return first}});assert.equal(constraints.audio,false);assert.equal(constraints.video.facingMode.ideal,'environment');
  await c.open({getUserMedia:async options=>{assert.equal(first.stops,1);constraints=options;return second}},'front-id');assert.equal(constraints.video.deviceId.exact,'front-id');c.stop();assert.equal(second.stops,1);
});
test('camera denied/missing/busy errors are actionable with no file fallback',()=>{
  assert.match(camera.cameraErrorMessage({name:'NotAllowedError'}),/Izin kamera/);assert.match(camera.cameraErrorMessage({name:'NotFoundError'}),/tidak ditemukan/);assert.match(camera.cameraErrorMessage({name:'NotReadableError'}),/sedang digunakan/);assert.match(camera.cameraErrorMessage(null),/HTTPS/);
  const source=fs.readFileSync(path.join(root,'components/admin/MomentCameraDialog.tsx'),'utf8');assert.doesNotMatch(source,/<input|type="file"|Retake|onDrop|requestAnimationFrame|setInterval/);
});
test('capture draws one unmirrored full frame, caps long edge, derives tiny preview from same frame',async()=>{
  const previous=global.document,canvases=[],draws=[];
  global.document={createElement:()=>{const c={width:0,height:0,getContext:()=>({drawImage:(...args)=>draws.push(args)}),toBlob:fn=>fn(blob(c.width,c.height))};canvases.push(c);return c}};
  try {const video={videoWidth:4000,videoHeight:3000,readyState:4};const data=await camera.captureMoment(video);assert.equal(draws.length,2);assert.equal(draws[0][0],video);assert.deepEqual(draws[0].slice(1),[0,0,1920,1440]);assert.equal(draws[1][0],canvases[0]);assert.deepEqual(image.jpegDimensions(new Uint8Array(await data.preview.arrayBuffer())),{width:192,height:144});}
  finally {global.document=previous;}
});

// Minimal hook harness exercises the real shutter handler without a real camera,
// auth bypass, browser grants or an external test framework.
function dialogFixture({fail=false}={}) {
  let hooks=[],cursor=0,effects=[],nodes=[],requests=0,published=0,closed=0,sentTime;
  const encode=deferred();
  const react={useRef:value=>{const i=cursor++;return hooks[i]??(hooks[i]={current:value})},useState:value=>{const i=cursor++;if(!(i in hooks))hooks[i]=value;return[hooks[i],next=>{hooks[i]=typeof next==='function'?next(hooks[i]):next}]},useId:()=> 'moment',useEffect:fn=>{cursor++;if(!effects.started)effects.push(fn)},useLayoutEffect:()=>{cursor++}};
  const jsx=(type,props)=>{const n={type,props};nodes.push(n);return n};
  const C=load('components/admin/MomentCameraDialog.tsx',{'react':react,'react-dom':{createPortal:value=>value},'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':{Check:'check',Loader2:'loader',RefreshCw:'refresh',SwitchCamera:'switch',X:'x'},'@/lib/moment-camera':{...camera,captureMoment:()=>encode.promise},'@/lib/moments':shared,'@/lib/moment-time':momentTime}).default;
  const render=()=>{nodes=[];cursor=0;C({onClose:()=>closed++,onPublished:()=>published++});return nodes};
  const old={document:global.document,window:global.window,navigator:Object.getOwnPropertyDescriptor(global,'navigator'),fetch:global.fetch};
  global.document={activeElement:null,body:{style:{overflow:''}},addEventListener(){},removeEventListener(){}};
  global.window={matchMedia:()=>({matches:true})};
  Object.defineProperty(global,'navigator',{value:{mediaDevices:{getUserMedia:async()=>stream,enumerateDevices:async()=>[]}},configurable:true});
  const track={stop(){},getSettings:()=>({facingMode:'user'}),label:'front'};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  global.fetch=async(_url,options)=>{requests++;sentTime=options.body.get('captured_at');return fail?new Response('bad',{status:500}):Response.json({success:true,data:{id:ID}})};
  global.HTMLElement??=class {};
  render();nodes.find(n=>n.type==='video').props.ref.current={videoWidth:1200,videoHeight:1600,play:async()=>{},srcObject:null};
  const cleanup=effects.map(fn=>fn());effects.started=true;
  return {encode,get requests(){return requests},get published(){return published},get sentTime(){return sentTime},render,
    async ready(){await new Promise(r=>setImmediate(r));nodes.find(n=>n.type==='video').props.onLoadedData();render();return nodes.find(n=>n.props['aria-label']==='Ambil dan kirim Moment').props.onClick;},
    restore(){cleanup.forEach(fn=>fn?.());global.document=old.document;global.window=old.window;global.fetch=old.fetch;if(old.navigator)Object.defineProperty(global,'navigator',old.navigator);else delete global.navigator;},
  };
}
test('double shutter during frame encoding performs one POST and keeps the camera session open',async()=>{
  const f=dialogFixture();try{const click=await f.ready();const a=click(),b=click();f.encode.resolve({image:blob(1200,1600),preview:blob(12,16)});await Promise.all([a,b]);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests,1);assert.equal(f.published,1);assert.ok(Number.isFinite(Date.parse(f.sentTime)));assert.equal(f.render().some(node=>node.type==='video'),true);}finally{f.restore()}
});
test('upload failure stays in composer, shows small error and re-enables shutter with no auto-retry',async()=>{
  const f=dialogFixture({fail:true});try{const click=await f.ready();const pending=click();f.encode.resolve({image:blob(1200,1600),preview:blob(12,16)});await pending;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.requests,1);assert.equal(f.published,0);const nodes=f.render();assert.ok(nodes.some(n=>n.props['aria-label']==='Kirim ulang foto'));assert.equal(nodes.find(n=>n.props['aria-label']==='Ambil dan kirim Moment').props.disabled,false);}finally{f.restore()}
});
test('dashboard action is available to every editor, management controls only for Owner',()=>{
  for(const role of ['owner','admin','temp_admin']) {
    const nodes=[];const jsx=(type,props)=>{const node={type,props};nodes.push(node);return node};
    const component=load('components/admin/MomentDashboardActions.tsx',{
      'react':{useState:value=>[value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}},
      'react/jsx-runtime':{jsx,jsxs:jsx},'lucide-react':{Camera:'camera',Loader2:'loader',Trash2:'trash'},
      './MomentCameraDialog':{default:'dialog'},'@/components/home/useMoments':{useMoments:()=>({items:[],loading:false,error:'',refresh(){}})},'@/lib/moments':shared,'@/lib/moment-time':momentTime,
    }).default;
    component({canManage:role==='owner'});
    assert.ok(nodes.some(node=>node.type==='button'&&Array.isArray(node.props.children)&&node.props.children.includes('Ambil Moment')));
    assert.equal(nodes.some(node=>node.type==='button'&&node.props.children==='Moments Aktif'),role==='owner');
  }
});

test('shutter time survives publish and repeated reads without changing lifetime',async()=>{
  const f=fixture();const capturedAt=new Date(Date.now()-2000).toISOString();
  assert.equal((await f.upload(request(ID,{capturedAt}))).status,200);
  assert.equal(f.state.rows.get(ID).captured_at,capturedAt);
  for(let i=0;i<2;i++) assert.equal((await (await f.publicList()).json()).data.items[0].capturedAt,capturedAt);
  assert.equal(Date.parse(f.state.rows.get(ID).expires_at)-Date.parse(f.state.rows.get(ID).created_at),86400000);
  await f.publish.publishMoment(ID,await frame(),session('owner'),new Date().toISOString());
  assert.equal(f.state.rows.get(ID).captured_at,capturedAt);
});
test('capture timestamp rejects malformed dates, files and stale/future device clocks',async()=>{
  const f=fixture();for(const capturedAt of ['bad','2026-02-30T00:00:00.000Z',new Date(Date.now()+3600000).toISOString(),new Date(Date.now()-86400000).toISOString()]) {
    assert.equal((await f.upload(request(ID,{capturedAt}))).status,400);
  }
  assert.equal(f.state.rows.size,0);
  const clock=Date.parse('2026-08-30T13:33:00.000Z');
  assert.equal(momentTime.parseMomentCaptureTime(new Blob(),clock),null);
  assert.equal(momentTime.parseMomentCaptureTime('2026-08-30T13:33:00.000Z',clock),'2026-08-30T13:33:00.000Z');
  const migration=fs.readFileSync(path.join(root,'supabase-migration-moments-captured-at.sql'),'utf8');
  assert.match(migration,/ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ/);
  assert.doesNotMatch(migration,/UPDATE public.moments|SET expires_at|CREATE.*TRIGGER/);
});
