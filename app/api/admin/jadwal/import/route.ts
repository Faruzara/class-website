import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getJadwal } from "@/lib/db";
import type { ApiResponse, JadwalItem, ScheduleImportItem } from "@/types";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

function readItem(value: unknown): ScheduleImportItem | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const item = {
    subject: String(source.subject ?? "").trim(),
    day: String(source.day ?? ""),
    week: Number(source.week),
    room: String(source.room ?? "").trim() || null,
    start_period: Number(source.start_period),
    end_period: Number(source.end_period),
  } as ScheduleImportItem;
  if (
    !item.subject || item.subject.length > 120
    || !DAYS.includes(item.day)
    || ![1, 2].includes(item.week)
    || (item.room?.length ?? 0) > 160
    || !Number.isInteger(item.start_period)
    || !Number.isInteger(item.end_period)
    || item.start_period < 1
    || item.end_period > 11
    || item.end_period < item.start_period
  ) return null;
  return item;
}

function keyOf(item: ScheduleImportItem) {
  return `${item.week}|${item.day}|${item.start_period}|${item.subject.toLocaleLowerCase("id-ID")}`;
}

function overlaps(left: ScheduleImportItem, right: ScheduleImportItem) {
  return left.week === right.week
    && left.day === right.day
    && left.start_period <= right.end_period
    && left.end_period >= right.start_period;
}

export async function POST(request: NextRequest) {
  const session = await getEditorSession("schedule");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { class_name?: unknown; mode?: unknown; items?: unknown } | null;
  const className = String(body?.class_name ?? "").trim().slice(0, 80);
  const mode = body?.mode === "replace" ? "replace" : body?.mode === "merge" ? "merge" : null;
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!className || !mode || !rawItems.length || rawItems.length > 200) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Data import tidak valid" }, { status: 400 });
  }

  const items = rawItems.map(readItem);
  if (items.some((item) => !item)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Ada jadwal hasil PDF yang tidak valid" }, { status: 400 });
  }
  const validItems = items as ScheduleImportItem[];
  const keys = validItems.map(keyOf);
  if (new Set(keys).size !== keys.length) {
    return NextResponse.json<ApiResponse>({ success: false, error: "PDF menghasilkan jadwal duplikat" }, { status: 400 });
  }
  for (let left = 0; left < validItems.length; left += 1) {
    for (let right = left + 1; right < validItems.length; right += 1) {
      if (overlaps(validItems[left], validItems[right])) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Jadwal PDF bertabrakan: ${validItems[left].day} Week ${validItems[left].week}` }, { status: 400 });
      }
    }
  }

  let current: JadwalItem[];
  try {
    current = await getJadwal();
  } catch {
    return NextResponse.json<ApiResponse>({ success: false, error: "Gagal membaca jadwal saat ini" }, { status: 500 });
  }

  if (mode === "replace") {
    const { error: deleteError } = await supabaseAdmin.from("jadwal").delete().not("id", "is", null);
    if (deleteError) return NextResponse.json<ApiResponse>({ success: false, error: "Gagal mengosongkan jadwal lama" }, { status: 500 });
    const { error: insertError } = await supabaseAdmin.from("jadwal").insert(validItems);
    if (insertError) {
      if (current.length) await supabaseAdmin.from("jadwal").insert(current.map(({ id: _id, ...item }) => item));
      return NextResponse.json<ApiResponse>({ success: false, error: "Import gagal; jadwal lama dipulihkan" }, { status: 500 });
    }
    await logActivity({ actor_role: session.role, actor_label: session.label, action: "schedule_imported", detail: `${className} · replace · ${validItems.length} blok` });
    return NextResponse.json<ApiResponse<{ inserted: number; updated: number; unchanged: number }>>({ success: true, data: { inserted: validItems.length, updated: 0, unchanged: 0 } });
  }

  const currentByKey = new Map(current.map((item) => [keyOf(item), item]));
  const importKeys = new Set(keys);
  const conflict = validItems.find((incoming) => current.some((item) => !importKeys.has(keyOf(item)) && overlaps(incoming, item)));
  if (conflict) {
    return NextResponse.json<ApiResponse>({ success: false, error: `${conflict.day} Week ${conflict.week} jam ke-${conflict.start_period} bertabrakan. Pilih Ganti Jadwal atau edit data lama.` }, { status: 409 });
  }

  const inserts = validItems.filter((item) => !currentByKey.has(keyOf(item)));
  const updates = validItems.filter((item) => {
    const saved = currentByKey.get(keyOf(item));
    return saved && (saved.room !== item.room || saved.end_period !== item.end_period);
  });
  if (inserts.length) {
    const { error } = await supabaseAdmin.from("jadwal").insert(inserts);
    if (error) return NextResponse.json<ApiResponse>({ success: false, error: "Gagal menambahkan hasil import" }, { status: 500 });
  }
  for (const item of updates) {
    const saved = currentByKey.get(keyOf(item))!;
    const { error } = await supabaseAdmin.from("jadwal").update({ room: item.room, end_period: item.end_period }).eq("id", saved.id);
    if (error) return NextResponse.json<ApiResponse>({ success: false, error: "Sebagian jadwal gagal diperbarui; jalankan import kembali" }, { status: 500 });
  }

  const unchanged = validItems.length - inserts.length - updates.length;
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "schedule_imported", detail: `${className} · merge · ${inserts.length} baru · ${updates.length} berubah` });
  return NextResponse.json<ApiResponse<{ inserted: number; updated: number; unchanged: number }>>({ success: true, data: { inserted: inserts.length, updated: updates.length, unchanged } });
}
