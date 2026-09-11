import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApiResponse } from "@/types";
import { canUploadToFolder } from "@/lib/access-control";
import { getSiteSettings } from "@/lib/db";
import { removeManagedMedia, uploadPublicImage } from "@/lib/media-storage";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function POST(req: NextRequest) {
  const session = await getEditorSession();
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const requestedFolder = form.get("folder");
  const replaceUrl = form.get("replace_url");
  const protectedKind = String(form.get("protected_kind") ?? "");
  const protectedId = String(form.get("protected_id") ?? "");
  const folder = ["hero", "anggota", "galeri", "social"].includes(String(requestedFolder))
    ? String(requestedFolder)
    : "uploads";
  let replacementWasAuthorized = session.role === "owner";
  if (!canUploadToFolder(session, folder)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Permission upload tidak tersedia." }, { status: 403 });
  }
  if (folder === "hero" && session.role !== "owner") {
    try {
      const settings = await getSiteSettings();
      if (settings?.hero_image_locked) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Foto utama sedang dikunci oleh Owner." }, { status: 423 });
      }
    } catch {
      return NextResponse.json<ApiResponse>({ success: false, error: "Status kunci foto utama belum dapat diperiksa." }, { status: 503 });
    }
  }
  if (session.role !== "owner" && protectedKind) {
    try {
      let locked = false;
      if (protectedKind === "member" && protectedId) {
        const { data, error } = await supabaseAdmin.from("anggota").select("foto_locked").eq("id", protectedId).maybeSingle();
        if (error) throw error;
        locked = Boolean(data?.foto_locked);
      } else if (protectedKind === "gallery" && protectedId) {
        const { data, error } = await supabaseAdmin.from("galeri").select("is_locked").eq("id", protectedId).maybeSingle();
        if (error) throw error;
        locked = Boolean(data?.is_locked);
      } else if (protectedKind === "instagram" || protectedKind === "tiktok") {
        const settings = await getSiteSettings();
        locked = protectedKind === "instagram" ? Boolean(settings?.instagram_image_locked) : Boolean(settings?.tiktok_image_locked);
      }
      if (locked) return NextResponse.json<ApiResponse>({ success: false, error: "Gambar ini sedang dikunci oleh Owner." }, { status: 423 });
      replacementWasAuthorized = true;
    } catch {
      return NextResponse.json<ApiResponse>({ success: false, error: "Status kunci gambar belum dapat diperiksa." }, { status: 503 });
    }
  }

  if (!(file instanceof File)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "File gambar wajib dipilih" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_SIZE) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Gunakan JPG, PNG, atau WebP maksimal 4 MB" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES.get(file.type)!;
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  let publicUrl: string;
  try {
    publicUrl = await uploadPublicImage({ bytes, contentType: file.type, folder, fileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload media gagal.";
    return NextResponse.json<ApiResponse>({ success: false, error: message }, { status: 500 });
  }

  // Hapus file lama hanya jika URL benar-benar berasal dari bucket project ini.
  if (typeof replaceUrl === "string" && replaceUrl) {
    if (replacementWasAuthorized && replaceUrl !== publicUrl) {
      await removeManagedMedia(replaceUrl).catch((error) => console.error("Media lama gagal dibersihkan:", error));
    }
  }

  await logActivity({
    actor_role: session.role,
    actor_label: session.label,
    action: "upload_media",
    detail: `Folder: ${folder}`,
  });

  return NextResponse.json<ApiResponse<{ url: string }>>({ success: true, data: { url: publicUrl } });
}
