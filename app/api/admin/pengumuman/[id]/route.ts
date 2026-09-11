import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { updatePengumuman, deletePengumuman, getPengumumanById } from "@/lib/db";
import type { ApiResponse, Pengumuman } from "@/types";
import { createPinnedUntil } from "@/lib/announcement-expiry";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getEditorSession("homepage");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const current = await getPengumumanById(id);
  if (!current) return NextResponse.json<ApiResponse>({ success: false, error: "Pengumuman tidak ditemukan" }, { status: 404 });
  if (current.announcement_type === "system") return NextResponse.json<ApiResponse>({ success: false, error: "System Update hanya dapat dikelola dari Owner." }, { status: 403 });

  const body = await req.json();
  const judul = String(body.judul ?? "").trim();
  const konten = String(body.konten ?? "").trim();
  const categories = new Set(["umum", "akademik", "kegiatan", "penting"]);
  if (!judul || !konten || judul.length > 120 || konten.length > 4000 || !categories.has(String(body.kategori))) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Data pengumuman tidak valid" }, { status: 400 });
  }
  const pinnedUntil = createPinnedUntil(body.is_pinned === true, body.pin_duration_hours);
  await updatePengumuman(id, { judul, konten, kategori: body.kategori as Pengumuman["kategori"], is_pinned: body.is_pinned === true, pinned_until: pinnedUntil });

  await logActivity({
    actor_role:  session.role,
    actor_label: session.label,
    action:      "edit_pengumuman",
    detail:      `ID: ${id}`,
  });

  return NextResponse.json<ApiResponse<Pengumuman>>({ success: true, data: { ...current, judul, konten, kategori: body.kategori as Pengumuman["kategori"], is_pinned: body.is_pinned === true, pinned_until: pinnedUntil, updated_at: new Date().toISOString() } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getEditorSession("homepage");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const current = await getPengumumanById(id);
  if (!current) return NextResponse.json<ApiResponse>({ success: false, error: "Pengumuman tidak ditemukan" }, { status: 404 });
  if (current.announcement_type === "system") return NextResponse.json<ApiResponse>({ success: false, error: "System Update hanya dapat dikelola dari Owner." }, { status: 403 });

  await deletePengumuman(id);

  await logActivity({
    actor_role:  session.role,
    actor_label: session.label,
    action:      "hapus_pengumuman",
    detail:      `ID: ${id}`,
  });

  return NextResponse.json<ApiResponse>({ success: true });
}
