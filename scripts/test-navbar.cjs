const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../components/layout/Navbar.tsx'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText;

function renderNavbar(pathname = '/', initialScroll = 0) {
  const state = [], effects = [], listeners = new Map();
  let cursor = 0, mounted = false, nodes = [];
  const jsx = (type, props) => { const node = { type, props }; nodes.push(node); return node; };
  const window = {
    scrollY: initialScroll,
    localStorage: { getItem: () => null, setItem: () => {} },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const document = {
    querySelectorAll: () => pathname === '/' ? [{ getBoundingClientRect: () => ({ top: -window.scrollY, bottom: 3000 - window.scrollY }) }] : [],
  };
  const context = { exports: {}, window, document, process: { env: {} }, require: name => {
    if (name === 'react') return {
      useState: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useEffect: fn => { if (!mounted) effects.push(fn); },
      useRef: initial => ({ current: initial }),
    };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/link') return { default: 'link' };
    if (name === 'next/navigation') return { usePathname: () => pathname };
    if (name === 'lucide-react') return { Github: 'github', Instagram: 'instagram', Menu: 'menu', Music2: 'music', X: 'close' };
    if (name === '@supabase/supabase-js') return { createClient: () => ({}) };
    if (name === '@/lib/config') return { CREATOR_GITHUB_URL: '' };
    if (name === '@/lib/announcement-expiry') return { isAnnouncementVisible: () => true };
    if (name === 'clsx') return { default: require('clsx') };
    throw new Error(name);
  } };
  vm.runInNewContext(code, context);
  function render() { cursor = 0; nodes = []; context.exports.default({}); }
  render();
  const cleanups = effects.map(fn => fn());
  mounted = true;
  render();
  return {
    get nodes() { return nodes; },
    get header() { return nodes.find(node => node.type === 'header'); },
    scroll(value) { window.scrollY = value; listeners.get('scroll')(); render(); },
    toggleMenu() { nodes.find(node => node.type === 'button').props.onClick(); render(); },
    cleanup() { cleanups.forEach(fn => fn?.()); assert.equal(listeners.size, 0); },
  };
}

test('transparent homepage navbar stays pinned and visible in both scroll directions', () => {
  const h = renderNavbar();
  for (const scroll of [0, 100, 1000, 3200, 3100, 100, 0]) {
    h.scroll(scroll);
    const classes = h.header.props.className;
    assert.match(classes, /fixed top-0/);
    assert.match(classes, /inset-x-0/);
    assert.match(classes, /bg-transparent/);
    assert.match(classes, /max-md:transform-gpu/);
    assert.doesNotMatch(classes, /hidden|invisible|opacity-0|translate-y|backdrop-blur/);
    assert.match(classes, scroll < 2972 ? /text-white/ : /text-gray-900/);
  }
  h.cleanup();
});

test('brand and menu share the parent color transition without nested color interpolation', () => {
  const h = renderNavbar();
  assert.match(h.header.props.className, /transition-colors duration-300/);
  const brand = h.nodes.find(node => node.type === 'link' && node.props.children === 'XI TP2');
  const menu = h.nodes.find(node => node.type === 'button');
  for (const node of [brand, menu]) {
    assert.doesNotMatch(node.props.className, /transition-(all|colors)|text-(white|gray|black)/);
  }
  for (const node of h.nodes.filter(node => node.type === 'link')) {
    assert.doesNotMatch(node.props.className, /transition-(all|colors)/);
  }
  h.cleanup();
});

test('mobile menu remains readable and restored scroll selects the correct color immediately', () => {
  const h = renderNavbar('/', 3200);
  assert.match(h.header.props.className, /text-gray-900/);
  h.scroll(0);
  h.toggleMenu();
  assert.match(h.header.props.className, /text-white/);
  const mobileMenu = h.nodes.find(node => typeof node.type === 'function' && node.type.name === 'MobileLineMenu');
  assert.equal(mobileMenu.props.open, true);
  assert.match(source, /w-\[min\(70vw,260px\)\]/);
  assert.match(source, /--line-accent.*#F17D78/);
  assert.doesNotMatch(source, /bg-\[#0d0b12\]/);
  assert.match(source, /relative min-h-6 pr-\[54px\] text-right/);
  assert.match(source, /absolute right-0 top-1\/2 h-px w-11 origin-right/);
  assert.match(source, /grid-cols-\[auto_1\.45rem\]/);
  assert.match(source, /<span className="text-right">\{link\.label\}<\/span>[\s\S]*String\(index \+ 1\)/);
  assert.match(source, /--adjacent-effect/);
  assert.match(source, /index === activeIndex \|\| index \+ 1 === activeIndex/);
  assert.match(source, /after:\[transform:translateX\(calc\(var\(--adjacent-effect\)\*-6px\)\)_scaleX/);
  assert.match(source, /absolute inset-x-0 top-0 z-40 h-\[100svh\]/);
  assert.match(source, /absolute bottom-7 right-3 flex flex-col items-center gap-3/);
  assert.match(source, /select\("instagram_url, tiktok_url"\)/);
  assert.doesNotMatch(source, /fixed inset-x-0 bottom-0 top-14/);
  h.toggleMenu();
  assert.match(h.header.props.className, /text-white/);
  h.cleanup();
});

test('other public pages retain their existing sticky layout and dark text', () => {
  const h = renderNavbar('/anggota');
  for (const value of [0, 1000, 10]) {
    h.scroll(value);
    assert.match(h.header.props.className, /sticky top-0/);
    assert.match(h.header.props.className, /text-gray-900/);
  }
  h.cleanup();
});
