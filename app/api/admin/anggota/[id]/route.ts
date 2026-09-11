import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { deleteAnggota, isAnggotaRoleAvailable, updateAnggota } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { isManagedMediaUrl } from "@/lib/validation";
import { canonicalMemberRole } from "@/lib/member-roles";
import { supabaseAdmin } from "@/lib/supabase";
import { removeManagedMedia } from "@/lib/media-storage";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("members");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { data: current, error: currentError } = await supabaseAdmin.from("anggota").select("*").eq("id", id).maybeSingle();
  if (currentError) {
    const message = currentError.message.includes("foto_locked") ? "Jalankan supabase-migration-per-image-locks.sql di Supabase SQL Editor terlebih dahulu." : "Gagal membaca data anggota.";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
  if (!current) return NextResponse.json<ApiResponse>({ success: false, error: "Anggota tidak ditemukan" }, { status: 404 });
  const requestedRole = String(body.jabatan ?? "").trim();
  const jabatan = requestedRole ? canonicalMemberRole(requestedRole) : null;
  if (requestedRole && !jabatan) return NextResponse.json<ApiResponse>({ success: false, error: "Jabatan tidak valid" }, { status: 400 });
  if (jabatan && !(await isAnggotaRoleAvailable(jabatan, id))) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Slot ${jabatan} sudah terisi` }, { status: 409 });
  }
  const payload = {
    nama: String(body.nama ?? "").trim(),
    jabatan,
    foto_url: String(body.foto_url ?? "").trim() || null,
    is_visible: body.is_visible !== false,
    object_fit: (body.object_fit === "contain" ? "contain" : "cover") as "cover" | "contain",
    object_position_x: Math.max(0, Math.min(100, Number(body.object_position_x ?? 50))),
    object_position_y: Math.max(0, Math.min(100, Number(body.object_position_y ?? 50))),
    ...(session.role === "owner" && typeof body.foto_locked === "boolean" ? { foto_locked: body.foto_locked } : {}),
  };
  if (!payload.nama) return NextResponse.json<ApiResponse>({ success: false, error: "Nama wajib diisi" }, { status: 400 });
  if (payload.foto_url && !isManagedMediaUrl(payload.foto_url)) return NextResponse.json<ApiResponse>({ success: false, error: "URL foto tidak valid" }, { status: 400 });
  const changesLockedPhoto = payload.foto_url !== current.foto_url
    || payload.object_fit !== (current.object_fit ?? "cover")
    || payload.object_position_x !== Number(current.object_position_x ?? 50)
    || payload.object_position_y !== Number(current.object_position_y ?? 50);
  if (session.role !== "owner" && current.foto_locked && changesLockedPhoto) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Foto anggota ini sedang dikunci oleh Owner." }, { status: 423 });
  }
  await updateAnggota(id, payload);
  const lockChanged = session.role === "owner" && "foto_locked" in payload && payload.foto_locked !== current.foto_locked;
  await logActivity({ actor_role: session.role, actor_label: session.label, action: lockChanged ? "member_image_lock_changed" : "member_edited", detail: payload.nama });
  return NextResponse.json<ApiResponse>({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("members");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const { data: current, error } = await supabaseAdmin.from("anggota").select("foto_locked, foto_url").eq("id", id).maybeSingle();
  if (error) {
    const message = error.message.includes("foto_locked") ? "Jalankan supabase-migration-per-image-locks.sql di Supabase SQL Editor terlebih dahulu." : "Gagal membaca data anggota.";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }
  if (!current) return NextResponse.json<ApiResponse>({ success: false, error: "Anggota tidak ditemukan" }, { status: 404 });
  if (session.role !== "owner" && current.foto_locked) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Foto anggota ini sedang dikunci oleh Owner." }, { status: 423 });
  }
  await deleteAnggota(id);
  if (current.foto_url) await removeManagedMedia(current.foto_url).catch((reason) => console.error("Foto anggota gagal dibersihkan:", reason));
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "member_deleted", detail: `ID: ${id}` });
  return NextResponse.json<ApiResponse>({ success: true });
}
