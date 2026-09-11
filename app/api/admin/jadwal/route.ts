import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { createJadwalItem, getJadwal } from "@/lib/db";
import type { ApiResponse, JadwalItem } from "@/types";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getEditorSession("schedule");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json<ApiResponse<JadwalItem[]>>({ success: true, data: await getJadwal() });
}

export async function POST(req: NextRequest) {
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
  } as Omit<JadwalItem, "id">;

  if (!item.subject || ![1, 2].includes(item.week) || !item.day || item.start_period < 1 || item.end_period < item.start_period) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Data jadwal tidak valid" }, { status: 400 });
  }

  const { data: overlap } = await supabaseAdmin
    .from("jadwal")
    .select("id")
    .eq("day", item.day)
    .eq("week", item.week)
    .lte("start_period", item.end_period)
    .gte("end_period", item.start_period)
    .limit(1);
  if (overlap?.length) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Periode tersebut bertabrakan dengan jadwal lain" }, { status: 409 });
  }

  await createJadwalItem(item);
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "schedule_changed", detail: `${item.subject} · ${item.day} · Week ${item.week}` });
  return NextResponse.json<ApiResponse>({ success: true });
}
