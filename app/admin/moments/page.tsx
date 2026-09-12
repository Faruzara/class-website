import { redirect } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import MomentDashboardActions from "@/components/admin/MomentDashboardActions";
import { getEditorSession } from "@/lib/auth";

export default async function AdminMomentsPage() {
  const session = await getEditorSession("moments");
  if (!session) redirect("/admin?forbidden=1");

  return (
    <AdminLayout role={session.role} permissions={session.permissions}>
      <header className="mb-7">
        <p className="section-kicker mb-2">Konten Publik</p>
        <h1 className="font-display text-3xl font-semibold text-gray-900">Moments</h1>
        <p className="mt-2 text-sm text-gray-600">Lihat Moment aktif atau ambil Moment baru. Penghapusan hanya tersedia untuk Owner.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <MomentDashboardActions showActive />
      </div>
    </AdminLayout>
  );
}
