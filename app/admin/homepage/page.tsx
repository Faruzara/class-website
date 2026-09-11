import AdminLayout from "@/components/admin/AdminLayout";
import { HomepageEditor } from "@/components/admin/HomepageEditor";
import { getEditorSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/db";

export default async function AdminHomepagePage() {
  const [session, settings] = await Promise.all([getEditorSession(), getSiteSettings().catch(() => null)]);
  return <AdminLayout role={session?.role} permissions={session?.permissions}><PageHeader title="Homepage" description="Atur foto utama dan teks Tentang Kelas yang tampil di halaman publik." /><HomepageEditor settings={settings} /></AdminLayout>;
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return <header className="mb-7"><p className="section-kicker mb-2">Konten Publik</p><h1 className="font-display text-3xl font-semibold text-gray-900">{title}</h1><p className="mt-2 text-sm text-gray-600">{description}</p></header>;
}
