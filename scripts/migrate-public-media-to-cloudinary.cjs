// Dry run: npm run media:migrate:dry
// Apply:   npm run media:migrate
// Supabase source files are intentionally retained for rollback.
const fs = require("node:fs");
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.resolve(__dirname, "..");
const PAGE_SIZE = 500;
const CLOUDINARY_ROOT = "web-kelas";

function parseOptions(argv) {
  const apply = argv.includes("--apply");
  const rawConcurrency = argv.find((value) => value.startsWith("--concurrency="))?.split("=")[1];
  const parsedConcurrency = rawConcurrency === undefined ? 3 : Number.parseInt(rawConcurrency, 10);
  const concurrency = Math.max(1, Math.min(6, Number.isFinite(parsedConcurrency) ? parsedConcurrency : 3));
  return { apply, concurrency };
}

function isSupabasePublicUrl(value, supabaseUrl) {
  if (!value || !supabaseUrl) return false;
  try {
    const source = new URL(value);
    const project = new URL(supabaseUrl);
    return source.protocol === "https:"
      && source.hostname === project.hostname
      && source.pathname.includes("/storage/v1/object/public/web-kelas/");
  } catch {
    return false;
  }
}

function supabaseStoragePath(value) {
  const marker = "/storage/v1/object/public/web-kelas/";
  try {
    const url = new URL(value);
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const storagePath = decodeURIComponent(url.pathname.slice(index + marker.length));
    return storagePath && !storagePath.includes("..") ? storagePath : null;
  } catch {
    return null;
  }
}

function safeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function publicIdFor(target) {
  return `${CLOUDINARY_ROOT}/${target.folder}/${safeId(target.table)}-${safeId(target.id)}-${safeId(target.column)}`;
}

async function fetchAllRows(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns).order("id").range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function collectTargets(client, supabaseUrl) {
  const targets = [];
  const { data: settings, error: settingsError } = await client
    .from("site_settings")
    .select("id,hero_image_url,instagram_image_url,tiktok_image_url")
    .eq("id", 1)
    .maybeSingle();
  if (settingsError) throw settingsError;

  for (const [column, folder] of [
    ["hero_image_url", "hero"],
    ["instagram_image_url", "social"],
    ["tiktok_image_url", "social"],
  ]) {
    const oldUrl = settings?.[column];
    if (isSupabasePublicUrl(oldUrl, supabaseUrl)) targets.push({
      table: "site_settings",
      id: 1,
      column,
      folder,
      oldUrl,
      fallbackFile: column === "hero_image_url" ? path.join(ROOT, "public", "images", "hero-workshop.png") : null,
    });
  }

  const members = await fetchAllRows(client, "anggota", "id,nama,foto_url");
  for (const member of members) {
    if (isSupabasePublicUrl(member.foto_url, supabaseUrl)) {
      targets.push({ table: "anggota", id: member.id, column: "foto_url", folder: "anggota", oldUrl: member.foto_url, label: member.nama });
    }
  }

  const gallery = await fetchAllRows(client, "galeri", "id,judul,foto_url,thumbnail_url");
  for (const photo of gallery) {
    for (const column of ["foto_url", "thumbnail_url"]) {
      if (isSupabasePublicUrl(photo[column], supabaseUrl)) {
        targets.push({ table: "galeri", id: photo.id, column, folder: "galeri", oldUrl: photo[column], label: photo.judul });
      }
    }
  }
  return targets;
}

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET wajib diisi.");
  return { cloudName, apiKey, apiSecret };
}

async function uploadRemoteImage(target, config, client) {
  const publicId = publicIdFor(target);
  const authorization = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  async function upload(file) {
    const form = new FormData();
    form.set("file", file);
    form.set("public_id", publicId);
    form.set("overwrite", "true");
    form.set("invalidate", "false");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {
      method: "POST",
      headers: { Authorization: `Basic ${authorization}` },
      body: form,
    });
    const result = await response.json().catch(() => null);
    return { response, result };
  }

  let { response, result } = await upload(target.oldUrl);
  if ((!response.ok || !result?.secure_url) && result?.error?.message?.includes("Error in loading")) {
    const storagePath = supabaseStoragePath(target.oldUrl);
    if (!storagePath) throw new Error("Path sumber Supabase tidak valid.");
    const stored = await client.storage.from("web-kelas").download(storagePath);
    if (!stored.error && stored.data) {
      ({ response, result } = await upload(stored.data));
    } else if (target.fallbackFile && fs.existsSync(target.fallbackFile)) {
      const bytes = fs.readFileSync(target.fallbackFile);
      ({ response, result } = await upload(new Blob([bytes], { type: "image/png" })));
    } else {
      throw new Error(`Sumber Supabase tidak dapat diunduh: ${stored.error?.message || "file tidak ditemukan"}.`);
    }
  }
  if (!response.ok || !result?.secure_url) throw new Error(result?.error?.message || `Cloudinary HTTP ${response.status}`);
  return { publicId, newUrl: result.secure_url, assetId: result.asset_id || null };
}

async function updateTarget(client, target, newUrl) {
  const { data, error } = await client
    .from(target.table)
    .update({ [target.column]: newUrl })
    .eq("id", target.id)
    .eq(target.column, target.oldUrl)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Record berubah selama migrasi; URL tidak ditimpa.");
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function writeManifest(entries) {
  const directory = path.join(ROOT, "migration-reports");
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = path.join(directory, `cloudinary-${stamp}.json`);
  fs.writeFileSync(output, `${JSON.stringify({ createdAt: new Date().toISOString(), sourceFilesRetained: true, entries }, null, 2)}\n`);
  return output;
}

async function main() {
  loadEnvConfig(ROOT);
  const options = parseOptions(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) throw new Error("Konfigurasi service role Supabase belum lengkap.");
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const targets = await collectTargets(client, supabaseUrl);

  console.log(`${options.apply ? "APPLY" : "DRY RUN"}: ${targets.length} file publik Supabase ditemukan.`);
  const counts = targets.reduce((result, target) => ({ ...result, [target.folder]: (result[target.folder] || 0) + 1 }), {});
  for (const [folder, count] of Object.entries(counts)) console.log(`- ${folder}: ${count}`);
  if (!options.apply || targets.length === 0) {
    if (!options.apply) console.log("Tidak ada upload atau perubahan database. Jalankan npm run media:migrate untuk memulai migrasi.");
    return;
  }

  const config = cloudinaryConfig();
  const entries = await mapWithConcurrency(targets, options.concurrency, async (target, index) => {
    const base = { table: target.table, id: target.id, column: target.column, oldUrl: target.oldUrl, label: target.label || null };
    try {
      const uploaded = await uploadRemoteImage(target, config, client);
      await updateTarget(client, target, uploaded.newUrl);
      console.log(`[${index + 1}/${targets.length}] OK ${target.table}.${target.column} ${target.id}`);
      return { ...base, ...uploaded, status: "migrated" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${index + 1}/${targets.length}] GAGAL ${target.table}.${target.column} ${target.id}: ${message}`);
      return { ...base, publicId: publicIdFor(target), status: "failed", error: message };
    }
  });

  const manifest = writeManifest(entries);
  const migrated = entries.filter((entry) => entry.status === "migrated").length;
  const failed = entries.length - migrated;
  console.log(`Selesai: ${migrated} berhasil, ${failed} gagal.`);
  console.log(`Manifest rollback: ${path.relative(ROOT, manifest)}`);
  console.log("File sumber Supabase tidak dihapus.");
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = { isSupabasePublicUrl, parseOptions, publicIdFor, safeId, supabaseStoragePath };
