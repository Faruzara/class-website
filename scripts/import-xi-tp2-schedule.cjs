const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.");
  process.exit(1);
}

const schedule = [
  { subject: "Sejarah", day: "Senin", week: 1, room: null, start_period: 1, end_period: 2 },
  { subject: "B Jepang", day: "Senin", week: 1, room: "T11", start_period: 3, end_period: 4 },
  { subject: "B Indonesia", day: "Senin", week: 1, room: "T16", start_period: 5, end_period: 7 },
  { subject: "MTK", day: "Senin", week: 1, room: "T16", start_period: 8, end_period: 10 },
  { subject: "B Jepang", day: "Selasa", week: 1, room: "T3", start_period: 1, end_period: 2 },
  { subject: "PAI", day: "Selasa", week: 1, room: "MASJID R2", start_period: 3, end_period: 5 },
  { subject: "B Inggris", day: "Selasa", week: 1, room: "T16", start_period: 6, end_period: 9 },
  { subject: "B Jawa", day: "Selasa", week: 1, room: "T3", start_period: 10, end_period: 11 },
  { subject: "TP2", day: "Rabu", week: 1, room: "P15 - LAB. CNC", start_period: 1, end_period: 3 },
  { subject: "KIK", day: "Rabu", week: 1, room: "P12 - LAB. LAS", start_period: 4, end_period: 11 },
  { subject: "TP2", day: "Kamis", week: 1, room: "P13 - LAB. BUBUT", start_period: 1, end_period: 11 },
  { subject: "MTK", day: "Jumat", week: 1, room: "T16", start_period: 1, end_period: 3 },
  { subject: "BK", day: "Jumat", week: 1, room: null, start_period: 4, end_period: 4 },
  { subject: "PJOK", day: "Jumat", week: 1, room: "LAPANGAN 2", start_period: 5, end_period: 6 },
  { subject: "Sejarah", day: "Senin", week: 2, room: "T3", start_period: 1, end_period: 2 },
  { subject: "Pancasila", day: "Senin", week: 2, room: null, start_period: 3, end_period: 4 },
  { subject: "B Jawa", day: "Senin", week: 2, room: "T16", start_period: 5, end_period: 6 },
  { subject: "B Inggris", day: "Senin", week: 2, room: "T2", start_period: 7, end_period: 10 },
  { subject: "TP2", day: "Selasa", week: 2, room: "P13 - LAB. BUBUT", start_period: 1, end_period: 11 },
  { subject: "TP2", day: "Rabu", week: 2, room: "P15 - LAB. CNC", start_period: 1, end_period: 11 },
  { subject: "PAI", day: "Kamis", week: 2, room: "MASJID R2", start_period: 1, end_period: 3 },
  { subject: "BK", day: "Kamis", week: 2, room: "T3", start_period: 4, end_period: 4 },
  { subject: "Pancasila", day: "Kamis", week: 2, room: "T11", start_period: 5, end_period: 6 },
  { subject: "PJOK", day: "Kamis", week: 2, room: "LAPANGAN 2", start_period: 7, end_period: 8 },
  { subject: "B Indonesia", day: "Kamis", week: 2, room: "T16", start_period: 9, end_period: 11 },
  { subject: "KIK", day: "Jumat", week: 2, room: "P15 - LAB. CNC", start_period: 1, end_period: 2 },
  { subject: "GTK", day: "Jumat", week: 2, room: "P15 - LAB. CNC", start_period: 3, end_period: 6 },
];

const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const keyOf = (item) => `${item.week}|${item.day}|${item.start_period}|${item.subject}`;
const overlaps = (left, right) => left.week === right.week
  && left.day === right.day
  && left.start_period <= right.end_period
  && left.end_period >= right.start_period;

async function main() {
  const { data: existing, error: readError } = await client
    .from("jadwal")
    .select("id,subject,day,week,room,start_period,end_period");
  if (readError) throw readError;

  const existingByKey = new Map((existing ?? []).map((item) => [keyOf(item), item]));
  const sourceKeys = new Set(schedule.map(keyOf));
  const conflicts = schedule.flatMap((incoming) => (existing ?? [])
    .filter((current) => !sourceKeys.has(keyOf(current)) && overlaps(incoming, current))
    .map((current) => ({ incoming, current })));

  if (conflicts.length) {
    console.error("Import dibatalkan karena ada jadwal lain yang bertabrakan:");
    console.error(JSON.stringify(conflicts, null, 2));
    process.exit(1);
  }

  const inserts = schedule.filter((item) => !existingByKey.has(keyOf(item)));
  const updates = schedule.filter((item) => {
    const current = existingByKey.get(keyOf(item));
    return current && (current.room !== item.room || current.end_period !== item.end_period);
  });

  console.log(`${schedule.length} blok dari PDF: ${inserts.length} baru, ${updates.length} diperbarui, ${schedule.length - inserts.length - updates.length} sudah sesuai.`);
  if (!apply) {
    console.log("Dry-run saja. Tambahkan --apply untuk menyimpan ke Supabase.");
    return;
  }

  for (const item of updates) {
    const current = existingByKey.get(keyOf(item));
    const { error: updateError } = await client
      .from("jadwal")
      .update({ room: item.room, end_period: item.end_period })
      .eq("id", current.id);
    if (updateError) throw updateError;
  }

  if (inserts.length) {
    const { error: insertError } = await client.from("jadwal").insert(inserts);
    if (insertError) throw insertError;
  }
  console.log("Import jadwal XI TP2 selesai.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
