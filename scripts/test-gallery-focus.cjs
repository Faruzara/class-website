// Run: node scripts/test-gallery-focus.cjs (no network or database writes).
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTS(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => name in mocks ? mocks[name] : originalRequire(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return loaded.exports;
}

const focus = loadTS('lib/gallery-focus.ts');
const centered = { object_position_x: 50, object_position_y: 50 };

test('orientation reuses natural image dimensions, square remains landscape', () => {
  assert.equal(focus.getGalleryOrientation(800, 1200), 'portrait');
  assert.equal(focus.getGalleryOrientation(1200, 800), 'landscape');
  assert.equal(focus.getGalleryOrientation(800, 800), 'landscape');
});

test('legacy photos stay centered; valid focus is rounded for SQL precision', () => {
  assert.equal(focus.getGalleryObjectPosition({}), '50% 50%');
  assert.equal(focus.getGalleryObjectPosition({ object_position_x: 35.123, object_position_y: 65.456 }), '35.12% 65.46%');
});

test('API validation rejects non-numeric, non-finite and out-of-range positions', () => {
  for (const invalid of [null, '50', NaN, Infinity, -1, 101, {}, []]) {
    assert.equal(focus.parseGalleryFocus({ object_position_x: invalid }), null);
    assert.equal(focus.parseGalleryFocus({ object_position_y: invalid }), null);
  }
  assert.deepEqual(focus.parseGalleryFocus({ object_position_x: 0, object_position_y: 100 }), { object_position_x: 0, object_position_y: 100 });
});

test('dragging upwards reveals the lower image; horizontal cover axis stays fixed', () => {
  const next = focus.dragGalleryFocus(centered, { width: 1200, height: 800 }, { width: 360, height: 100 }, { x: 100, y: -35 });
  assert.deepEqual(next, { object_position_x: 50, object_position_y: 75 });
});

test('portrait crop pans horizontally, clamps edges, and preserves fixed axes', () => {
  const next = focus.dragGalleryFocus(centered, { width: 800, height: 900 }, { width: 240, height: 320 }, { x: 1000, y: 1000 });
  assert.deepEqual(next, { object_position_x: 0, object_position_y: 50 });
  assert.deepEqual(focus.dragGalleryFocus(centered, { width: 0, height: 0 }, { width: 240, height: 320 }, { x: 5, y: 5 }), centered);
});

function routeFixture(options = {}) {
  const inserts = [];
  const routes = loadTS('app/api/admin/galeri/route.ts', {
    'next/server': { NextResponse: { json: (payload, init) => ({ payload, status: init?.status ?? 200 }) } },
    '@/lib/auth': {
      getEditorSession: async () => options.unauthorized ? null : { role: 'admin', label: 'test' },
      logActivity: async () => undefined,
    },
    '@/lib/db': {
      getGaleriPage: async () => ({ items: [], total: 0 }),
      getNextGaleriUrutan: async () => 0,
      addGaleriFoto: async (payload) => {
        if (options.insertError) throw options.insertError;
        inserts.push(payload);
        return { ...payload, id: 'test-id', created_at: '2026-08-30' };
      },
    },
    '@/lib/validation': { isManagedMediaUrl: (url) => url === 'https://example.invalid/photo.jpg' },
    '@/lib/gallery-constants': loadTS('lib/gallery-constants.ts'),
    '@/lib/gallery-focus': focus,
  });
  return { ...routes, inserts };
}

test('POST persists focus with original URL and returns the saved record', async () => {
  const route = routeFixture();
  const result = await route.POST({ json: async () => ({ foto_url: 'https://example.invalid/photo.jpg', object_position_x: 40, object_position_y: 85 }) });
  assert.equal(result.status, 200);
  assert.equal(route.inserts.length, 1);
  assert.equal(route.inserts[0].foto_url, 'https://example.invalid/photo.jpg');
  assert.equal(result.payload.data.object_position_y, 85);
});

test('POST defaults old clients to center and never inserts unauthorized/invalid data', async () => {
  const route = routeFixture();
  await route.POST({ json: async () => ({ foto_url: 'https://example.invalid/photo.jpg' }) });
  assert.equal(route.inserts[0].object_position_x, 50);
  const invalid = await route.POST({ json: async () => ({ object_position_y: 101 }) });
  assert.equal(invalid.status, 400);
  const malformed = await route.POST({ json: async () => { throw new SyntaxError(); } });
  assert.equal(malformed.status, 400);
  assert.equal(route.inserts.length, 1);
  const denied = routeFixture({ unauthorized: true });
  assert.equal((await denied.POST({ json: async () => ({}) })).status, 401);
  assert.equal(denied.inserts.length, 0);
});

test('missing migration produces actionable JSON instead of an empty response', async () => {
  const route = routeFixture({ insertError: { code: 'PGRST204', message: "Could not find object_position_x" } });
  const result = await route.POST({ json: async () => ({ foto_url: 'https://example.invalid/photo.jpg' }) });
  assert.equal(result.status, 500);
  assert.equal(result.payload.success, false);
  assert.match(result.payload.error, /supabase-migration-gallery-focus.sql/);
  assert.equal(route.inserts.length, 0);
});
