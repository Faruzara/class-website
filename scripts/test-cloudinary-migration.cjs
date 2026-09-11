const test = require("node:test");
const assert = require("node:assert/strict");
const { isSupabasePublicUrl, parseOptions, publicIdFor, safeId, supabaseStoragePath } = require("./migrate-public-media-to-cloudinary.cjs");

const projectUrl = "https://project.supabase.co";
const sourceUrl = `${projectUrl}/storage/v1/object/public/web-kelas/galeri/photo.jpg`;

test("only the project's public web-kelas assets are migration sources", () => {
  assert.equal(isSupabasePublicUrl(sourceUrl, projectUrl), true);
  assert.equal(isSupabasePublicUrl("https://other.supabase.co/storage/v1/object/public/web-kelas/galeri/photo.jpg", projectUrl), false);
  assert.equal(isSupabasePublicUrl("https://res.cloudinary.com/demo/image/upload/web-kelas/galeri/photo.jpg", projectUrl), false);
  assert.equal(isSupabasePublicUrl("javascript:alert(1)", projectUrl), false);
  assert.equal(supabaseStoragePath(sourceUrl), "galeri/photo.jpg");
  assert.equal(supabaseStoragePath(`${projectUrl}/storage/v1/object/public/web-kelas/../secret.jpg`), null);
});

test("migration is dry-run by default and concurrency is bounded", () => {
  assert.deepEqual(parseOptions([]), { apply: false, concurrency: 3 });
  assert.deepEqual(parseOptions(["--apply", "--concurrency=99"]), { apply: true, concurrency: 6 });
  assert.deepEqual(parseOptions(["--concurrency=0"]), { apply: false, concurrency: 1 });
});

test("public IDs are deterministic and remain inside the project folder", () => {
  const target = { table: "galeri", id: "ABC 123", column: "foto_url", folder: "galeri" };
  assert.equal(publicIdFor(target), "web-kelas/galeri/galeri-abc-123-foto_url");
  assert.equal(safeId("../Unsafe Value"), "unsafe-value");
});

test("remote import has a byte-upload fallback for sources Cloudinary cannot fetch", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "migrate-public-media-to-cloudinary.cjs"), "utf8");
  assert.match(source, /includes\("Error in loading"\)/);
  assert.match(source, /client\.storage\.from\("web-kelas"\)\.download\(storagePath\)/);
  assert.match(source, /upload\(stored\.data\)/);
  assert.match(source, /hero-workshop\.png/);
  assert.match(source, /target\.fallbackFile && fs\.existsSync/);
});
