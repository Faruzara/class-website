// node scripts/test-instagram-card.cjs — isolated: no network/database writes.
// node scripts/test-instagram-card.cjs --preview — local visual fixture, port 4175.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = loaded.require.bind(loaded);
  loaded.require = name => name in mocks ? mocks[name] : original(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const validation = load('lib/validation.ts');
const Card = load('components/home/SocialMediaCard.tsx', { '@/lib/validation': validation }).default;
const Section = load('components/home/SocialMediaSection.tsx', {
  './SocialMediaCard': { default: Card, __esModule: true },
  './RevealOnScroll': { default: ({ children }) => children, __esModule: true },
  '@/lib/validation': validation,
}).default;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const imageUrl = '/images/hero-workshop.png';
const instagramUrl = 'https://www.instagram.com/xi.tp2/';
const tiktokUrl = 'https://www.tiktok.com/@xi.tp2/';

function fixture(options = {}) {
  const writes = [];
  const routes = load('app/api/admin/settings/route.ts', {
    'next/server': { NextResponse: { json: (data, init) => ({ data, status: init?.status ?? 200 }) } },
    '@/lib/auth': { getEditorSession: async () => options.denied ? null : { role: 'admin', label: 'test' }, logActivity: async () => {} },
    '@/lib/db': {
      getSiteSettings: async () => ({ instagram_image_url: '/saved.jpg' }),
      updateSiteSettings: async payload => { if (options.error) throw options.error; writes.push(payload); },
    },
    '@/lib/validation': { ...validation, isManagedMediaUrl: value => value === 'https://example.invalid/storage/photo.jpg' },
  });
  return { ...routes, writes };
}

if (!process.argv.includes('--preview')) {
  test('homepage panel requires a saved image and safe Instagram URL', () => {
    for (const props of [{}, { instagramImageUrl: imageUrl }, { instagramUrl }, { instagramImageUrl: imageUrl, instagramUrl: 'javascript:alert(1)' }, { instagramImageUrl: imageUrl, instagramUrl: 'https://example.com' }]) {
      assert.equal(render(Section, props), '');
    }
    assert.match(render(Section, { instagramImageUrl: imageUrl, instagramUrl }), /Stay Connected/);
  });
  test('photo uses the shared 16:9 clipped frame and handle is derived from the URL', () => {
    const html = render(Card, { imageUrl, url: instagramUrl, platform: 'instagram' });
    assert.match(html, /aspect-\[16\/9\]/);
    assert.match(html, /overflow-hidden/);
    assert.match(html, /object-cover object-center/);
    assert.match(html, /@xi.tp2/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });
  test('admin preview never navigates, invalid links never become clickable', () => {
    assert.doesNotMatch(render(Card, { imageUrl, url: instagramUrl, platform: 'instagram', preview: true }), /<a\s/);
    assert.doesNotMatch(render(Card, { imageUrl, url: 'https://instagram.com.evil.example', platform: 'instagram' }), /<a\s/);
  });
  test('settings API saves a new background, supports clearing it, and reads saved data', async () => {
    const route = fixture();
    assert.equal((await route.PATCH({ json: async () => ({ instagram_image_url: 'https://example.invalid/storage/photo.jpg' }) })).status, 200);
    assert.equal(route.writes[0].instagram_image_url, 'https://example.invalid/storage/photo.jpg');
    await route.PATCH({ json: async () => ({ instagram_image_url: null }) });
    assert.equal(route.writes[1].instagram_image_url, null);
    assert.equal((await route.GET()).data.data.instagram_image_url, '/saved.jpg');
  });
  test('API rejects invalid types, external media and unauthenticated writes', async () => {
    for (const value of [123, {}, 'https://foreign.invalid/photo.jpg']) {
      const route = fixture();
      assert.equal((await route.PATCH({ json: async () => ({ instagram_image_url: value }) })).status, 400);
      assert.equal(route.writes.length, 0);
    }
    const denied = fixture({ denied: true });
    assert.equal((await denied.PATCH({ json: async () => ({ instagram_image_url: null }) })).status, 401);
    assert.equal(denied.writes.length, 0);
  });
  test('missing migration gives an actionable JSON error', async () => {
    const route = fixture({ error: { code: 'PGRST204', message: 'Could not find instagram_image_url' } });
    const result = await route.PATCH({ json: async () => ({ instagram_image_url: null }) });
    assert.equal(result.status, 500);
    assert.match(result.data.error, /supabase-migration-instagram-card.sql/);
  });
  test('existing settings remain compatible without the new column in the payload', async () => {
    const route = fixture();
    await route.POST({ json: async () => ({ instagram_url: instagramUrl, about_text: 'Existing about', hero_object_fit: 'cover' }) });
    assert.equal(route.writes[0].instagram_url, instagramUrl);
    assert.equal(route.writes[0].hero_object_fit, 'cover');
    assert.equal('instagram_image_url' in route.writes[0], false);
  });
  test('panel follows all HomepageData sections; crop/upload and Save are reused', () => {
    const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
    assert.match(page, /<HomepageData>\s*<SocialMediaSection transparentBackground[\s\S]*?\/\>\s*<\/HomepageData>/);
    const homepage = fs.readFileSync(path.join(root, 'components/home/HomepageData.tsx'), 'utf8');
    assert.ok(homepage.indexOf('{children}') > homepage.indexOf('kicker="Class Members"'));
    const editor = fs.readFileSync(path.join(root, 'components/admin/HomepageEditor.tsx'), 'utf8');
    assert.match(editor, /folder="social" cropAspect=\{16 \/ 9\}/);
    assert.match(editor, /if \(savingRef.current \|\| uploadBusy\) return/);
    assert.match(editor, /disabled=\{saving \|\| uploadBusy \|\| !dirty\}/);
    assert.doesNotMatch(editor, /replaceUrl=\{instagramImage\}/);
    const sql = fs.readFileSync(path.join(root, 'supabase-migration-instagram-card.sql'), 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS instagram_image_url TEXT/);
    assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE/);
  });
  test('shared leaf background spans Members and social content without changing the social default', () => {
    const props = { instagramImageUrl: imageUrl, instagramUrl };
    assert.match(render(Section, props), /<section[^>]*bg-white/);
    assert.match(render(Section, { ...props, transparentBackground: true }), /<section[^>]*bg-transparent/);
    assert.equal(render(Section, { transparentBackground: true }), '');
    const homepage = fs.readFileSync(path.join(root, 'components/home/HomepageData.tsx'), 'utf8');
    assert.match(homepage, /members-social-background relative isolate overflow-x-clip bg-white/);
    assert.match(homepage, /class-members-foliage-stage relative border-t border-neutral-900\/\[0\.08\]/);
    assert.match(homepage, /class-members-foliage-track[^"\n]*absolute inset-x-0 top-0/);
    assert.match(homepage, /class-members-foliage sticky top-0 ml-auto/);
    assert.match(homepage, /class-members-section relative/);
    assert.doesNotMatch(homepage, /class-members-section[^"\n]*(bg-white|overflow-clip)/);
    const stylesheet = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
    assert.match(stylesheet, /class-members-foliage-track[\s\S]*?height:\s*calc\(100% \+ var\(--class-members-foliage-height\)\)/);
    assert.match(stylesheet, /class-members-foliage[\s\S]*?width:\s*var\(--class-members-foliage-width\)[\s\S]*?height:\s*var\(--class-members-foliage-height\)/);
  });
  test('two panels have one mobile column, two desktop columns, Instagram first', () => {
    const html = render(Section, { instagramImageUrl: imageUrl, instagramUrl, tiktokImageUrl: imageUrl, tiktokUrl });
    assert.equal((html.match(/<a\s/g) ?? []).length, 2);
    assert.match(html, /grid-cols-1/);
    assert.match(html, /md:grid-cols-2/);
    assert.ok(html.indexOf('Buka Instagram') < html.indexOf('Buka TikTok'));
    assert.equal((html.match(/>@xi\.tp2<\/p>/g) ?? []).length, 2);
    assert.doesNotMatch(html, /@@/);
  });
  test('TikTok is independent, hides incomplete configuration, rejects cross-platform URLs', () => {
    const single = render(Section, { tiktokImageUrl: imageUrl, tiktokUrl });
    assert.match(single, /Buka TikTok/);
    assert.doesNotMatch(single, /Buka Instagram|md:grid-cols-2/);
    for (const props of [{ tiktokUrl }, { tiktokImageUrl: imageUrl }, { tiktokImageUrl: imageUrl, tiktokUrl: instagramUrl }]) {
      assert.equal(render(Section, props), '');
    }
    assert.doesNotMatch(render(Card, { imageUrl, url: tiktokUrl, platform: 'tiktok', preview: true }), /<a\s/);
  });
  test('TikTok saves/clears without touching Instagram, invalid image is rejected', async () => {
    const route = fixture();
    await route.PATCH({ json: async () => ({ tiktok_image_url: 'https://example.invalid/storage/photo.jpg' }) });
    assert.deepEqual(route.writes[0], { tiktok_image_url: 'https://example.invalid/storage/photo.jpg' });
    await route.PATCH({ json: async () => ({ tiktok_image_url: null }) });
    assert.deepEqual(route.writes[1], { tiktok_image_url: null });
    for (const value of [123, {}, 'https://foreign.invalid/photo.jpg']) {
      assert.equal((await route.PATCH({ json: async () => ({ tiktok_image_url: value }) })).status, 400);
    }
    assert.equal(route.writes.length, 2);
    const missing = fixture({ error: { code: 'PGRST204', message: 'Could not find tiktok_image_url' } });
    const result = await missing.PATCH({ json: async () => ({ tiktok_image_url: null }) });
    assert.match(result.data.error, /supabase-migration-tiktok-card.sql/);
  });
  test('both uploads lock Save; TikTok migration only adds its own column', () => {
    const editor = fs.readFileSync(path.join(root, 'components/admin/HomepageEditor.tsx'), 'utf8');
    assert.match(editor, /const uploadBusy = instagramUploadBusy \|\| tiktokUploadBusy/);
    assert.match(editor, /cropTitle="Atur latar TikTok"/);
    const sql = fs.readFileSync(path.join(root, 'supabase-migration-tiktok-card.sql'), 'utf8');
    assert.match(sql, /ADD COLUMN IF NOT EXISTS tiktok_image_url TEXT/);
    assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE|instagram_image_url/);
  });
} else {
  // Serve the actual component + compiled project CSS. No test routes in Next.js.
  const cssDir = path.join(root, '.next/static/css');
  const css = fs.readdirSync(cssDir).filter(name => name.endsWith('.css')).map(name => fs.readFileSync(path.join(cssDir, name), 'utf8')).join('\n');
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Social panels visual check</title><style>' + css + '</style></head><body>' + render(Section, { instagramImageUrl: imageUrl, instagramUrl, tiktokImageUrl: imageUrl, tiktokUrl }) + '</body></html>';
  require('node:http').createServer((req, res) => {
    if (req.url.startsWith('/_next/image') || req.url === imageUrl) {
      res.setHeader('Content-Type', 'image/png');
      res.end(fs.readFileSync(path.join(root, 'public/images/hero-workshop.png')));
    } else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }
  }).listen(4175, '127.0.0.1', () => console.log('Instagram visual fixture: http://127.0.0.1:4175'));
}
