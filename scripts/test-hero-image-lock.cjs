const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Owner controls the homepage image lock while Admin receives a disabled uploader', () => {
  const editor = read('components/admin/HomepageEditor.tsx');
  const ownerSection = read('components/owner/OwnerContentSection.tsx');
  assert.match(editor, /ownerMode \? \{ hero_image_locked: heroLocked \} : \{\}/);
  assert.match(editor, /disabled=\{!ownerMode && heroLocked\}/);
  assert.match(editor, /Dikunci Owner/);
  assert.match(ownerSection, /<HomepageEditor settings=\{settings\} ownerMode \/>/);
});

test('settings and upload APIs enforce the lock on the server', () => {
  const settingsRoute = read('app/api/admin/settings/route.ts');
  const uploadRoute = read('app/api/admin/upload/route.ts');
  assert.match(settingsRoute, /"hero_image_locked" in body && session\.role !== "owner"/);
  assert.match(settingsRoute, /currentSettings\?\.hero_image_locked && "hero_image_url" in body/);
  assert.match(settingsRoute, /status: 423/);
  assert.match(uploadRoute, /folder === "hero" && session\.role !== "owner"/);
  assert.match(uploadRoute, /settings\?\.hero_image_locked/);
});

test('database schema and migration default existing images to unlocked', () => {
  const schema = read('supabase-schema.sql');
  const migration = read('supabase-migration-hero-image-lock.sql');
  assert.match(schema, /hero_image_locked BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS hero_image_locked BOOLEAN NOT NULL DEFAULT FALSE/);
});
