import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { deleteGaleriFoto } from "@/lib/db";
import type { ApiResponse, GaleriFoto } from "@/types";
import { supabaseAdmin } from "@/lib/supabase";
import { removeManagedMedia } from "@/lib/media-storage";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("gallery");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const { data: photo } = await supabaseAdmin.from("galeri").select("foto_url, is_locked").eq("id", id).maybeSingle();
  if (!photo) return NextResponse.json<ApiResponse>({ success: false, error: "Foto tidak ditemukan" }, { status: 404 });
  if (session.role !== "owner" && photo.is_locked) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Foto ini sedang dikunci oleh Owner." }, { status: 423 });
  }
  await deleteGaleriFoto(id);
  if (photo.foto_url) await removeManagedMedia(photo.foto_url).catch((error) => console.error("File Gallery gagal dibersihkan:", error));
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "gallery_delete", detail: `ID: ${id}` });
  return NextResponse.json<ApiResponse>({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("gallery");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json<ApiResponse>({ success: false, error: "Hanya Owner yang dapat mengubah kunci foto." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.is_locked !== "boolean") return NextResponse.json<ApiResponse>({ success: false, error: "Status kunci tidak valid" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("galeri").update({ is_locked: body.is_locked }).eq("id", id).select("*").maybeSingle();
  if (error) {
    const message = error.message.includes("is_locked") ? "Jalankan supabase-migration-per-image-locks.sql di Supabase SQL Editor terlebih dahulu." : "Gagal mengubah kunci foto.";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
  if (!data) return NextResponse.json<ApiResponse>({ success: false, error: "Foto tidak ditemukan" }, { status: 404 });
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "gallery_image_lock_changed", detail: `${body.is_locked ? "Dikunci" : "Dibuka"}: ${data.judul || id}` });
  return NextResponse.json<ApiResponse<GaleriFoto>>({ success: true, data });
}
