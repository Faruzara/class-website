const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Cloudinary remains opt-in and Supabase stays the default provider", () => {
  const storage = read("lib/media-storage.ts");
  const env = read(".env.example");
  assert.match(storage, /MEDIA_STORAGE_PROVIDER/);
  assert.match(storage, /=== "cloudinary"/);
  assert.match(storage, /supabaseAdmin\.storage\.from\(SUPABASE_BUCKET\)/);
  assert.match(env, /MEDIA_STORAGE_PROVIDER=supabase/);
});

test("Cloudinary credentials stay server-side and uploads use HTTPS", () => {
  const storage = read("lib/media-storage.ts");
  assert.match(storage, /CLOUDINARY_API_SECRET/);
  assert.doesNotMatch(storage, /NEXT_PUBLIC_CLOUDINARY_API_SECRET/);
  assert.match(storage, /https:\/\/api\.cloudinary\.com\/v1_1/);
  assert.match(storage, /Authorization: cloudinaryAuth/);
});

test("Managed public media supports both providers while Moments remain private", () => {
  const validation = read("lib/validation.ts");
  const upload = read("app/api/admin/upload/route.ts");
  const moments = read("lib/moments-publish.ts");
  assert.match(validation, /isSupabaseMediaUrl\(value\) \|\| isCloudinaryMediaUrl\(value\)/);
  assert.match(upload, /uploadPublicImage/);
  assert.match(moments, /momentsStore\.storage\.from\(MOMENT_BUCKET\)/);
});

test("Delete and replacement cleanup route through the matching provider", () => {
  const storage = read("lib/media-storage.ts");
  const upload = read("app/api/admin/upload/route.ts");
  const gallery = read("app/api/admin/galeri/[id]/route.ts");
  const member = read("app/api/admin/anggota/[id]/route.ts");
  assert.match(storage, /SUPABASE_PUBLIC_MARKER/);
  assert.match(storage, /cloudinaryPublicId/);
  assert.match(storage, /image\/destroy/);
  assert.match(upload, /removeManagedMedia\(replaceUrl\)/);
  assert.match(gallery, /removeManagedMedia\(photo\.foto_url\)/);
  assert.match(member, /removeManagedMedia\(current\.foto_url\)/);
});
