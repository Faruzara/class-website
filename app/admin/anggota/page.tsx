import AdminLayout from "@/components/admin/AdminLayout";
import MembersEditor from "@/components/admin/MembersEditor";
import { getEditorSession } from "@/lib/auth";
import { getAnggota } from "@/lib/db";

export default async function AdminAnggotaPage() {
  const [session, members] = await Promise.all([getEditorSession(), getAnggota(true).catch(() => [])]);
  return <AdminLayout role={session?.role} permissions={session?.permissions}><header className="mb-7"><p className="section-kicker mb-2">Konten Publik</p><h1 className="font-display text-3xl font-semibold text-gray-900">Anggota</h1><p className="mt-2 text-sm text-gray-600">Tambah, edit, sembunyikan, atau hapus anggota kelas dan struktur inti.</p></header><MembersEditor initialMembers={members} /></AdminLayout>;
}
