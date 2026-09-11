import AdminLayout from "@/components/admin/AdminLayout";
import { SettingsEditor } from "@/components/admin/HomepageEditor";
import { getEditorSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/db";

export default async function AdminSettingsPage() {
  const [session, settings] = await Promise.all([getEditorSession(), getSiteSettings().catch(() => null)]);
  return <AdminLayout role={session?.role} permissions={session?.permissions}><header className="mb-7"><p className="section-kicker mb-2">Konfigurasi</p><h1 className="font-display text-3xl font-semibold text-gray-900">Settings</h1><p className="mt-2 text-sm text-gray-600">Social link hanya tampil di publik jika URL diisi.</p></header><SettingsEditor settings={settings} /></AdminLayout>;
}
