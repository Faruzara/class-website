// Run: node scripts/test-homepage-gallery.cjs. No network/database needed.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../components/home/homepage-gallery.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { GALLERY_LAYOUTS: layouts, createGallerySession, prepareGalleryPools, fillGallerySlots } = loaded.exports;

function bounds(slot, mobile = false) {
  const col = (mobile ? /(?:^| )\[grid-column:(\d+)\/(\d+)/ : /md:\[grid-column:(\d+)\/(\d+)/).exec(slot.className);
  const row = (mobile ? /(?:^| )\[grid-row:(\d+)\/(\d+)/ : /md:\[grid-row:(\d+)\/(\d+)/).exec(slot.className);
  return { left: +col[1] - 1, right: +col[2] - 1, top: +row[1] - 1, bottom: +row[2] - 1 };
}

const shapes = { A: { rows: [3, 2, 3], ratio: 16 / 9 }, B: { rows: [22, 24, 30, 24], ratio: 1 }, C: { rows: [22, 34, 10, 34], ratio: 10 / 11 } };

test('Variant A retains its exact original wrapper and slot placement', () => {
  assert.equal(layouts.A.gridClassName, 'grid grid-cols-2 gap-2 md:aspect-[16/9] md:[grid-template-columns:repeat(16,minmax(0,1fr))] md:[grid-template-rows:3fr_2fr_3fr] md:gap-3');
  assert.deepEqual(layouts.A.slots.map(slot => bounds(slot)), [
    { left: 0, right: 4, top: 0, bottom: 2 },
    { left: 4, right: 16, top: 0, bottom: 1 },
    { left: 4, right: 8, top: 1, bottom: 2 },
    { left: 8, right: 12, top: 1, bottom: 2 },
    { left: 0, right: 12, top: 2, bottom: 3 },
    { left: 12, right: 16, top: 1, bottom: 3 },
  ]);
});

test('mobile keeps two portraits, full L1, paired L2/L3, full L4 and 8px gap', () => {
  assert.deepEqual(layouts.A.slots.map(s => s.className.split(' ').filter(c => !c.startsWith('md:')).join(' ')), [
    'col-start-1 row-start-1 aspect-[3/4] w-full',
    'col-span-2 col-start-1 row-start-2 aspect-[16/10]',
    'col-start-1 row-start-3 aspect-[16/10]',
    'col-start-2 row-start-3 aspect-[16/10]',
    'col-span-2 col-start-1 row-start-4 aspect-[16/10]',
    'col-start-2 row-start-1 aspect-[3/4] w-full',
  ]);
  assert.match(layouts.A.gridClassName, /grid-cols-2 gap-2 /);
});

for (const variant of ['A', 'B', 'C']) {
  test(`${variant}: six slots tile one rectangle with no holes, overlap or overflow`, () => {
    const rows = shapes[variant].rows.length;
    const occupied = Array.from({ length: rows }, () => Array(16).fill(0));
    assert.equal(layouts[variant].slots.length, 6);
    for (const slot of layouts[variant].slots) {
      const b = bounds(slot);
      assert.ok(b.left >= 0 && b.right <= 16 && b.top >= 0 && b.bottom <= rows);
      for (let y = b.top; y < b.bottom; y++) for (let x = b.left; x < b.right; x++) occupied[y][x]++;
    }
    assert.ok(occupied.flat().every(n => n === 1));
  });

  test(`${variant}: portrait and landscape proportions stay correct at desktop/tablet widths`, () => {
    const { rows, ratio } = shapes[variant];
    for (const width of [728, 912, 1216]) {
      const trackWidth = (width - 15 * 12) / 16;
      const availableHeight = width / ratio - (rows.length - 1) * 12;
      const total = rows.reduce((a, b) => a + b, 0);
      for (const slot of layouts[variant].slots) {
        const b = bounds(slot);
        const w = trackWidth * (b.right - b.left) + 12 * (b.right - b.left - 1);
        const h = rows.slice(b.top, b.bottom).reduce((sum, n) => sum + n / total * availableHeight, 0) + 12 * (b.bottom - b.top - 1);
        assert.ok(slot.kind === 'portrait' ? h > w : w > h, `${variant}/${slot.id}: ${w} x ${h}`);
      }
    }
  });
}

test('B keeps stacked right portraits, middle-left P3, and full-width bottom L3', () => {
  const slots = Object.fromEntries(layouts.B.slots.map(s => [s.id, bounds(s)]));
  assert.equal(slots['portrait-1'].left, slots['portrait-2'].left);
  assert.equal(slots['portrait-1'].bottom, slots['portrait-2'].top);
  assert.equal(slots['portrait-3'].left, 0);
  assert.equal(slots['landscape-3'].left, 0);
  assert.equal(slots['landscape-3'].right, 16);
});

test('C keeps staggered P2/P3 boundaries and stacked right P3/P4', () => {
  const slots = Object.fromEntries(layouts.C.slots.map(s => [s.id, bounds(s)]));
  assert.ok(slots['portrait-3'].bottom > slots['portrait-2'].bottom);
  assert.equal(slots['portrait-3'].bottom, slots['portrait-4'].top);
  assert.equal(slots['landscape-2'].top, slots['portrait-2'].bottom);
  assert.equal(slots['portrait-1'].left, 0);
});

const classified = ['portrait', 'landscape'].flatMap(orientation => Array.from({ length: 10 }, (_, i) => ({
  orientation, photo: { id: `${orientation}-${i}`, foto_url: `${orientation}-${i}.jpg`, object_position_y: 65 },
})));

test('seeded pools stay stable, never mutate the source, and deduplicate IDs', () => {
  const snapshot = JSON.stringify(classified);
  const first = prepareGalleryPools(classified, 12345);
  assert.deepEqual(prepareGalleryPools([...classified, classified[0]], 12345), first);
  assert.deepEqual(prepareGalleryPools(classified, 12345), first);
  assert.notDeepEqual(prepareGalleryPools(classified, 98765), first);
  assert.equal(JSON.stringify(classified), snapshot);
});

test('A/B/C allocate 2P4L, 3P3L, 4P2L without duplicates, preserving focus data', () => {
  const pools = prepareGalleryPools(classified, 123);
  for (const [variant, portraits] of [['A', 2], ['B', 3], ['C', 4]]) {
    const slots = fillGallerySlots(variant, pools);
    assert.equal(slots.filter(s => s.kind === 'portrait').length, portraits);
    assert.equal(new Set(slots.map(s => s.photo.id)).size, 6);
    for (const slot of slots) {
      assert.ok(slot.photo.id.startsWith(slot.kind));
      assert.equal(slot.photo.object_position_y, 65);
    }
  }
});

test('insufficient photos keep missing orientation slots empty, without fallback/rearrangement', () => {
  const pools = { portraits: [{ id: 'p1' }, { id: 'p2' }], landscapes: [{ id: 'l1' }] };
  const slots = fillGallerySlots('C', pools);
  assert.equal(slots.length, 6);
  assert.equal(slots.filter(s => s.photo === null).length, 3);
  assert.equal(slots.filter(s => s.kind === 'portrait' && s.photo === null).length, 2);
  assert.deepEqual(slots.map(s => s.className), layouts.C.slots.map(s => s.className));
  assert.equal(fillGallerySlots('C', { portraits: [], landscapes: [] }).filter(s => s.photo === null).length, 6);
});

test('one selected variant and photo assignment serves mobile and desktop without reshuffling', () => {
  assert.deepEqual([0.01, 0.4, 0.99].map(r => createGallerySession(r, 0.5).variant), ['A', 'B', 'C']);
  for (const random of [0.01, 0.4, 0.99]) {
    const session = createGallerySession(random, 0.5);
    const snapshot = JSON.stringify(session);
    const pools = prepareGalleryPools(classified, session.seed);
    const selected = fillGallerySlots(session.variant, pools);
    for (const viewportWidth of [320, 414, 767, 768, 1280, 375]) {
      assert.deepEqual(fillGallerySlots(session.variant, pools), selected, `resize to ${viewportWidth}`);
    }
    assert.equal(JSON.stringify(session), snapshot);
  }
});

test('mobile B tiles its asymmetric anchor, full-width middle and bottom pair without holes', () => {
  assert.match(layouts.B.gridClassName, /grid-cols-12 aspect-\[10\/21\] gap-2/);
  assert.match(layouts.B.gridClassName, /\[grid-template-rows:minmax\(0,3fr\)_minmax\(0,7fr\)_minmax\(0,6fr\)_minmax\(0,5fr\)\]/);
  const slots = Object.fromEntries(layouts.B.slots.map(s => [s.id, bounds(s, true)]));
  assert.deepEqual(slots, {
    'landscape-1': { left: 6, right: 12, top: 0, bottom: 1 },
    'portrait-1': { left: 0, right: 6, top: 0, bottom: 2 },
    'portrait-2': { left: 6, right: 12, top: 1, bottom: 2 },
    'portrait-3': { left: 0, right: 4, top: 3, bottom: 4 },
    'landscape-2': { left: 0, right: 12, top: 2, bottom: 3 },
    'landscape-3': { left: 4, right: 12, top: 3, bottom: 4 },
  });
  const occupied = Array.from({ length: 4 }, () => Array(12).fill(0));
  for (const b of Object.values(slots)) {
    for (let y = b.top; y < b.bottom; y++) for (let x = b.left; x < b.right; x++) occupied[y][x]++;
  }
  assert.ok(occupied.flat().every(n => n === 1));
});

test('mobile B retains portrait/landscape shapes across narrow and large phones', () => {
  const rows = [3, 7, 6, 5];
  for (const viewport of [320, 360, 375, 390, 414, 430, 540, 767]) {
    const width = viewport - 40;
    const col = (width - 11 * 8) / 12;
    const unit = (width * 21 / 10 - 3 * 8) / 21;
    for (const slot of layouts.B.slots) {
      const b = bounds(slot, true);
      const w = col * (b.right - b.left) + 8 * (b.right - b.left - 1);
      const h = unit * rows.slice(b.top, b.bottom).reduce((sum, weight) => sum + weight, 0) + 8 * (b.bottom - b.top - 1);
      assert.ok(slot.kind === 'portrait' ? h > w : w > h, `${viewport}/${slot.id}: ${w} x ${h}`);
      assert.ok(w > 0 && h > 0 && w <= width);
    }
  }
});

test('mobile C has two 3:4 portrait pairs separated by full-width 16:10 landscapes', () => {
  assert.match(layouts.C.gridClassName, /grid-cols-2 gap-2/);
  assert.deepEqual(layouts.C.slots.map(s => s.className.split(' ').filter(c => !c.startsWith('md:')).join(' ')), [
    'col-start-1 row-start-1 aspect-[3/4] w-full',
    'col-span-2 col-start-1 row-start-2 aspect-[16/10]',
    'col-start-2 row-start-1 aspect-[3/4] w-full',
    'col-start-1 row-start-3 aspect-[3/4] w-full',
    'col-span-2 col-start-1 row-start-4 aspect-[16/10]',
    'col-start-2 row-start-3 aspect-[3/4] w-full',
  ]);
  for (const slot of layouts.C.slots) {
    assert.ok(slot.className.includes('md:aspect-auto'));
    if (slot.kind === 'portrait') assert.ok(slot.className.includes('md:w-auto'));
  }
});

test('B/C preserve all existing desktop grid positions, dimensions and gaps', () => {
  const desktop = value => value.split(' ').filter(c => c.startsWith('md:'));
  assert.deepEqual(desktop(layouts.B.gridClassName), ['md:aspect-square', 'md:[grid-template-columns:repeat(16,minmax(0,1fr))]', 'md:[grid-template-rows:22fr_24fr_30fr_24fr]', 'md:gap-3']);
  assert.deepEqual(desktop(layouts.C.gridClassName), ['md:aspect-[10/11]', 'md:[grid-template-columns:repeat(16,minmax(0,1fr))]', 'md:[grid-template-rows:22fr_34fr_10fr_34fr]', 'md:gap-3']);
  assert.deepEqual(layouts.B.slots.map(s => bounds(s)), [
    { left: 0, right: 13, top: 0, bottom: 2 }, { left: 13, right: 16, top: 0, bottom: 1 },
    { left: 13, right: 16, top: 1, bottom: 2 }, { left: 0, right: 4, top: 2, bottom: 3 },
    { left: 4, right: 16, top: 2, bottom: 3 }, { left: 0, right: 16, top: 3, bottom: 4 },
  ]);
  assert.deepEqual(layouts.C.slots.map(s => bounds(s)), [
    { left: 0, right: 6, top: 0, bottom: 2 }, { left: 6, right: 16, top: 0, bottom: 1 },
    { left: 6, right: 11, top: 1, bottom: 2 }, { left: 11, right: 16, top: 1, bottom: 3 },
    { left: 0, right: 11, top: 2, bottom: 4 }, { left: 11, right: 16, top: 3, bottom: 4 },
  ]);
});

test('missing B/C photos preserve the same six responsive slots and orientation without duplicates', () => {
  for (const variant of ['B', 'C']) {
    const slots = fillGallerySlots(variant, { portraits: [{ id: 'p' }], landscapes: [{ id: 'l' }] });
    assert.equal(slots.filter(s => s.photo === null).length, 4);
    assert.deepEqual(slots.map(s => s.className), layouts[variant].slots.map(s => s.className));
    assert.deepEqual(slots.filter(s => s.photo).map(s => s.photo.id).sort(), ['l', 'p']);
  }
});
