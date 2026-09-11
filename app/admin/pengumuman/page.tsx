import { getPengumuman } from "@/lib/db";
import AdminLayout from "@/components/admin/AdminLayout";
import Link from "next/link";
import { Plus, Pin, Pencil, Trash2 } from "lucide-react";
import type { Pengumuman } from "@/types";
import DeletePengumumanButton from "@/components/admin/DeletePengumumanButton";
import { getEditorSession } from "@/lib/auth";
import { isAnnouncementVisible } from "@/lib/announcement-expiry";

const KATEGORI_COLOR: Record<Pengumuman["kategori"], string> = {
  umum:     "badge-umum",
  akademik: "badge-akademik",
  kegiatan: "badge-kegiatan",
  penting:  "badge-penting",
};

export default async function AdminPengumumanPage() {
  const session = await getEditorSession();
  const list = await getPengumuman("admin", { includeExpired: true });

  return (
    <AdminLayout role={session?.role} permissions={session?.permissions}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-mono text-gray-500 mb-1">/ admin / pengumuman</p>
          <h1 className="font-display font-bold text-2xl text-gray-900">Pengumuman</h1>
        </div>
        <Link href="/admin/pengumuman/baru" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Buat Baru
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-16 text-gray-500">
          Belum ada pengumuman. Buat yang pertama!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((p) => (
            <div key={p.id} className="card flex items-start gap-3">
              {p.is_pinned && <Pin size={14} className="text-rose-400 shrink-0 mt-1" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.judul}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(p.created_at).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                  {" "}· oleh {p.created_by}
                  {!isAnnouncementVisible(p) ? " · expired" : p.is_pinned && p.pinned_until ? ` · pinned sampai ${new Date(p.pinned_until).toLocaleDateString("id-ID")}` : ""}
                </p>
              </div>
              <span className={`badge ${KATEGORI_COLOR[p.kategori]} shrink-0`}>
                {p.kategori}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/admin/pengumuman/${p.id}/edit`}
                  className="p-2 rounded-lg text-gray-500 hover:text-brand-600 hover:bg-brand-500/10 transition-colors"
                >
                  <Pencil size={15} />
                </Link>
                <DeletePengumumanButton id={p.id} judul={p.judul} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
