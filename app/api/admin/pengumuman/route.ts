import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { createPengumuman } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { createPinnedUntil } from "@/lib/announcement-expiry";

export async function POST(req: NextRequest) {
  const session = await getEditorSession("homepage");
  if (!session) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { judul, konten, kategori, is_pinned } = body;
  const categories = new Set(["umum", "akademik", "kegiatan", "penting"]);

  if (!judul?.trim() || !konten?.trim() || judul.trim().length > 120 || konten.trim().length > 4000 || !categories.has(String(kategori ?? "umum"))) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Judul dan konten wajib diisi" },
      { status: 400 }
    );
  }

  const pengumuman = await createPengumuman({
    judul:      judul.trim(),
    konten:     konten.trim(),
    kategori:   kategori ?? "umum",
    is_pinned:  is_pinned === true,
    pinned_until: createPinnedUntil(is_pinned === true, body.pin_duration_hours),
    announcement_type: "admin",
    created_by: session.label,
  });

  await logActivity({
    actor_role:  session.role,
    actor_label: session.label,
    action:      "post_pengumuman",
    detail:      judul.trim(),
  });

  return NextResponse.json<ApiResponse<typeof pengumuman>>({ success: true, data: pengumuman });
}
