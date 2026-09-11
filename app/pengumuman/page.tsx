import PublicLayout from "@/components/layout/PublicLayout";
import { getPengumuman } from "@/lib/db";
import type { Pengumuman } from "@/types";

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const KATEGORI_CONFIG = {
  umum:     { label: "Umum",     class: "badge-umum" },
  akademik: { label: "Akademik", class: "badge-akademik" },
  kegiatan: { label: "Kegiatan", class: "badge-kegiatan" },
  penting:  { label: "Penting",  class: "badge-penting" },
};

export const revalidate = 60; // ISR: revalidate tiap 60 detik

export default async function PengumumanPage() {
  const pengumuman = await getPengumuman().catch(() => []);
  const pinned  = pengumuman.filter((p) => p.is_pinned);
  const regular = pengumuman.filter((p) => !p.is_pinned);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="mb-10 font-display text-4xl font-bold text-gray-900 sm:text-5xl">Pengumuman</h1>

        {/* Pengumuman pinned */}
        {pinned.length > 0 && (
          <div className="mb-8">
            <p className="text-xs text-gray-500 font-mono mb-3">— DIPINNED</p>
            <div className="flex flex-col gap-3">
              {pinned.map((p) => (
                <PengumumanCard key={p.id} data={p} highlight />
              ))}
            </div>
          </div>
        )}

        {/* Semua pengumuman */}
        {regular.length > 0 ? (
          <div className="flex flex-col gap-3">
            {regular.map((p) => (
              <PengumumanCard key={p.id} data={p} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-16">
            Belum ada pengumuman.
          </p>
        )}
      </div>
    </PublicLayout>
  );
}

function PengumumanCard({ data, highlight }: { data: Pengumuman; highlight?: boolean }) {
  const kat = KATEGORI_CONFIG[data.kategori];

  return (
    <div className={`card ${highlight ? "border-brand-500/40 bg-brand-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="font-display font-semibold text-gray-900 text-lg leading-snug">
          {data.judul}
        </h2>
        <span className={`badge ${kat.class} shrink-0`}>{kat.label}</span>
      </div>
      {/* Konten — bisa diupgrade ke markdown renderer nanti */}
      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
        {data.konten}
      </p>
      <div className="flex items-center gap-2 mt-4">
        <p className="text-xs text-gray-500">
          {new Date(data.created_at).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </p>
        <span className="text-gray-700">·</span>
        <p className="text-xs text-gray-500">oleh {data.announcement_type === "system" ? "System" : data.created_by}</p>
      </div>
    </div>
  );
}
