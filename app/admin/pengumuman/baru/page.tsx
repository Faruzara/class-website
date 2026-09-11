import AdminLayout from "@/components/admin/AdminLayout";
import PengumumanForm from "@/components/admin/PengumumanForm";
import { getEditorSession } from "@/lib/auth";

export default async function PengumumanBaruPage() {
  const session = await getEditorSession();
  return (
    <AdminLayout role={session?.role} permissions={session?.permissions}>
      <div className="mb-6">
        <p className="text-xs font-mono text-gray-500 mb-1">/ admin / pengumuman / baru</p>
        <h1 className="font-display font-bold text-2xl text-gray-900">Buat Pengumuman</h1>
      </div>
      <PengumumanForm mode="baru" />
    </AdminLayout>
  );
}
