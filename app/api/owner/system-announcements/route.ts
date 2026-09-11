import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession, logActivity } from "@/lib/auth";
import { createPengumuman } from "@/lib/db";
import { isMissingSupabaseColumn } from "@/lib/supabase-compat";
import type { ApiResponse, Pengumuman } from "@/types";
import { createPinnedUntil } from "@/lib/announcement-expiry";

const CATEGORIES = new Set(["umum", "akademik", "kegiatan", "penting"]);

export async function POST(request: NextRequest) {
  const owner = await getOwnerSession();
  const origin = request.headers.get("origin");
  if (!owner || (origin && origin !== request.nextUrl.origin)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const judul = String(body?.judul ?? "").trim();
  const konten = String(body?.konten ?? "").trim();
  const kategori = CATEGORIES.has(String(body?.kategori)) ? String(body?.kategori) as Pengumuman["kategori"] : "umum";
  if (!judul || !konten || judul.length > 120 || konten.length > 4000) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Judul atau isi System Update tidak valid." }, { status: 400 });
  }

  try {
    const announcement = await createPengumuman({
      judul,
      konten,
      kategori,
      is_pinned: body?.is_pinned === true,
      pinned_until: createPinnedUntil(body?.is_pinned === true, body?.pin_duration_hours),
      announcement_type: "system",
      created_by: "System",
    });
    await logActivity({ actor_role: "owner", actor_label: owner.label, action: "system_announcement_created", detail: judul });
    return NextResponse.json<ApiResponse<Pengumuman>>({ success: true, data: announcement });
  } catch (error) {
    const message = isMissingSupabaseColumn(error, "announcement_type")
      ? "Jalankan supabase-migration-notifications-feedback.sql terlebih dahulu."
      : "System Update gagal disimpan.";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
}
