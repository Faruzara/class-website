const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'components/home/HomepageHero.tsx'), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;
const helper = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'components/home/hero-scroll.ts'), 'utf8')), helper);
const { getHeroStoryFrame: visual } = helper.exports;

function harness(reduced = false) {
  let scroll = 0, stickyHeight = 1000, id = 0;
  const effects = [], nodes = [], rafs = new Map(), listeners = new Map();
  const media = { matches: reduced, addEventListener: (_, fn) => { media.change = fn; }, removeEventListener: () => { media.change = null; } };
  const jsx = (type, props) => {
    const node = { type, props, style: {}, getBoundingClientRect: () => ({ top: stickyHeight - scroll }),
      get offsetHeight() { return stickyHeight; } };
    if (props.ref) props.ref.current = node;
    nodes.push(node);
    return node;
  };
  const window = {
    innerHeight: 1000, matchMedia: () => media,
    requestAnimationFrame: fn => { rafs.set(++id, fn); return id; },
    cancelAnimationFrame: id => rafs.delete(id),
    addEventListener: (name, fn, options) => listeners.set(name, { fn, options }),
    removeEventListener: name => listeners.delete(name),
  };
  const context = { exports: {}, window, require: name => {
    if (name === 'react') return { useRef: current => ({ current }), useEffect: fn => effects.push(fn) };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (name === './hero-scroll') return helper.exports;
    if (name === 'next/image') return { default: 'image' };
    if (name === './RevealOnScroll') return { default: 'reveal' };
    throw new Error(name);
  } };
  vm.runInNewContext(compile(source), context);
  context.exports.default({ fallbackHero: '/custom.jpg', fallbackAbout: 'Existing about from database', objectFit: 'contain', objectPosition: '35% 70%' });
  const cleanups = effects.map(fn => fn());
  const find = token => nodes.find(node => node.props.className?.includes(token));
  return {
    nodes, rafs, listeners, media,
    backdrop: find('hero-story-backdrop'), about: find('hero-story-about'), copy: find('hero-story-copy'),
    fog: find('hero-fog-photo'), title: find('absolute inset-0 z-20'), overlay: find('z-10 bg-white opacity-0'),
    setScroll(value) { scroll = value; listeners.get('scroll')?.fn(); },
    flush() { const pending = [...rafs.values()]; rafs.clear(); pending.forEach(fn => fn()); },
    resize(height) { stickyHeight = height; listeners.get('resize')?.fn(); },
    cleanup() { cleanups.forEach(fn => fn?.()); },
  };
}

test('scroll-up reveals actual About text over the same foggy image, reversing exactly', () => {
  const steps = Array.from({ length: 101 }, (_, i) => 1000 - i * 10);
  const down = steps.map(top => visual(top, 1000));
  const up = [...steps].reverse().map(top => visual(top, 1000)).reverse();
  assert.deepEqual(up, down);
  for (let i = 1; i < down.length; i++) {
    assert.ok(down[i].blurOpacity >= down[i - 1].blurOpacity);
    assert.ok(down[i].whiteOpacity >= down[i - 1].whiteOpacity);
    assert.ok(down[i].aboutOpacity >= down[i - 1].aboutOpacity);
    assert.ok(down[i].titleOpacity <= down[i - 1].titleOpacity);
  }
});
test('no white-out: photograph stays behind readable About text when it arrives', () => {
  const start = visual(1000, 1000);
  assert.equal(start.whiteOpacity, 0);
  assert.equal(start.titleOpacity, 1);
  assert.equal(start.aboutOpacity, 0);
  const reading = visual(500, 1000);
  assert.ok(reading.aboutOpacity > 0 && reading.aboutOpacity < 1);
  assert.equal(reading.titleOpacity, 0);
  assert.ok(reading.whiteOpacity > 0 && reading.whiteOpacity < .5);
  assert.ok(reading.blurOpacity > 0 && reading.blurOpacity < .6);
  const fullyRevealed = visual(0, 1000);
  assert.equal(fullyRevealed.aboutOpacity, 1);
  assert.equal(fullyRevealed.whiteOpacity, .84);
  assert.equal(fullyRevealed.blurOpacity, 1);
  const end = visual(-500, 1000);
  assert.equal(end.aboutOpacity, 1);
  assert.equal(end.whiteOpacity, .84);
  assert.equal(end.aboutY, 0);
  assert.deepEqual(visual(2000, 1000), start);
});
test('passive scroll events coalesce into one RAF and reverse both text and fog', () => {
  const h = harness();
  assert.equal(h.listeners.get('scroll').options.passive, true);
  h.setScroll(200); h.setScroll(500); h.setScroll(1000);
  assert.equal(h.rafs.size, 1);
  h.flush();
  assert.equal(h.copy.style.opacity, '1');
  assert.equal(h.fog.style.opacity, '1');
  assert.equal(h.title.style.opacity, '0');
  assert.match(h.fog.style.maskImage, /linear-gradient\(to bottom/);
  assert.equal(h.fog.style.webkitMaskImage, h.fog.style.maskImage);
  assert.equal(h.overlay.style.maskImage, h.fog.style.maskImage);
  h.setScroll(0); h.flush();
  assert.equal(h.overlay.style.opacity, '0');
  assert.equal(h.fog.style.opacity, '0');
  assert.equal(h.title.style.opacity, '1');
  assert.equal(h.copy.style.opacity, '0');
  h.cleanup();
});
test('mobile toolbar geometry uses actual sticky height, not hardcoded scroll distance', () => {
  const h = harness();
  h.setScroll(300); h.resize(800); h.flush();
  assert.equal(Number(h.copy.style.opacity), visual(500, 800).aboutOpacity);
  h.resize(1200); h.flush();
  assert.equal(Number(h.copy.style.opacity), visual(900, 1200).aboutOpacity);
  h.cleanup();
});

test('hero title stays pinned while fading, with no scroll transform or extra spacer', () => {
  const h = harness();
  const region = h.nodes.find(node => node.type === 'section' && node.props['aria-label'] === 'XI Teknik Pemesinan 2');
  assert.match(region.props.className, /sticky top-0/);
  assert.match(region.props.className, /pointer-events-none/);
  assert.match(region.props.className, /motion-reduce:relative/);
  assert.match(region.props.className, /h-\[100svh\].*md:h-screen/);
  const opacity = [];
  for (const scroll of [0, 100, 200, 300, 400, 500]) {
    h.setScroll(scroll); h.flush();
    opacity.push(Number(h.title.style.opacity));
    assert.equal(h.title.style.transform, undefined);
  }
  assert.equal(opacity[0], 1);
  assert.equal(opacity.at(-1), 0);
  assert.ok(opacity.every((value, index) => index === 0 || value <= opacity[index - 1]));
  h.setScroll(0); h.flush();
  assert.equal(h.title.style.opacity, '1');
  h.cleanup();
});
test('reduced motion shows both real content blocks statically with no scroll listener', () => {
  const h = harness(true);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.fog.style.opacity, '0');
  assert.equal(h.copy.style.opacity, '1');
  assert.equal(h.title.style.opacity, '1');
  h.media.matches = false; h.media.change();
  h.setScroll(600); h.flush();
  assert.ok(Number(h.overlay.style.opacity) > 0);
  h.setScroll(800);
  h.media.matches = true; h.media.change();
  assert.equal(h.rafs.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.overlay.style.opacity, '0');
  assert.equal(h.copy.style.opacity, '1');
  const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
  assert.match(css, /\.hero-story-backdrop\s*\{\s*position: absolute/);
  assert.match(css, /\.hero-story-about\s*\{ background: white/);
  h.cleanup();
});
test('unmount cancels frames/listeners; StrictMode setup does not leave competing loops', () => {
  const h = harness(); h.setScroll(400); h.cleanup();
  assert.equal(h.rafs.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.media.change, null);
  const remount = harness();
  assert.equal(remount.listeners.size, 3);
  remount.cleanup();
});
test('old 350vh spacer and white-out mechanism removed; About remains in document flow', () => {
  const h = harness();
  assert.doesNotMatch(source, /350|hero-scroll-transition|getHeroScrollFrame|style\.filter|useState|backdrop-filter/);
  assert.match(h.backdrop.props.className, /pointer-events-none sticky/);
  assert.doesNotMatch(h.backdrop.props.className, /-mb-/);
  assert.ok(h.nodes.some(node => node.props.className === 'pointer-events-none absolute inset-0 z-0'));
  assert.doesNotMatch(h.about.props.className, /absolute|sticky|h-\[350/);
  assert.match(h.about.props.className, /min-h-\[100svh\]/);
  assert.doesNotMatch(h.copy.props.className, /absolute|sticky/);
  assert.match(h.copy.props.className, /opacity-0/);
  assert.match(source, /hero-story-runway h-\[50svh\] motion-reduce:hidden md:h-\[50vh\]/);
  assert.match(source, /handoffDistance = seamlessHandoff \? viewportHeight \* 0\.12 : 0/);
  assert.match(source, /-storyTop \/ Math\.max\(handoffDistance, 1\)/);
  assert.match(source, /Math\.max\(aboutTop - storyTop - handoffDistance, viewportHeight\)/);
  assert.doesNotMatch(source, /hero-image-enter hero-image-mask/);
  h.cleanup();
});
test('About text is rendered only once from the existing database prop, values stay intact', () => {
  const h = harness();
  assert.equal(h.nodes.filter(node => node.props.children === 'Existing about from database').length, 1);
  assert.equal(h.nodes.filter(node => node.type === 'h2' && node.props.children === 'About Us').length, 1);
  for (const value of ['Discipline', 'Collaboration', 'Growth', 'Belajar', 'Berkarya', 'Bertumbuh']) {
    assert.ok(h.nodes.some(node => node.props.children === value), value);
  }
  assert.equal(h.nodes.filter(node => node.type === 'article').length, 3);
  h.cleanup();
});
test('single photo, editor crop and title are preserved in both sharp and fog layers', () => {
  const h = harness();
  const images = h.nodes.filter(node => node.type === 'image');
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(image.props.src, '/custom.jpg');
    assert.equal(image.props.style.objectFit, 'contain');
    assert.equal(image.props.style.objectPosition, '35% 70%');
  }
  assert.equal(images.filter(node => node.props.alt).length, 1);
  assert.equal(h.fog.props['aria-hidden'], 'true');
  assert.equal(h.nodes.filter(node => node.type === 'h1').length, 1);
  h.cleanup();
});
