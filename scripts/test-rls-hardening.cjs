const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.join(__dirname, "..", "supabase-migration-rls-hardening.sql"),
  "utf8",
);

const sensitiveTables = [
  "admin_slots",
  "temp_keys",
  "access_sessions",
  "activity_logs",
  "feedback_submissions",
  "moments",
  "moment_views",
];

const publicReadTables = ["pengumuman", "jadwal", "anggota", "galeri", "site_settings"];

test("RLS hardening covers and forces RLS on every application table", () => {
  for (const table of [...sensitiveTables, ...publicReadTables]) {
    assert.match(sql, new RegExp(`['\"]${table}['\"]`));
  }
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
});

test("client roles are reset before only public reads are granted", () => {
  assert.match(sql, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  const selectGrant = sql.match(
    /GRANT SELECT ON public\.pengumuman,[\s\S]*?public\.site_settings TO anon, authenticated;/,
  );
  assert.ok(selectGrant, "the five public content tables need an explicit SELECT grant");
  for (const table of sensitiveTables) {
    assert.doesNotMatch(selectGrant[0], new RegExp(`public\\.${table}\\b`));
  }
});

test("public policies expose only intended rows and never writes", () => {
  assert.match(sql, /public read visible announcements/);
  assert.match(sql, /pinned_until IS NULL OR pinned_until > now\(\)/);
  assert.match(sql, /created_at > now\(\) - INTERVAL '24 hours'/);
  assert.match(sql, /public read visible members/);
  assert.match(sql, /USING \(is_visible = TRUE\)/);
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]{0,120}FOR (?:INSERT|UPDATE|DELETE)/);
});

test("Moments RPCs and both media buckets remain server-only", () => {
  for (const signature of [
    "set_moment_lifetime()",
    "list_moments(BOOLEAN)",
    "list_unviewed_moments(UUID, INTEGER)",
    "mark_moment_viewed(UUID, UUID)",
  ]) {
    assert.ok(sql.includes(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`));
    assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`));
  }
  assert.match(sql, /CREATE POLICY "project media server only"/);
  assert.match(sql, /bucket_id NOT IN \('web-kelas', 'moments'\)/);
});
