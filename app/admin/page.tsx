import { getEditorSession } from "@/lib/auth";
import { getPengumuman, getAnggota, getGaleriCount, getActiveTempKeys } from "@/lib/db";
import AdminLayout from "@/components/admin/AdminLayout";
import MomentDashboardActions from "@/components/admin/MomentDashboardActions";
import Link from "next/link";
import { Bell, Users, Image, Key, Plus } from "lucide-react";
import { canUseEditorFeature } from "@/lib/access-control";

export default async function AdminDashboardPage() {
  const session = await getEditorSession();

  // Ambil data ringkasan
  const [pengumuman, anggota, galeri, tempKeys] = await Promise.all([
    getPengumuman(),
    getAnggota(true),  // termasuk yang hidden
    getGaleriCount(),
    // Temp key hanya bisa dilihat oleh admin biasa, bukan temp_admin
    session?.role === "admin" ? getActiveTempKeys() : Promise.resolve([]),
  ]);

  const cards = [
    { href: "/admin/pengumuman", icon: Bell, label: "Pengumuman", count: pengumuman.length, color: "text-brand-600", bg: "bg-brand-500/10", permission: "homepage" as const },
    { href: "/admin/anggota", icon: Users, label: "Anggota", count: anggota.length, color: "text-emerald-400", bg: "bg-emerald-500/10", permission: "members" as const },
    { href: "/admin/galeri", icon: Image, label: "Galeri", count: galeri, color: "text-cyan-400", bg: "bg-cyan-500/10", permission: "gallery" as const },
  ].filter((card) => canUseEditorFeature(session, card.permission));

  return (
    <AdminLayout role={session?.role} permissions={session?.permissions}>
      {/* Sambutan */}
      <div className="mb-8">
        <p className="text-xs font-mono text-gray-500 mb-1">Selamat datang,</p>
        <h1 className="font-display font-bold text-2xl text-gray-900">
          {session?.label}
          {session?.role === "temp_admin" && (
            <span className="ml-2 text-sm font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Temp Admin
            </span>
          )}
        </h1>
        {session?.role === "temp_admin" && session.expires_at && (
          <p className="text-xs text-amber-500 mt-1">
            Akses berakhir:{" "}
            {new Date(session.expires_at).toLocaleTimeString("id-ID", {
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map(({ href, icon: Icon, label, count, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="card hover:border-surface-border/80 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-4"
          >
            <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
              <Icon size={22} className={color} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-gray-900">{count}</p>
              <p className="text-sm text-gray-600">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Aksi cepat */}
      <div className="mb-8">
        <h2 className="text-sm font-mono text-gray-500 mb-3">— AKSI CEPAT</h2>
        <div className="flex flex-wrap gap-3">
          {canUseEditorFeature(session, "homepage") && <Link href="/admin/pengumuman/baru" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Pengumuman Baru
          </Link>}
          {/* Temp admin tidak bisa generate temp key */}
          {session?.role === "admin" && (
            <Link href="/admin/temp-key" className="btn-secondary flex items-center gap-2 text-sm">
              <Key size={16} /> Generate Temp Key
            </Link>
          )}
          {canUseEditorFeature(session, "moments") && <MomentDashboardActions />}
        </div>
      </div>

      {/* Temp key aktif — hanya tampil untuk admin biasa */}
      {session?.role === "admin" && tempKeys.length > 0 && (
        <div>
          <h2 className="text-sm font-mono text-gray-500 mb-3">— TEMP KEY AKTIF</h2>
          <div className="flex flex-col gap-2">
            {tempKeys.map((tk) => (
              <div key={tk.id} className="card flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{tk.label}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Expired:{" "}
                    {new Date(tk.expires_at).toLocaleTimeString("id-ID", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full font-mono">
                  Aktif
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
