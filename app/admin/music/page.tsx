import { redirect } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import MusicManager from "@/components/admin/MusicManager";
import { getEditorSession } from "@/lib/auth";
import { getMusicSettings, getMusicTracks } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function AdminMusicPage() {
  const session = await getEditorSession();
  if (!session || session.role === "temp_admin") redirect("/admin?forbidden=1");
  const [tracks, settings] = await Promise.all([getMusicTracks().catch(() => []), getMusicSettings().catch(() => null)]);
  return <AdminLayout role={session.role} permissions={session.permissions}><header className="mb-7"><p className="section-kicker mb-2">Konten</p><h1 className="font-display text-3xl font-semibold text-gray-900">Music</h1><p className="mt-2 text-sm text-gray-600">Kelola lagu SoundCloud yang muncul di dock publik.</p></header><MusicManager initial={{ tracks, clientIdConfigured: Boolean(settings?.soundcloud_client_id), status: settings?.soundcloud_client_id_status ?? "unchecked", checkedAt: settings?.soundcloud_client_id_checked_at ?? null }} /></AdminLayout>;
}
