const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(...parts) {
  return fs.readFileSync(path.join(__dirname, "..", ...parts), "utf8");
}

const db = read("lib", "db.ts");
const route = read("app", "api", "admin", "galeri", "route.ts");
const editor = read("components", "admin", "GalleryEditor.tsx");
const adminPage = read("app", "admin", "galeri", "page.tsx");
const ownerPage = read("app", "owner", "content", "[section]", "page.tsx");

test("Gallery management reads stable pages and lightweight totals", () => {
  assert.match(db, /export async function getGaleriPage/);
  assert.match(db, /select\("\*", \{ count: "exact" \}\)[\s\S]*order\("urutan"[\s\S]*order\("created_at"[\s\S]*order\("id"[\s\S]*\.range\(from, from \+ pageSize - 1\)/);
  assert.match(db, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(route, /getNextGaleriUrutan\(\)/);
  assert.doesNotMatch(route, /getGaleri\(\)/);
});

test("Admin and Owner initially load only one management page", () => {
  assert.match(adminPage, /getGaleriPage\(0, GALLERY_MANAGEMENT_PAGE_SIZE\)/);
  assert.match(ownerPage, /getGaleriPage\(0, GALLERY_MANAGEMENT_PAGE_SIZE\)/);
  assert.match(adminPage, /initialTotal=\{gallery\.total\}/);
  assert.match(ownerPage, /galleryTotal=\{gallery\.total\}/);
});

test("Gallery editor loads more safely across local add and delete operations", () => {
  assert.match(editor, /nextOffsetRef/);
  assert.match(editor, /pagedIdsRef/);
  assert.match(editor, /loadPendingRef/);
  assert.match(editor, /new Set\(current\.map\(\(photo\) => photo\.id\)\)/);
  assert.match(editor, /Muat foto berikutnya/);
  assert.match(editor, /setTotal\(\(current\) => current \+ 1\)/);
  assert.match(editor, /nextOffsetRef\.current = Math\.max\(0, nextOffsetRef\.current - 1\)/);
});
