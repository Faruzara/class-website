import { notFound } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import PengumumanForm from "@/components/admin/PengumumanForm";
import { getEditorSession } from "@/lib/auth";
import { getPengumumanById } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditPengumumanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, announcement] = await Promise.all([getEditorSession("homepage"), getPengumumanById(id)]);
  if (!announcement || announcement.announcement_type !== "admin") notFound();

  return (
    <AdminLayout role={session?.role} permissions={session?.permissions}>
      <header className="mb-7">
        <p className="section-kicker mb-2">Konten Publik</p>
        <h1 className="font-display text-3xl font-semibold text-gray-900">Edit Pengumuman</h1>
      </header>
      <PengumumanForm mode="edit" id={announcement.id} initial={announcement} />
    </AdminLayout>
  );
}
