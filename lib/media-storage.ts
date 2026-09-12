import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

const SUPABASE_BUCKET = "web-kelas";
const SUPABASE_PUBLIC_MARKER = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
const CLOUDINARY_ENV_FOLDER = process.env.CLOUDINARY_ENV_FOLDER?.trim() || "prod";
const CLOUDINARY_ROOT = "web-kelas";

type PublicImageUpload = {
  bytes: Buffer;
  contentType: string;
  folder: string;
  fileName: string;
};

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Konfigurasi Cloudinary belum lengkap.");
  }
  return { cloudName, apiKey, apiSecret };
}

function cloudinaryAuth(apiKey: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

function cloudinaryPublicId(value: string): string | null {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const url = new URL(value);
    if (!cloudName || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return null;
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments[0] !== cloudName || segments[1] !== "image" || segments[2] !== "upload") return null;
    let assetSegments = segments.slice(3);
    if (/^v\d+$/.test(assetSegments[0] ?? "")) assetSegments = assetSegments.slice(1);
    if (assetSegments[0] !== CLOUDINARY_ROOT || assetSegments.length < 3) return null;
    const finalPart = assetSegments.at(-1);
    if (!finalPart) return null;
    assetSegments[assetSegments.length - 1] = finalPart.replace(/\.[a-z0-9]+$/i, "");
    return assetSegments.join("/");
  } catch {
    return null;
  }
}

async function uploadCloudinaryImage(input: PublicImageUpload): Promise<string> {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const publicId = `${CLOUDINARY_ROOT}/${CLOUDINARY_ENV_FOLDER}/${input.folder}/${input.fileName.replace(/\.[^.]+$/, "")}`;
  const form = new FormData();
  const uploadBytes = new Uint8Array(input.bytes.byteLength);
  uploadBytes.set(input.bytes);
  form.set("file", new Blob([uploadBytes], { type: input.contentType }), input.fileName);
  form.set("public_id", publicId);
  form.set("overwrite", "false");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    headers: { Authorization: cloudinaryAuth(apiKey, apiSecret) },
    body: form,
  });
  const result = await response.json().catch(() => null) as { secure_url?: string; error?: { message?: string } } | null;
  if (!response.ok || !result?.secure_url) {
    throw new Error(result?.error?.message || "Upload Cloudinary gagal.");
  }
  return result.secure_url;
}

export async function uploadPublicImage(input: PublicImageUpload): Promise<string> {
  if (process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase() === "cloudinary") {
    return uploadCloudinaryImage(input);
  }

  const path = `${input.folder}/${input.fileName}`;
  const { error } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).upload(path, input.bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) throw error;
  return supabaseAdmin.storage.from(SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeManagedMedia(value: string): Promise<void> {
  if (!value) return;
  if (value.includes(SUPABASE_PUBLIC_MARKER)) {
    const path = decodeURIComponent(value.split(SUPABASE_PUBLIC_MARKER)[1] ?? "");
    if (path && !path.includes("..")) {
      const { error } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).remove([path]);
      if (error) throw error;
    }
    return;
  }

  const publicId = cloudinaryPublicId(value);
  if (!publicId) return;
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("invalidate", "true");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
    method: "POST",
    headers: { Authorization: cloudinaryAuth(apiKey, apiSecret) },
    body: form,
  });
  const result = await response.json().catch(() => null) as { result?: string; error?: { message?: string } } | null;
  if (!response.ok || !result || !["ok", "not found"].includes(result.result ?? "")) {
    throw new Error(result?.error?.message || "Penghapusan media Cloudinary gagal.");
  }
}
