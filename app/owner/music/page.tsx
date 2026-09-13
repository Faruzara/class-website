import { redirect } from "next/navigation";
import MusicManager from "@/components/admin/MusicManager";
import { getOwnerSession } from "@/lib/auth";
import { getMusicSettings, getMusicTracks } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function OwnerMusicPage() {
  if (!await getOwnerSession()) redirect("/owner/login");
  const [tracks, settings] = await Promise.all([getMusicTracks().catch(() => []), getMusicSettings().catch(() => null)]);
  return <section><header className="mb-7"><p className="section-kicker mb-2">Content</p><h1 className="font-display text-3xl font-semibold text-gray-900">Music</h1><p className="mt-2 text-sm text-gray-600">Kelola playlist SoundCloud publik.</p></header><MusicManager initial={{ tracks, actorRole: "owner", clientIdConfigured: Boolean(settings?.soundcloud_client_id), status: settings?.soundcloud_client_id_status ?? "unchecked", checkedAt: settings?.soundcloud_client_id_checked_at ?? null }} /></section>;
}
