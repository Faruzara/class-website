// Run the existing carousel handlers with a deterministic clock and animated DOM geometry.
// No browser, database, or extra test dependencies required.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../components/home/HomepageData.tsx'), 'utf8');
const start = source.indexOf('function carouselTransitionEasing(');
const end = source.indexOf('function EmptyState(');
const transitionMatch = source.match(/const CAROUSEL_TRANSITION_MS = (\d+);/);
const transitionMs = Number(transitionMatch?.[1] ?? 280);
const code = ts.transpileModule(`const CAROUSEL_TRANSITION_MS = ${transitionMs};\n` + source.slice(start, end).replace('export function CoreMembersCarousel', 'function CoreMembersCarousel') + '\nthis.Carousel = CoreMembersCarousel;', {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness(count = 8, width = 1360) {
  let now = 0, id = 0, active = count >= 4 ? count : 0, animationStart = -1000, handlers;
  const refs = [], effects = [], elements = [], buttons = new Map(), timers = new Map(), rafs = new Map(), classes = new Set(), listeners = new Map();
  const length = count >= 4 ? count * 3 : count;
  const desktop = width >= 768;
  const activeWidth = desktop ? Math.max(260, Math.min(width*.28,340)) : Math.max(170,Math.min(width*.5,220));
  const nearWidth = desktop ? Math.max(156,Math.min(width*.16,194)) : Math.max(100,Math.min(width*.28,128));
  const farWidth = desktop ? Math.max(118,Math.min(width*.12,146)) : Math.max(78,Math.min(width*.21,98));
  const padding = width * (desktop ? .38 : .28), viewportWidth = desktop ? Math.min(width-64,1216) : width;
  const values = index => Array.from({length}, (_,i) => ({w:i===index?activeWidth:Math.abs(i-index)===1?nearWidth:farWidth,x:-Math.sign(i-index)*Math.min(Math.abs(i-index),3)*4}));
  let from = values(active), to = values(active);
  const valueAt = i => {
    const progress = Math.min((now-animationStart)/transitionMs,1);
    const eased = context.carouselTransitionEasing(progress);
    return {w:from[i].w+(to[i].w-from[i].w)*eased,x:from[i].x+(to[i].x-from[i].x)*eased};
  };
  let scrollLeft = 0;
  const viewport = {
    clientWidth: viewportWidth,
    get scrollWidth(){return padding*2+Array.from({length},(_,i)=>valueAt(i).w).reduce((a,b)=>a+b,0);},
    get scrollLeft(){return scrollLeft;},
    set scrollLeft(value){scrollLeft=Math.max(0,Math.min(value,this.scrollWidth-this.clientWidth));},
    getBoundingClientRect:()=>({left:0,width:viewportWidth}),
    classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
    setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){},style:{},
  };
  const nodes = Array.from({length},(_,i)=>({getBoundingClientRect(){
    let left=padding-scrollLeft;
    for(let n=0;n<i;n++)left+=valueAt(n).w;
    const v=valueAt(i);return {left:left+v.x,width:v.w};
  }}));
  const timer = (fn,ms,interval=false)=>{const key=++id;timers.set(key,{fn,time:now+ms,ms,interval});return key;};
  const jsx = (type, props)=>{if(props?.onPointerDown) handlers=props;if(type==='button')buttons.set(props['aria-label'],props);const element={type,props};elements.push(element);return element;};
  const context = vm.createContext({
    exports:{},require:name=>name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:{},
    Image:'img',User:'icon',ChevronLeft:'chevron-left',ChevronRight:'chevron-right',performance:{now:()=>now},
    useMemo:fn=>fn(),useRef:value=>{const ref={current:value};refs.push(ref);return ref;},
    useState:value=>[value,index=>{if(index===active)return;from=nodes.map((_,i)=>valueAt(i));active=index;to=values(index);animationStart=classes.has('is-repositioning')?now-transitionMs:now;if(classes.has('is-repositioning'))from=to;}],
    useEffect:fn=>effects.push(fn),flushSync:fn=>fn(),
    window:{innerWidth:width,
      requestAnimationFrame:fn=>{const key=++id;rafs.set(key,fn);return key;},cancelAnimationFrame:key=>rafs.delete(key),
      setInterval:(fn,ms)=>timer(fn,ms,true),clearInterval:key=>timers.delete(key),
      setTimeout:(fn,ms)=>timer(fn,ms),clearTimeout:key=>timers.delete(key),
      addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),
    },
  });
  vm.runInContext(code,context);
  context.Carousel({items:Array.from({length:count},(_,i)=>({role:'Role '+i,member:{id:String(i),nama:'Member '+i}}))});
  refs[0].current=viewport;refs[1].current=nodes;
  let cleanup=effects[0]();
  function advance(ms){const end=now+ms;while(now<end){now=Math.min(end,now+1000/60);for(const [key,t] of [...timers])if(t.time<=now){if(t.interval)t.time+=t.ms;else timers.delete(key);t.fn();}const pending=[...rafs];rafs.clear();for(const [,fn] of pending)fn(now);}}
  const event=(x,options={})=>({clientX:x,pointerId:1,pointerType:'mouse',button:0,isPrimary:true,preventDefault(){},...options});
  return {advance,down:(x,opts)=>handlers.onPointerDown(event(x,opts)),move:(x,opts)=>handlers.onPointerMove(event(x,opts)),up:(x,opts)=>handlers.onPointerUp(event(x,opts)),cancel:x=>handlers.onPointerCancel(event(x)),
    previous:()=>buttons.get('Foto struktur sebelumnya').onClick(),next:()=>buttons.get('Foto struktur berikutnya').onClick(),
    indicators:(active,total,previousStart=0)=>Array.from(context.getCarouselIndicators(active,total,previousStart),dot=>({...dot})),
    indicatorWindow:(active,total,previousStart)=>context.getCarouselIndicatorWindowStart(active,total,previousStart),elements,buttons,
    replay:()=>{cleanup();cleanup=effects[0]();},cleanup:()=>cleanup(),
    get active(){return active;},get logical(){return active%count;},get centerOffset(){const r=nodes[active].getBoundingClientRect();return r.left+r.width/2-viewport.clientWidth/2;},
    get frames(){return rafs.size;},get timers(){return timers.size;},get intervals(){return [...timers.values()].filter(t=>t.interval).length;},get dragging(){return classes.has('is-dragging');},
  };
}

test('mount and StrictMode replay keep Ketua stable with one auto timer',()=>{
  const c=harness();c.advance(100);c.replay();c.advance(6500);
  assert.equal(c.logical,0);assert.equal(c.intervals,1);assert.ok(Math.abs(c.centerOffset)<.01);
  c.advance(800);assert.equal(c.logical,1);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();
});

test('indicator window keeps forward/reverse positions monotonic without recentering',()=>{
  const c=harness();
  for(const count of [1,2,3,4,5,6,8,20])for(let index=0;index<count;index++){
    const dots=c.indicators(index,count);
    assert.equal(dots.length,Math.min(count,5));
    assert.equal(dots.filter(dot=>dot.active).length,1);
    assert.equal(dots.findIndex(dot=>dot.active),Math.min(index,4));
    assert.equal(dots.find(dot=>dot.active).faded,false);
  }
  let windowStart=0;
  const position=index=>{
    windowStart=c.indicatorWindow(index,6,windowStart);
    return c.indicators(index,6,windowStart).findIndex(dot=>dot.active)+1;
  };
  assert.deepEqual([0,1,2,3,4,5].map(position),[1,2,3,4,5,5]);
  assert.deepEqual([5,4,3,2,1,0].map(position),[5,4,3,2,1,1]);
  assert.deepEqual(c.indicators(0,0),[]);c.cleanup();
});

test('only inactive overflow edges fade, keeping the active brand dot fully visible',()=>{
  const c=harness();
  const faded=index=>c.indicators(index,6).map(dot=>dot.faded);
  assert.deepEqual(faded(0),[false,false,false,false,true]);
  assert.deepEqual(faded(3),[false,false,false,false,true]);
  assert.deepEqual(faded(4),[false,false,false,false,false]);
  assert.deepEqual(faded(5),[true,false,false,false,false]);
  // Returning from item 6 keeps window 2..6 until item 1 crosses its left edge.
  const reverseFaded=index=>c.indicators(index,6,1).map(dot=>dot.faded);
  assert.deepEqual(reverseFaded(4),[true,false,false,false,false]);
  assert.deepEqual(reverseFaded(1),[false,false,false,false,false]);
  assert.deepEqual(reverseFaded(0),[false,false,false,false,true]);
  for(const total of [1,2,3,4,5])for(let index=0;index<total;index++){
    assert.ok(c.indicators(index,total).every(dot=>!dot.faded));
  }
  c.cleanup();
});

test('pagination remembers the window through reversals and slides it symmetrically at both edges',()=>{
  const c=harness();
  for(const total of [1,2,3,4,5,6,8,20]){
    let windowStart=0;
    for(let index=0;index<total;index++){
      windowStart=c.indicatorWindow(index,total,windowStart);
      assert.equal(c.indicators(index,total,windowStart).findIndex(dot=>dot.active),Math.min(index,4));
    }
    for(let index=total-1;index>=0;index--){
      windowStart=c.indicatorWindow(index,total,windowStart);
      assert.equal(c.indicators(index,total,windowStart).findIndex(dot=>dot.active),Math.max(0,index-Math.max(0,total-5)));
    }
  }
  let windowStart=0;
  const path=[0,1,2,3,4,5,4,3,4,3,2,1,0,1];
  const positions=path.map(index=>{
    windowStart=c.indicatorWindow(index,6,windowStart);
    return c.indicators(index,6,windowStart).findIndex(dot=>dot.active)+1;
  });
  assert.deepEqual(positions,[1,2,3,4,5,5,4,3,4,3,2,1,1,2]);
  assert.equal(c.indicatorWindow(0,0,10),0);
  assert.equal(c.indicatorWindow(1,3,15),0);c.cleanup();
});

test('infinite clone rebasing yields identical pagination before and after normalization',()=>{
  const c=harness(6);c.advance(700);
  for(let index=0;index<6;index++)for(const copy of [-1,0,1,2])for(const windowStart of [0,1]){
    assert.equal(c.indicatorWindow(index+copy*6,6,windowStart),c.indicatorWindow(index,6,windowStart));
    assert.deepEqual(c.indicators(index+copy*6,6,windowStart),c.indicators(index,6,windowStart));
  }
  c.previous();assert.equal(c.active,5);
  const beforeRebase=c.indicators(c.active,6);c.advance(700);assert.equal(c.active,11);
  assert.deepEqual(c.indicators(c.active,6),beforeRebase);
  c.next();assert.equal(c.active,12);
  const afterWrap=c.indicators(c.active,6);c.advance(700);assert.equal(c.active,6);
  assert.deepEqual(c.indicators(c.active,6),afterWrap);
  assert.equal(afterWrap.findIndex(dot=>dot.active),0);c.cleanup();
});

test('dot DOM identity follows fixed visual positions rather than moving photo IDs',()=>{
  const pagination=source.slice(source.indexOf('{indicators.map'),source.indexOf('</div>',source.indexOf('{indicators.map')));
  assert.match(pagination,/key=\{position\}/);
  assert.match(pagination,/transition-\[background-color,opacity\] duration-200/);
  assert.doesNotMatch(pagination,/member\.id|activeIndex/);
});

test('navigation renders capped round dots, real-item counter and plain gray arrow buttons',()=>{
  for(const count of [1,3,6,8]){
    const c=harness(count);
    const dots=c.elements.filter(el=>el.type==='span'&&el.props.className?.includes('rounded-full'));
    assert.equal(dots.length,Math.min(count,5));
    const counter=c.elements.find(el=>el.props?.['aria-label']===`Foto 1 dari ${count}`);
    assert.equal(counter.props.children.join(''),`1/${count}`);
    assert.match(counter.props.className,/text-neutral-400/);
    for(const button of c.buttons.values()){
      assert.equal(button.type,'button');assert.match(button.className,/text-neutral-400/);
      assert.doesNotMatch(button.className,/(?:^|\s)(?:bg-|border(?:-|\s)|shadow)/);
    }
    assert.equal(c.buttons.get('Foto struktur sebelumnya').disabled,count<4);
    assert.equal(c.buttons.get('Foto struktur berikutnya').disabled,count<2);c.cleanup();
  }
});

test('arrows share smooth motion, ignore mount/rapid clicks and wrap both directions',()=>{
  for(const width of [320,414,1360]){
    const c=harness(6,width);c.next();assert.equal(c.logical,0);c.advance(700);
    c.next();assert.equal(c.logical,1);c.next();c.previous();assert.equal(c.logical,1);
    assert.equal(c.frames,1);c.advance(700);assert.ok(Math.abs(c.centerOffset)<.01);
    for(let index=2;index<=6;index++){c.next();c.advance(700);assert.equal(c.logical,index%6);assert.ok(Math.abs(c.centerOffset)<.01);}
    c.previous();c.advance(700);assert.equal(c.logical,5);assert.ok(Math.abs(c.centerOffset)<.01);
    c.next();c.advance(700);assert.equal(c.logical,0);c.cleanup();
  }
});

test('arrows clamp short lists, pause auto slide, and never compete with drag',()=>{
  for(const count of [1,2,3]){
    const c=harness(count);c.advance(700);c.previous();assert.equal(c.logical,0);
    for(let i=0;i<4;i++){c.next();c.advance(700);assert.equal(c.logical,Math.min(i+1,count-1));}
    for(let i=0;i<4;i++){c.previous();c.advance(700);assert.equal(c.logical,Math.max(count-2-i,0));}c.cleanup();
  }
  const c=harness();c.advance(700);c.next();assert.equal(c.intervals,0);
  c.advance(7900);assert.equal(c.logical,1);assert.equal(c.intervals,0);
  c.advance(200);assert.equal(c.intervals,1);c.advance(6700);assert.equal(c.logical,2);
  c.down(400);c.next();c.previous();assert.equal(c.logical,2);c.up(400);c.advance(700);
  c.cleanup();assert.equal(c.frames,0);assert.equal(c.timers,0);
});

for(const width of [320,414,768,1360]) {
  test(`${width}px: equal thresholds, short drag returns, long drag commits only once`,()=>{
    const c=harness(8,width);c.advance(700);
    for(const delta of [-20,20]) {c.down(200);c.move(200+delta);c.advance(17);c.up(200+delta);c.advance(700);assert.equal(c.logical,0);assert.ok(Math.abs(c.centerOffset)<.01);}
    c.down(900);c.move(0);c.advance(800);assert.equal(c.logical,1);c.up(0);c.advance(700);assert.ok(Math.abs(c.centerOffset)<.01);
    c.down(0);c.move(900);c.advance(800);assert.equal(c.logical,0);c.up(900);c.advance(700);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();
  });
}

test('continuous held drag advances in order after each expansion, in both infinite directions',()=>{
  const c=harness(4);c.advance(700);let x=1000;c.down(x);
  for(let i=1;i<=12;i++){x-=120;c.move(x);c.advance(transitionMs+40);assert.equal(c.logical,i%4);assert.ok(c.active>=4&&c.active<8);}
  for(let i=1;i<=12;i++){x+=120;c.move(x);c.advance(transitionMs+40);assert.equal(c.logical,(4-i%4)%4);assert.ok(c.active>=4&&c.active<8);}
  c.up(x);c.advance(700);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();
});

test('rapid movements advance once per pointer event without moving on their own',()=>{
  const c=harness();c.advance(700);c.down(1000);c.move(880);c.advance(17);assert.equal(c.logical,1);
  c.advance(transitionMs);assert.equal(c.logical,1);
  for(let i=0;i<3;i++){c.move(760-i*100);c.advance(17);assert.equal(c.logical,i+2);assert.ok(c.frames<=1);}
  c.up(560);c.advance(700);assert.equal(c.logical,4);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();
});

test('holding the pointer pauses auto slide, release restarts only one timer after inactivity',()=>{
  const c=harness();c.advance(700);c.down(500);c.advance(16000);assert.equal(c.logical,0);assert.equal(c.intervals,0);
  c.up(500);c.advance(7900);assert.equal(c.intervals,0);c.advance(200);assert.equal(c.intervals,1);
  c.advance(6700);assert.equal(c.logical,1);c.cleanup();assert.equal(c.frames,0);assert.equal(c.timers,0);
});

test('one/two/three-member carousels clamp at edges without infinite duplicates or drift',()=>{
  for(const count of [1,2,3]){const c=harness(count);c.advance(700);c.down(0);c.move(900);c.advance(700);c.up(900);c.advance(700);assert.equal(c.logical,0);assert.ok(Math.abs(c.centerOffset)<.01);
    c.down(1000);for(let i=1;i<=5;i++){c.move(1000-i*120);c.advance(720);}c.up(400);c.advance(700);assert.equal(c.active,count-1);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();}
});

test('other pointers do not interrupt the captured gesture; cancel settles cleanly',()=>{
  const c=harness();c.advance(700);c.down(300);c.move(0,{pointerId:2});c.up(0,{pointerId:2});c.advance(100);assert.equal(c.logical,0);assert.equal(c.dragging,true);
  c.move(280);c.advance(17);c.cancel(280);c.advance(700);assert.equal(c.dragging,false);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();
});

test('touch gesture and a fresh drag during settling preserve the active card and center',()=>{
  const c=harness(8,414);c.advance(700);
  c.down(350,{pointerType:'touch'});c.move(250,{pointerType:'touch'});c.advance(100);assert.equal(c.logical,1);
  c.move(220,{pointerType:'touch'});c.up(220,{pointerType:'touch'});
  // A second press may arrive before the pending release frame has painted.
  c.down(200,{pointerType:'touch'});c.advance(700);c.up(200,{pointerType:'touch'});c.advance(700);
  assert.equal(c.logical,2);assert.ok(Math.abs(c.centerOffset)<.01);c.cleanup();
});

test('dragging during auto expansion settles without double increment or a second timer',()=>{
  const c=harness();c.advance(6800);assert.equal(c.logical,1);
  c.down(500);c.move(480);c.advance(17);c.up(480);c.advance(700);
  assert.equal(c.logical,1);assert.ok(Math.abs(c.centerOffset)<.01);assert.equal(c.intervals,0);c.cleanup();
});

test('unmount cancels animation, interval and pending resume callbacks',()=>{
  const c=harness();c.advance(700);c.down(400);c.move(0);c.advance(17);c.up(0);c.cleanup();assert.equal(c.frames,0);assert.equal(c.timers,0);
});

test('native scroll snap and the competing drag alignment loop are removed',()=>{
  const carousel=source.slice(start,end);
  assert.doesNotMatch(carousel,/snap-mandatory|snap-center|keepDraggedCardInView|dragAlignmentFrameRef|getFinalScrollTarget/);
  assert.match(carousel,new RegExp(`duration-\\[${transitionMs}ms\\]`));
  assert.match(carousel,/h-\[clamp\(240px,64vw,350px\)\]/);
});

test('reference strip keeps portrait height and narrower side panels at every breakpoint',()=>{
  for(const width of [320,375,414,540,767,768,1024,1360,1920]){
    const desktop=width>=768;
    const height=desktop?Math.max(275,Math.min(width*.35,450)):Math.max(240,Math.min(width*.64,350));
    const shear=desktop?Math.max(88,Math.min(width*.112,144)):Math.max(76.8,Math.min(width*.2048,112));
    const active=desktop?Math.max(260,Math.min(width*.28,340)):Math.max(170,Math.min(width*.5,220));
    const near=desktop?Math.max(156,Math.min(width*.16,194)):Math.max(100,Math.min(width*.28,128));
    const far=desktop?Math.max(118,Math.min(width*.12,146)):Math.max(78,Math.min(width*.21,98));
    assert.ok(Math.abs(shear/height-.32)<.00001);
    assert.ok(height>active && active>near && near>far);
    const stablePhotoWidth=(active+shear+2)*1.08;
    for(const card of [active,near,far])assert.ok(stablePhotoWidth>=card+shear);
    const imageSize=width<=374?290:width<=767?365:width<=1023?440:525;
    assert.ok(imageSize>=stablePhotoWidth, 'responsive source must cover the visible photo canvas');
  }
});

test('only frame outline is sheared; photo canvas does not resize with active state',()=>{
  const css=fs.readFileSync(path.resolve(__dirname,'../app/globals.css'),'utf8');
  const inner=/\.core-member-frame-inner\s*\{([^}]+)\}/.exec(css)[1];
  assert.match(inner,/width: calc\(var\(--core-active-width\) \+ var\(--core-frame-shear\) \+ 2px\)/);
  assert.match(inner,/translate3d\(-50%, -50%, 0\) scale\(1\.08\)/);
  assert.doesNotMatch(inner,/skew|rotate|matrix|transition/);
  assert.match(css,/\.core-member-frame::after\s*\{[^}]+border: 1px solid[^}]+matrix\(1, 0, -0\.32, 1, 0, 0\)/);
  assert.match(source,/className="object-cover object-center"/);
});
