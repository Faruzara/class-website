import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { addGaleriFoto, getGaleriPage, getNextGaleriUrutan } from "@/lib/db";
import type { ApiResponse, GaleriFoto } from "@/types";
import { isManagedMediaUrl } from "@/lib/validation";
import { GALLERY_CAPTION_MAX_LENGTH, GALLERY_MANAGEMENT_PAGE_SIZE, GALLERY_TITLE_MAX_LENGTH } from "@/lib/gallery-constants";
import { parseGalleryFocus } from "@/lib/gallery-focus";

function galleryError(reason: unknown) {
  console.error("Gallery request failed:", reason);
  const missingFocusColumns = typeof reason === "object" && reason !== null
    && "message" in reason && typeof reason.message === "string"
    && reason.message.includes("object_position_");
  return NextResponse.json<ApiResponse>({ success: false, error: missingFocusColumns
    ? "Kolom fokus Gallery belum tersedia. Jalankan supabase-migration-gallery-focus.sql di Supabase SQL Editor terlebih dahulu."
    : "Gallery gagal diproses. Silakan coba lagi." }, { status: 500 });
}

type GalleryPageResponse = { items: GaleriFoto[]; total: number; nextOffset: number | null };

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getEditorSession("gallery");
    if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
    const offset = boundedInteger(req.nextUrl.searchParams.get("offset"), 0, 0, 1_000_000);
    const limit = boundedInteger(req.nextUrl.searchParams.get("limit"), GALLERY_MANAGEMENT_PAGE_SIZE, 1, 48);
    const page = await getGaleriPage(offset, limit);
    const consumed = offset + page.items.length;
    return NextResponse.json<ApiResponse<GalleryPageResponse>>({
      success: true,
      data: { ...page, nextOffset: page.items.length > 0 && consumed < page.total ? consumed : null },
    });
  } catch (reason) {
    return galleryError(reason);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getEditorSession("gallery");
    if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
    const payload: unknown = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json<ApiResponse>({ success: false, error: "Data Gallery tidak valid" }, { status: 400 });
    const body = payload as Record<string, unknown>;
    const focus = parseGalleryFocus({ object_position_x: body.object_position_x, object_position_y: body.object_position_y });
    if (!focus) return NextResponse.json<ApiResponse>({ success: false, error: "Posisi fokus harus berupa angka antara 0 dan 100" }, { status: 400 });
    const judul = String(body.judul ?? "").trim();
    const deskripsi = String(body.deskripsi ?? "").trim();
    const fotoUrl = String(body.foto_url ?? "").trim();
    if (!fotoUrl) return NextResponse.json<ApiResponse>({ success: false, error: "Foto wajib diisi" }, { status: 400 });
    if (judul.length > GALLERY_TITLE_MAX_LENGTH) return NextResponse.json<ApiResponse>({ success: false, error: `Judul maksimal ${GALLERY_TITLE_MAX_LENGTH} karakter` }, { status: 400 });
    if (deskripsi.length > GALLERY_CAPTION_MAX_LENGTH) return NextResponse.json<ApiResponse>({ success: false, error: `Caption maksimal ${GALLERY_CAPTION_MAX_LENGTH} karakter` }, { status: 400 });
    if (!isManagedMediaUrl(fotoUrl)) return NextResponse.json<ApiResponse>({ success: false, error: "URL foto tidak valid" }, { status: 400 });

    const nextOrder = await getNextGaleriUrutan();
    const photo = await addGaleriFoto({
      judul,
      deskripsi: deskripsi || null,
      foto_url: fotoUrl,
      thumbnail_url: null,
      kategori: null,
      urutan: nextOrder,
      ...focus,
    });
    await logActivity({ actor_role: session.role, actor_label: session.label, action: "gallery_upload", detail: judul || "Tanpa judul" })
      .catch((reason) => console.error("Gallery saved, but activity log failed:", reason));
    return NextResponse.json<ApiResponse<GaleriFoto>>({ success: true, data: photo });
  } catch (reason) {
    return galleryError(reason);
  }
}
