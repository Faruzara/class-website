import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { deleteJadwalItem, updateJadwalItem } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse, JadwalItem } from "@/types";
import { isScheduleColor } from "@/components/schedule/schedule-colors";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("schedule");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const item = {
    subject: String(body.subject ?? "").trim(),
    day: body.day,
    week: Number(body.week),
    room: String(body.room ?? "").trim() || null,
    start_period: Number(body.start_period),
    end_period: Number(body.end_period),
    color_override: body.color_override == null || body.color_override === "" ? null : body.color_override,
  } as Omit<JadwalItem, "id">;

  if (
    !item.subject
    || ![1, 2].includes(item.week)
    || !DAYS.includes(item.day)
    || !Number.isInteger(item.start_period)
    || !Number.isInteger(item.end_period)
    || item.start_period < 1
    || item.end_period > 11
    || item.end_period < item.start_period
    || (item.color_override !== null && !isScheduleColor(item.color_override))
  ) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Data jadwal tidak valid" }, { status: 400 });
  }

  const { data: overlap } = await supabaseAdmin
    .from("jadwal")
    .select("id")
    .eq("day", item.day)
    .eq("week", item.week)
    .neq("id", id)
    .lte("start_period", item.end_period)
    .gte("end_period", item.start_period)
    .limit(1);
  if (overlap?.length) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Jam pelajaran tersebut bertabrakan dengan jadwal lain" }, { status: 409 });
  }

  let updated: boolean;
  try {
    updated = await updateJadwalItem(id, item);
  } catch (error) {
    const missingColorColumn = error && typeof error === "object" && "code" in error && error.code === "PGRST204";
    return NextResponse.json<ApiResponse>({ success: false, error: missingColorColumn ? "Jalankan supabase-migration-schedule-color.sql terlebih dahulu." : "Gagal mengubah jadwal" }, { status: 500 });
  }
  if (!updated) return NextResponse.json<ApiResponse>({ success: false, error: "Jadwal tidak ditemukan" }, { status: 404 });
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "schedule_changed", detail: `Edit ${item.subject} · ${item.day} · Week ${item.week}` });
  return NextResponse.json<ApiResponse>({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("schedule");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  await deleteJadwalItem(id);
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "schedule_changed", detail: `Hapus ID: ${id}` });
  return NextResponse.json<ApiResponse>({ success: true });
}
