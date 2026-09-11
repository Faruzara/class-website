import AdminLayout from "@/components/admin/AdminLayout";
import ScheduleEditor from "@/components/admin/ScheduleEditor";
import { getEditorSession } from "@/lib/auth";
import { getJadwal } from "@/lib/db";

export default async function AdminJadwalPage() {
  const [session, items] = await Promise.all([getEditorSession(), getJadwal().catch(() => [])]);
  return <AdminLayout role={session?.role} permissions={session?.permissions}><header className="mb-7"><p className="section-kicker mb-2">Konten Publik</p><h1 className="font-display text-3xl font-semibold text-gray-900">Jadwal</h1><p className="mt-2 text-sm text-gray-600">Kelola jadwal Week 1 dan Week 2 berdasarkan jam pelajaran ke-1 sampai ke-11.</p></header><ScheduleEditor initialItems={items} /></AdminLayout>;
}
