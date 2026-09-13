import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { createMusicTrack, getMusicSettings, getMusicTracks, updateMusicSettings } from "@/lib/db";
import { isSoundCloudAuthError, resolveSoundCloudTrack, searchSoundCloud, testSoundCloudClientId } from "@/lib/soundcloud";
import type { ApiResponse, MusicTrack, SoundCloudTrackResult } from "@/types";

async function authorized() {
  const session = await getEditorSession();
  return session && session.role !== "temp_admin" ? session : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!await authorized()) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
    const query = req.nextUrl.searchParams.get("q")?.trim();
    const settings = await getMusicSettings();
    if (!query) {
      const tracks = await getMusicTracks();
      return NextResponse.json({ success: true, data: { tracks, clientIdConfigured: Boolean(settings?.soundcloud_client_id), status: settings?.soundcloud_client_id_status ?? "unchecked", checkedAt: settings?.soundcloud_client_id_checked_at ?? null } });
    }
    if (query.length < 2 || query.length > 100) return NextResponse.json<ApiResponse>({ success: false, error: "Pencarian harus 2-100 karakter." }, { status: 400 });
    if (!settings?.soundcloud_client_id) return NextResponse.json<ApiResponse>({ success: false, error: "Isi client ID SoundCloud terlebih dahulu." }, { status: 409 });
    try {
      const results = await searchSoundCloud(query, settings.soundcloud_client_id);
      await updateMusicSettings({ soundcloud_client_id_status: "valid", soundcloud_client_id_checked_at: new Date().toISOString() });
      return NextResponse.json<ApiResponse<SoundCloudTrackResult[]>>({ success: true, data: results });
    } catch (error) {
      const expired = isSoundCloudAuthError(error);
      await updateMusicSettings({ soundcloud_client_id_status: expired ? "expired" : "error", soundcloud_client_id_checked_at: new Date().toISOString() });
      return NextResponse.json<ApiResponse>({ success: false, error: expired ? "Client ID ditolak atau sudah kedaluwarsa. Ganti melalui pengaturan musik." : "SoundCloud sedang tidak dapat dihubungi." }, { status: expired ? 401 : 502 });
    }
  } catch (error) {
    console.error("[GET /api/admin/music]", error);
    return NextResponse.json<ApiResponse>({ success: false, error: "Gagal memuat musik. Pastikan migrasi musik sudah dijalankan." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authorized();
    if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
    const body = await req.json() as { action?: string; clientId?: string; url?: string; track?: SoundCloudTrackResult };
    if (body.action === "save-client-id") {
      const clientId = body.clientId?.trim();
      if (!clientId || clientId.length > 300) return NextResponse.json<ApiResponse>({ success: false, error: "Client ID tidak valid." }, { status: 400 });
      try {
        await testSoundCloudClientId(clientId);
        await updateMusicSettings({ soundcloud_client_id: clientId, soundcloud_client_id_status: "valid", soundcloud_client_id_checked_at: new Date().toISOString() });
        return NextResponse.json({ success: true, data: { status: "valid" } });
      } catch (error) {
        const status = isSoundCloudAuthError(error) ? "expired" : "error";
        await updateMusicSettings({ soundcloud_client_id: clientId, soundcloud_client_id_status: status, soundcloud_client_id_checked_at: new Date().toISOString() });
        return NextResponse.json<ApiResponse>({ success: false, error: status === "expired" ? "Client ID ditolak atau sudah kedaluwarsa." : "Client ID tersimpan, tetapi belum dapat diverifikasi." }, { status: status === "expired" ? 400 : 502 });
      }
    }
    const metadata = await resolveSoundCloudTrack(body.track?.soundcloud_url ?? body.url);
    const tracks = await getMusicTracks();
    const track = await createMusicTrack({ ...metadata, position: tracks.length, is_active: true });
    await logActivity({ actor_role: session.role, actor_label: session.label, action: "music_track_added", detail: track.title });
    return NextResponse.json<ApiResponse<MusicTrack>>({ success: true, data: track }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/music]", error);
    const duplicate = error && typeof error === "object" && "code" in error && error.code === "23505";
    return NextResponse.json<ApiResponse>({ success: false, error: duplicate ? "Lagu ini sudah ada di playlist." : error instanceof Error && error.message.includes("URL SoundCloud") ? error.message : "Gagal menambahkan musik." }, { status: duplicate ? 409 : 500 });
  }
}
