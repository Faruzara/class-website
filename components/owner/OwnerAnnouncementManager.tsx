"use client";

import { useMemo, useState } from "react";
import { Bell, Loader2, Pencil, Pin, Plus, Save, Trash2, X } from "lucide-react";
import type { AnnouncementType, ApiResponse, Pengumuman } from "@/types";
import { isAnnouncementVisible, PIN_DURATION_OPTIONS, remainingPinDuration } from "@/lib/announcement-expiry";

const EMPTY = { judul: "", konten: "", kategori: "umum" as Pengumuman["kategori"], is_pinned: false, pin_duration_hours: 168 };

export default function OwnerAnnouncementManager({ initialAnnouncements }: { initialAnnouncements: Pengumuman[] }) {
  const [items, setItems] = useState(initialAnnouncements);
  const [source, setSource] = useState<AnnouncementType>("admin");
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const visibleItems = useMemo(() => items.filter((item) => item.announcement_type === source), [items, source]);

  function reset(nextSource = source) {
    setSource(nextSource);
    setForm(EMPTY);
    setEditingId(null);
    setError("");
  }

  function edit(item: Pengumuman) {
    setSource(item.announcement_type);
    setEditingId(item.id);
    setForm({ judul: item.judul, konten: item.konten, kategori: item.kategori, is_pinned: item.is_pinned, pin_duration_hours: remainingPinDuration(item.pinned_until) });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const base = source === "system" ? "/api/owner/system-announcements" : "/api/admin/pengumuman";
    try {
      const response = await fetch(editingId ? `${base}/${editingId}` : base, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json() as ApiResponse<Pengumuman>;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Pengumuman gagal disimpan.");
      if (editingId && result.data) {
        setItems((current) => current.map((item) => item.id === editingId ? result.data! : item));
      } else if (result.data) {
        setItems((current) => [result.data!, ...current]);
      }
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengumuman gagal disimpan.");
    } finally {
      setPending(false);
    }
  }

  async function remove(item: Pengumuman) {
    if (pending || !window.confirm(`Hapus “${item.judul}”?`)) return;
    setPending(true);
    setError("");
    const base = item.announcement_type === "system" ? "/api/owner/system-announcements" : "/api/admin/pengumuman";
    try {
      const response = await fetch(`${base}/${item.id}`, { method: "DELETE" });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Pengumuman gagal dihapus.");
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      if (editingId === item.id) reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengumuman gagal dihapus.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="inline-flex border border-surface-border bg-white p-1" aria-label="Sumber pengumuman">
        {(["admin", "system"] as const).map((type) => (
          <button key={type} type="button" onClick={() => reset(type)} className={`min-h-9 px-4 text-xs font-semibold ${source === type ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
            {type === "admin" ? "Admin" : "System"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-4 border-y border-surface-border py-6 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Judul</label>
            <input required maxLength={120} className="input" value={form.judul} onChange={(event) => setForm({ ...form, judul: event.target.value })} placeholder={source === "system" ? "Contoh: Pembaruan Gallery" : "Judul pengumuman"} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Isi</label>
            <textarea required maxLength={4000} className="input min-h-32 resize-y" value={form.konten} onChange={(event) => setForm({ ...form, konten: event.target.value })} placeholder={source === "system" ? "Ringkasan bug fix atau fitur baru..." : "Isi pengumuman..."} />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Kategori</label>
            <select className="input" value={form.kategori} onChange={(event) => setForm({ ...form, kategori: event.target.value as Pengumuman["kategori"] })}>
              <option value="umum">Umum</option><option value="akademik">Akademik</option><option value="kegiatan">Kegiatan</option><option value="penting">Penting</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 border-y border-surface-border text-xs text-gray-600"><input type="checkbox" checked={form.is_pinned} onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })} /> Pin di bagian atas</label>
          {form.is_pinned ? <div><label className="mb-1.5 block text-xs font-medium text-gray-600">Durasi pin</label><select className="input" value={form.pin_duration_hours} onChange={(event) => setForm({ ...form, pin_duration_hours: Number(event.target.value) })}>{PIN_DURATION_OPTIONS.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></div> : null}
          <div className="flex gap-2">
            <button disabled={pending} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 bg-brand-600 px-4 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? <Loader2 size={15} className="animate-spin" /> : editingId ? <Save size={15} /> : <Plus size={15} />}{editingId ? "Simpan" : "Terbitkan"}
            </button>
            {editingId ? <button type="button" onClick={() => reset()} className="grid size-10 place-items-center border border-surface-border text-gray-500" aria-label="Batalkan edit"><X size={16} /></button> : null}
          </div>
        </div>
        {source === "system" ? <p className="text-xs leading-5 text-gray-500 sm:col-span-2">Di halaman publik, pembuat selalu ditampilkan sebagai <strong className="font-semibold text-gray-700">System</strong>. Identitas Owner tidak ditampilkan.</p> : null}
        {error ? <p role="alert" className="text-xs text-rose-700 sm:col-span-2">{error}</p> : null}
      </form>

      <div className="divide-y divide-surface-border border-y border-surface-border">
        {visibleItems.length ? visibleItems.map((item) => (
          <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2">{item.is_pinned ? <Pin size={13} className="text-brand-600" /> : <Bell size={13} className="text-gray-400" />}<h3 className="truncate text-sm font-semibold text-gray-900">{item.judul}</h3></div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.konten}</p>
              <p className="mt-2 font-mono text-[10px] uppercase text-gray-400">{item.kategori} / {new Date(item.created_at).toLocaleDateString("id-ID")}{item.is_pinned && item.pinned_until ? ` / pinned sampai ${new Date(item.pinned_until).toLocaleDateString("id-ID")}` : ""}{!isAnnouncementVisible(item) ? " / expired" : ""}</p>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => edit(item)} className="grid size-9 place-items-center text-gray-500 hover:text-brand-700" aria-label={`Edit ${item.judul}`}><Pencil size={15} /></button>
              <button type="button" onClick={() => remove(item)} className="grid size-9 place-items-center text-gray-500 hover:text-rose-700" aria-label={`Hapus ${item.judul}`}><Trash2 size={15} /></button>
            </div>
          </article>
        )) : <p className="py-10 text-center text-sm text-gray-500">Belum ada pengumuman {source === "system" ? "System" : "Admin"}.</p>}
      </div>
    </div>
  );
}
