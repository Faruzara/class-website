import { NextRequest, NextResponse } from "next/server";
import { getEditorSession } from "@/lib/auth";
import { deleteMusicTrack, updateMusicTrack } from "@/lib/db";
import type { ApiResponse, MusicTrack } from "@/types";

async function allowed() { const session = await getEditorSession(); return Boolean(session && session.role !== "temp_admin"); }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await allowed()) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json() as Partial<MusicTrack>;
    const payload: Partial<Pick<MusicTrack, "position" | "is_active">> = {};
    if (typeof body.position === "number" && Number.isInteger(body.position) && body.position >= 0) payload.position = body.position;
    if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
    const track = await updateMusicTrack(id, payload);
    return NextResponse.json<ApiResponse<MusicTrack>>({ success: true, data: track });
  } catch { return NextResponse.json<ApiResponse>({ success: false, error: "Gagal memperbarui musik." }, { status: 500 }); }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await allowed()) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  try { await deleteMusicTrack((await params).id); return NextResponse.json<ApiResponse>({ success: true }); }
  catch { return NextResponse.json<ApiResponse>({ success: false, error: "Gagal menghapus musik." }, { status: 500 }); }
}
