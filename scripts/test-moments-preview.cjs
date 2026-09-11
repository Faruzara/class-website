const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const componentSource = fs.readFileSync(path.join(root, 'components/home/MomentsSection.tsx'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'components/home/moments-preview.ts'), 'utf8');
const frameSource = fs.readFileSync(path.join(root, 'components/moments/MomentCardFrame.tsx'), 'utf8');
const timeSource = fs.readFileSync(path.join(root, 'lib/moment-time.ts'), 'utf8');
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const helper = { exports: {} };
vm.runInNewContext(transpile(helperSource), helper);
const { getMomentPreviewLayers } = helper.exports;
const time = { exports: {} };
vm.runInNewContext(transpile(timeSource), time);

function render(items, onOpen) {
  const nodes = [];
  const jsx = (type, props) => { if (typeof type === 'function') return type(props); const node = { type, props }; nodes.push(node); return node; };
  const frame = { exports: {}, require: name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/moment-time') return time.exports;
    throw new Error(`Unexpected frame dependency: ${name}`);
  } };
  vm.runInNewContext(transpile(frameSource), frame);
  const context = { exports: {}, require: name => {
    if (name === 'react') return { useEffect: () => {}, useRef: () => ({ current: null }) };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/image') return { default: 'image' };
    if (name === './RevealOnScroll') return { default: 'reveal' };
    if (name === './moments-preview') return helper.exports;
    if (name === '@/lib/moment-time') return time.exports;
    throw new Error(`Unexpected dependency: ${name}`);
  } };
  vm.runInNewContext(transpile(componentSource), context);
  context.exports.default({ items, onOpen });
  return nodes;
}

test('Moments is inserted only between Class Structure and Gallery', () => {
  const homepage = fs.readFileSync(path.join(root, 'components/home/HomepageData.tsx'), 'utf8');
  const structure = homepage.indexOf('>Class Structure<');
  const moments = homepage.indexOf('<LiveMomentsSection />');
  const gallery = homepage.indexOf('kicker="Gallery"');
  assert.ok(structure < moments && moments < gallery);
  assert.equal((homepage.match(/<LiveMomentsSection/g) || []).length, 1);
  assert.doesNotMatch(homepage + helperSource + componentSource, /MOMENTS_DEMO_ITEMS|MOMENT_SAMPLE_PREVIEW_SRC|demo-moment-|hero-workshop/);
});

test('empty or omitted data shows only a quiet viewfinder, without fake cards or an entry button', () => {
  for (const items of [undefined, []]) {
    const nodes = render(items);
    assert.ok(nodes.some(node => node.props.children === 'Belum ada momen baru.'));
    assert.ok(nodes.some(node => node.type === 'h2' && node.props.children === 'Moments'));
    assert.equal(nodes.filter(node => node.props['data-moment-layer'] !== undefined).length, 0);
    assert.equal(nodes.filter(node => node.type === 'button').length, 0);
    assert.equal(nodes.filter(node => node.type === 'image').length, 0);
    assert.ok(nodes.some(node => node.props['data-moments-empty'] === true));
    assert.ok(nodes.some(node => node.props.children === 'STANDBY'));
    const copy = nodes.find(node => node.props.children === 'Belum ada momen baru.');
    assert.equal(copy.props.className, 'sr-only');
    assert.ok(nodes.some(node => node.props.className?.includes('py-16')));
    assert.ok(!nodes.some(node => node.props.className?.includes('aspect-[3/4]')));
    assert.equal(nodes.find(node => node.type === 'h2').props.className, 'section-kicker mb-8');
    assert.equal(nodes.filter(node => node.props.className?.includes('border-neutral-900/15')).length, 4);
    assert.equal(nodes.filter(node => node.props.className?.includes('border-current')).length, 4);
  }
});

test('viewfinder polish keeps corners in place and enlarges only metadata and central focus', () => {
  const nodes = render([]);
  const corners = nodes.filter(node => node.props.className?.includes('border-neutral-900/15'));
  for (const corner of corners) assert.match(corner.props.className, /h-6 w-6 .*sm:h-8 sm:w-8/);
  const focus = nodes.find(node => node.props.className?.includes('h-14 w-16'));
  assert.match(focus.props.className, /left-1\/2 top-1\/2/);
  assert.match(focus.props.className, /sm:h-16 sm:w-20/);
  for (const [before, after] of [[40,56], [48,64], [48,64], [56,80]]) {
    assert.ok(after / before >= 1.3 && after / before <= 1.5);
  }
  const focalPoints = nodes.filter(node => node.props.className?.includes('h-[3px] w-[3px]'));
  assert.equal(focalPoints.length, 1);
  assert.match(focalPoints[0].props.className, /left-1\/2 top-1\/2/);
  assert.match(focalPoints[0].props.className, /bg-brand-500\/60/);
  assert.ok(nodes.some(node => node.props.className?.includes('text-[9px]') && node.props.className.includes('sm:text-[10px]')));
  assert.ok(!render([{ id: 'real-moment' }]).some(node => node.props.className?.includes('h-[3px] w-[3px]') && node.props.className.includes('left-1/2 top-1/2')));
});

test('one/two/many previews render only their own compact layers, capped at three', () => {
  for (const count of [1, 2, 3, 7]) {
    const items = Array.from({ length: count }, (_, index) => ({ id: String(index) }));
    const original = JSON.stringify(items);
    const nodes = render(items);
    const layers = nodes.filter(node => node.props['data-moment-layer'] !== undefined);
    assert.equal(layers.length, Math.min(count, 3));
    assert.ok(layers.every(node => node.props['aria-hidden'] === 'true'));
    assert.equal(nodes.filter(node => node.type === 'button').length, 1);
    assert.equal(nodes.filter(node => node.props['data-moments-empty']).length, 0);
    assert.ok(!nodes.some(node => node.props.children === 'STANDBY'));
    assert.equal(JSON.stringify(items), original);
  }
  const deduplicated = getMomentPreviewLayers([{ id: 'a' }, { id: 'a' }, { id: 'b' }]);
  assert.deepEqual(Array.from(deduplicated, item => item.id), ['a', 'b']);
});

test('empty viewfinder and populated composition reserve the same responsive stage height', () => {
  const emptyNodes = render([]);
  const populatedNodes = render([{ id: 'real-moment' }]);
  assert.equal(emptyNodes.find(node => node.type === 'h2').props.className, populatedNodes.find(node => node.type === 'h2').props.className);
  const viewfinder = emptyNodes.find(node => node.props.className?.includes('h-[min(108vw,430px)]'));
  assert.equal(viewfinder.props['aria-hidden'], 'true');
  const wrapper = emptyNodes.find(node => node.props['data-moments-empty']);
  assert.equal(wrapper.props.className, 'relative pb-3 pt-6');
  assert.ok(populatedNodes.some(node => node.props.className?.includes('h-[min(108vw,430px)]')));
  assert.doesNotMatch(componentSource.slice(componentSource.indexOf('data-moments-empty')), /<button|<Image|moments-card|bg-gradient|animate-/);
});

test('the entire stack is one accessible entry, with an optional future viewer callback', () => {
  const calls = [];
  const button = render([{ id: 'first' }, { id: 'second' }], id => calls.push(id)).find(node => node.type === 'button');
  assert.equal(button.props.type, 'button');
  assert.equal(button.props['aria-label'], 'Buka Moments');
  button.props.onClick();
  assert.deepEqual(calls, ['first']);
  assert.doesNotThrow(() => render([{ id: 'demo' }]).find(node => node.type === 'button').props.onClick());
});

test('only supplied lightweight previews are used, never a fake/sample image fallback', () => {
  const nodes = render([{ id: 'a', previewSrc: '/already-obscured-thumbnail.jpg' }, { id: 'b' }]);
  const images = nodes.filter(node => node.type === 'image');
  assert.equal(images[0].props.src, '/already-obscured-thumbnail.jpg');
  assert.equal(images.length, 1);
  assert.ok(images.every(node => node.props.unoptimized && node.props.width === 144 && node.props.alt === ''));
  assert.match(images[0].props.className, /blur-\[4px\]/);
  const failedImage = { style: {} };
  images[0].props.onError({ currentTarget: failedImage });
  assert.equal(failedImage.style.visibility, 'hidden');
});

test('only the photo has one light blur; fan uses CSS without a motion dependency', () => {
  const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
  const momentsCss = css.slice(css.indexOf('/* Moments:'), css.indexOf('/* -- Kartu standar -- */'));
  assert.doesNotMatch(momentsCss + componentSource + frameSource, /backdrop-filter|filter\s*:|blur\(|setInterval|setTimeout|requestAnimationFrame|<canvas|<svg|animate-/);
  assert.equal((componentSource.match(/blur-\[4px\]/g) || []).length, 1);
  assert.doesNotMatch(momentsCss + frameSource, /blur-/);
  assert.match(componentSource, /motion-reduce:transition-none/);
  assert.match(componentSource, /moments-home-card-front/);
  assert.match(momentsCss, /\.moments-home-card-left/);
  assert.match(momentsCss, /@media \(hover: hover\)/);
  assert.match(momentsCss, /@media \(hover: none\)/);
  assert.doesNotMatch(componentSource + momentsCss, /framer-motion|from ['"]motion/);
});

test('stack uses clean white cards, rounded photo windows and timestamps', () => {
  const nodes = render([{ id: 'real', capturedAt: '2026-08-30T13:33:00.000Z' }]);
  const card = nodes.find(node => node.props['data-moment-layer'] === 0);
  assert.match(card.props.className, /rounded-2xl/);
  assert.match(card.props.className, /bg-white/);
  assert.ok(nodes.some(node => node.props.className?.includes('rounded-xl bg-neutral-900')));
  assert.equal(nodes.filter(node => node.props.children === 'Tap untuk melihat').length, 1);
  assert.equal(nodes.filter(node => node.props.children === '20:33 / 30.08.26').length, 1);
  const composer = fs.readFileSync(path.join(root, 'components/admin/MomentCameraDialog.tsx'), 'utf8');
  assert.doesNotMatch(composer, /MomentCardFrame/);
  assert.match(composer, /overflow-hidden rounded-2xl border border-white\/10 bg-neutral-900/);
});

test('capture timestamps stay fixed, format in WIB and fall back only for legacy records', () => {
  assert.equal(time.exports.formatMomentTimestamp('2026-08-30T13:33:00.000Z'), '20:33 / 30.08.26');
  assert.equal(time.exports.formatMomentTimestamp('2026-08-30T17:01:00.000Z'), '00:01 / 31.08.26');
  const actual = render([{ id: 'new', capturedAt: '2026-08-30T13:33:00.000Z', createdAt: '2026-08-30T13:34:00.000Z' }]);
  assert.equal(actual.find(node => node.type === 'time').props.children, '20:33 / 30.08.26');
  const legacy = render([{ id: 'old', createdAt: '2026-08-30T13:34:00.000Z' }]);
  assert.equal(legacy.find(node => node.type === 'time').props.children, '20:34 / 30.08.26');
  assert.equal(render([{ id: 'unknown' }]).find(node => node.type === 'time').props.children, '--:-- / --.--.--');
});

test('composition sizing uses the actual layer count, without reserving missing cards', () => {
  for (const count of [1, 2, 3, 7]) {
    const nodes = render(Array.from({length: count}, (_, i) => ({id: String(i)})));
    const button = nodes.find(node => node.type === 'button');
    assert.equal(button.props['data-preview-count'], Math.min(count, 3));
    assert.match(button.props.className, /moments-home-stack/);
    assert.ok(nodes.some(node => node.props.className?.includes('[container-type:inline-size]')));
  }
});
