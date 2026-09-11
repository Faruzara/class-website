const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Gallery locks are per photo and Owner-only", () => {
  const editor = read("components/admin/GalleryEditor.tsx");
  const route = read("app/api/admin/galeri/[id]/route.ts");
  assert.match(editor, /photo\.is_locked/);
  assert.match(editor, /!ownerMode && photo\.is_locked/);
  assert.match(route, /session\.role !== "owner" && photo\.is_locked/);
  assert.match(route, /Hanya Owner yang dapat mengubah kunci foto/);
});

test("Member photo lock leaves text editing available", () => {
  const editor = read("components/admin/MembersEditor.tsx");
  const route = read("app/api/admin/anggota/[id]/route.ts");
  assert.match(editor, /disabled=\{!ownerMode && member\.foto_locked\}/);
  assert.match(editor, /Data teks tetap dapat diedit/);
  assert.match(route, /current\.foto_locked && changesLockedPhoto/);
  assert.match(route, /session\.role === "owner" && typeof body\.foto_locked === "boolean"/);
});

test("Instagram and TikTok images have independent locks", () => {
  const editor = read("components/admin/HomepageEditor.tsx");
  const route = read("app/api/admin/settings/route.ts");
  assert.match(editor, /protectedAsset=\{\{ kind: "instagram" \}\}/);
  assert.match(editor, /protectedAsset=\{\{ kind: "tiktok" \}\}/);
  assert.match(route, /currentSettings\?\.instagram_image_locked/);
  assert.match(route, /currentSettings\?\.tiktok_image_locked/);
});

test("Upload replacement cannot delete a locked file without an authorized target", () => {
  const upload = read("app/api/admin/upload/route.ts");
  assert.match(upload, /let replacementWasAuthorized = session\.role === "owner"/);
  assert.match(upload, /replacementWasAuthorized = true/);
  assert.match(upload, /replacementWasAuthorized && replaceUrl !== publicUrl/);
  assert.match(upload, /removeManagedMedia\(replaceUrl\)/);
});

test("Migration adds only non-destructive per-image lock columns", () => {
  const migration = read("supabase-migration-per-image-locks.sql");
  assert.match(migration, /anggota[\s\S]*foto_locked BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /galeri[\s\S]*is_locked BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /instagram_image_locked BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /tiktok_image_locked BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.doesNotMatch(migration, /DROP|DELETE|TRUNCATE/);
});
