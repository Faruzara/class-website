"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import type { Pengumuman } from "@/types";
import { PIN_DURATION_OPTIONS, remainingPinDuration } from "@/lib/announcement-expiry";

interface Props {
  initial?: Partial<Pengumuman>;
  mode: "baru" | "edit";
  id?: string;
}

const KATEGORI_OPTIONS: Pengumuman["kategori"][] = ["umum", "akademik", "kegiatan", "penting"];

export default function PengumumanForm({ initial, mode, id }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    judul:    initial?.judul    ?? "",
    konten:   initial?.konten   ?? "",
    kategori: initial?.kategori ?? "umum" as Pengumuman["kategori"],
    is_pinned: initial?.is_pinned ?? false,
    pin_duration_hours: remainingPinDuration(initial?.pinned_until),
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function update(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.judul.trim() || !form.konten.trim()) {
      setError("Judul dan konten wajib diisi.");
      return;
    }

    start(async () => {
      const url    = mode === "baru" ? "/api/admin/pengumuman" : `/api/admin/pengumuman/${id}`;
      const method = mode === "baru" ? "POST" : "PATCH";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (data.success) {
        router.push("/admin/pengumuman");
        router.refresh();
      } else {
        setError(data.error ?? "Gagal menyimpan.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
      {/* Judul */}
      <div>
        <label className="block text-sm text-gray-600 mb-1.5">Judul <span className="text-rose-400">*</span></label>
        <input
          type="text"
          className="input"
          value={form.judul}
          onChange={(e) => update("judul", e.target.value)}
          placeholder="Judul pengumuman"
          disabled={isPending}
          maxLength={120}
        />
      </div>

      {/* Konten */}
      <div>
        <label className="block text-sm text-gray-600 mb-1.5">Konten <span className="text-rose-400">*</span></label>
        <textarea
          className="input resize-none"
          rows={6}
          value={form.konten}
          onChange={(e) => update("konten", e.target.value)}
          placeholder="Isi pengumuman..."
          disabled={isPending}
        />
      </div>

      {/* Kategori + Pin */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-36">
          <label className="block text-sm text-gray-600 mb-1.5">Kategori</label>
          <select
            className="input"
            value={form.kategori}
            onChange={(e) => update("kategori", e.target.value)}
            disabled={isPending}
          >
            {KATEGORI_OPTIONS.map((k) => (
              <option key={k} value={k} className="bg-surface-card capitalize">{k}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-40 flex-col justify-end gap-1.5">
          <label className="flex min-h-11 items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => update("is_pinned", e.target.checked)}
              className="w-4 h-4 accent-brand-500"
              disabled={isPending}
            />
            <span className="text-sm text-gray-600">Pinned</span>
          </label>
          {form.is_pinned ? <select aria-label="Durasi pin" className="input" value={form.pin_duration_hours} onChange={(event) => update("pin_duration_hours", Number(event.target.value))} disabled={isPending}>
            {PIN_DURATION_OPTIONS.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}
          </select> : null}
        </div>
      </div>

      {error && (
        <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={isPending}>
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {mode === "baru" ? "Posting" : "Simpan Perubahan"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={isPending}
        >
          Batal
        </button>
      </div>
    </form>
  );
}
