import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings } from "@/lib/db";
import type { ApiResponse, SiteSettings } from "@/types";
import { isManagedMediaUrl, isSafeGithubUrl, isSafeSocialUrl } from "@/lib/validation";

const SETTINGS_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs = SETTINGS_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Supabase request timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  try {
    const session = await withTimeout(getEditorSession("homepage"), SETTINGS_TIMEOUT_MS);
    if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

    const settings = await withTimeout(getSiteSettings());
    return NextResponse.json<ApiResponse<SiteSettings | null>>({ success: true, data: settings });
  } catch (error) {
    console.error("[GET /api/admin/settings]", error);
    return NextResponse.json<ApiResponse>({ success: false, error: "Gagal mengambil pengaturan" }, { status: 500 });
  }
}

async function updateSettings(req: NextRequest) {
  try {
    const session = await withTimeout(getEditorSession("homepage"), SETTINGS_TIMEOUT_MS);
    if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if ("creator_github_url" in body && session.role !== "owner") {
      return NextResponse.json<ApiResponse>({ success: false, error: "Hanya Owner yang dapat mengubah profil creator." }, { status: 403 });
    }
    if ("hero_image_locked" in body && session.role !== "owner") {
      return NextResponse.json<ApiResponse>({ success: false, error: "Hanya Owner yang dapat mengunci foto utama." }, { status: 403 });
    }
    if (("instagram_image_locked" in body || "tiktok_image_locked" in body) && session.role !== "owner") {
      return NextResponse.json<ApiResponse>({ success: false, error: "Hanya Owner yang dapat mengunci gambar sosial." }, { status: 403 });
    }
    const currentSettings = await withTimeout(getSiteSettings());
    if (session.role !== "owner" && currentSettings?.hero_image_locked && "hero_image_url" in body) {
      const requestedHero = typeof body.hero_image_url === "string" ? body.hero_image_url.trim() || null : null;
      if (requestedHero !== currentSettings.hero_image_url) {
        return NextResponse.json<ApiResponse>({ success: false, error: "Foto utama sedang dikunci oleh Owner." }, { status: 423 });
      }
    }
    if (session.role !== "owner" && currentSettings?.instagram_image_locked && "instagram_image_url" in body) {
      const requested = typeof body.instagram_image_url === "string" ? body.instagram_image_url.trim() || null : null;
      if (requested !== currentSettings.instagram_image_url) return NextResponse.json<ApiResponse>({ success: false, error: "Gambar Instagram sedang dikunci oleh Owner." }, { status: 423 });
    }
    if (session.role !== "owner" && currentSettings?.tiktok_image_locked && "tiktok_image_url" in body) {
      const requested = typeof body.tiktok_image_url === "string" ? body.tiktok_image_url.trim() || null : null;
      if (requested !== currentSettings.tiktok_image_url) return NextResponse.json<ApiResponse>({ success: false, error: "Gambar TikTok sedang dikunci oleh Owner." }, { status: 423 });
    }
    const allowed = ["hero_image_url", "about_text", "instagram_url", "instagram_image_url", "instagram_image_locked", "tiktok_url", "tiktok_image_url", "tiktok_image_locked", "creator_github_url", "hero_object_fit", "hero_object_position_x", "hero_object_position_y", "hero_image_locked"] as const;
    const payload: Partial<SiteSettings> = {};

    for (const key of allowed) {
      if (key in body) {
        const value = body[key];
        if (key === "hero_image_locked" || key === "instagram_image_locked" || key === "tiktok_image_locked") {
          if (typeof value !== "boolean") {
            return NextResponse.json<ApiResponse>({ success: false, error: "Status kunci foto utama tidak valid" }, { status: 400 });
          }
          (payload as Record<string, unknown>)[key] = value;
          continue;
        }
        if (["hero_object_position_x", "hero_object_position_y"].includes(key)) {
          const numeric = Number(value);
          if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
            return NextResponse.json<ApiResponse>({ success: false, error: `Field ${key} tidak valid` }, { status: 400 });
          }
          (payload as Record<string, unknown>)[key] = Math.round(numeric);
          continue;
        }
        if (value !== null && typeof value !== "string") {
          return NextResponse.json<ApiResponse>({ success: false, error: `Field ${key} tidak valid` }, { status: 400 });
        }
        (payload as Record<string, unknown>)[key] = typeof value === "string" ? value.trim() || null : null;
      }
    }

    if (payload.hero_object_fit !== undefined && payload.hero_object_fit !== "cover" && payload.hero_object_fit !== "contain") {
      return NextResponse.json<ApiResponse>({ success: false, error: "Pengaturan tampilan foto utama tidak valid" }, { status: 400 });
    }

    if (typeof payload.about_text !== "undefined" && !payload.about_text) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Tentang Kelas tidak boleh kosong" }, { status: 400 });
    }
    if (payload.about_text && payload.about_text.length > 500) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Tentang Kelas maksimal 500 karakter" }, { status: 400 });
    }
    if (payload.hero_image_url && !isManagedMediaUrl(payload.hero_image_url)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Foto utama harus berasal dari storage project ini" }, { status: 400 });
    }
    if (payload.instagram_url && !isSafeSocialUrl(payload.instagram_url, "instagram")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "URL Instagram tidak valid" }, { status: 400 });
    }
    if (payload.instagram_image_url && !isManagedMediaUrl(payload.instagram_image_url)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Latar Instagram harus berasal dari storage project ini" }, { status: 400 });
    }
    if (payload.tiktok_url && !isSafeSocialUrl(payload.tiktok_url, "tiktok")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "URL TikTok tidak valid" }, { status: 400 });
    }
    if (payload.tiktok_image_url && !isManagedMediaUrl(payload.tiktok_image_url)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Latar TikTok harus berasal dari storage project ini" }, { status: 400 });
    }
    if (payload.creator_github_url && !isSafeGithubUrl(payload.creator_github_url)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "URL GitHub tidak valid" }, { status: 400 });
    }

    await withTimeout(updateSiteSettings(payload));
    await withTimeout(logActivity({
      actor_role: session.role,
      actor_label: session.label,
      action: body.hero_image_locked !== undefined ? "hero_image_lock_changed" : body.instagram_image_locked !== undefined || body.tiktok_image_locked !== undefined ? "social_image_lock_changed" : body.creator_github_url !== undefined ? "creator_profile_changed" : body.hero_image_url !== undefined ? "hero_or_homepage_changed" : "social_link_changed",
      detail: `Field: ${Object.keys(payload).join(", ")}`,
    }));

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    console.error("[UPDATE /api/admin/settings]", error);
    if (error && typeof error === "object" && "code" in error && error.code === "PGRST204" && "message" in error && String(error.message).includes("tiktok_image_url")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Jalankan supabase-migration-tiktok-card.sql di Supabase SQL Editor terlebih dahulu." }, { status: 500 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "PGRST204" && "message" in error && String(error.message).includes("instagram_image_url")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Jalankan supabase-migration-instagram-card.sql di Supabase SQL Editor terlebih dahulu." }, { status: 500 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "PGRST204" && "message" in error && String(error.message).includes("hero_image_locked")) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Jalankan supabase-migration-hero-image-lock.sql di Supabase SQL Editor terlebih dahulu." }, { status: 500 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "PGRST204" && "message" in error && /instagram_image_locked|tiktok_image_locked/.test(String(error.message))) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Jalankan supabase-migration-per-image-locks.sql di Supabase SQL Editor terlebih dahulu." }, { status: 500 });
    }
    return NextResponse.json<ApiResponse>({ success: false, error: "Gagal menyimpan pengaturan" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return updateSettings(req);
}

// Kompatibilitas dengan alur lama yang masih mengirim POST.
export async function POST(req: NextRequest) {
  return updateSettings(req);
}
