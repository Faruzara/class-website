"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import MediaUpload from "./MediaUpload";
import type { ApiResponse, GaleriFoto } from "@/types";
import { GALLERY_CAPTION_MAX_LENGTH, GALLERY_MANAGEMENT_PAGE_SIZE, GALLERY_TITLE_MAX_LENGTH } from "@/lib/gallery-constants";
import { DEFAULT_GALLERY_FOCUS } from "@/lib/gallery-focus";

const EMPTY_GALLERY_FORM = { judul: "", deskripsi: "", foto_url: "", ...DEFAULT_GALLERY_FOCUS };

async function readGalleryResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(`Server tidak mengirim respons (${response.status}). Coba lagi.`);
  let result: ApiResponse<T>;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error("Respons server tidak valid. Coba lagi.");
  }
  if (!response.ok || !result || result.success !== true) throw new Error(result?.error || `Gallery gagal disimpan (${response.status}).`);
  return result;
}

type GalleryPageResponse = { items: GaleriFoto[]; total: number; nextOffset: number | null };

export default function GalleryEditor({ initialPhotos, initialTotal = initialPhotos.length, ownerMode = false }: { initialPhotos: GaleriFoto[]; initialTotal?: number; ownerMode?: boolean }) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(Math.max(initialTotal, initialPhotos.length));
  const [loadedRowCount, setLoadedRowCount] = useState(initialPhotos.length);
  const [form, setForm] = useState(EMPTY_GALLERY_FORM);
  const [pending, setPending] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const loadPendingRef = useRef(false);
  const nextOffsetRef = useRef(initialPhotos.length);
  const pagedIdsRef = useRef(new Set(initialPhotos.map((photo) => photo.id)));
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (pendingRef.current || uploadBusy || !form.foto_url) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/galeri", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await readGalleryResponse<GaleriFoto>(response);
      const savedPhoto = result.data;
      if (savedPhoto) {
        setPhotos((current) => [...current, savedPhoto]);
        setTotal((current) => current + 1);
      }
      setForm(EMPTY_GALLERY_FORM);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menambah foto.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (pendingRef.current || uploadBusy) return;
    if (!window.confirm("Hapus foto ini dari galeri?")) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/galeri/${id}`, { method: "DELETE" });
      await readGalleryResponse(response);
      setPhotos((current) => current.filter((photo) => photo.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      if (pagedIdsRef.current.delete(id)) {
        nextOffsetRef.current = Math.max(0, nextOffsetRef.current - 1);
        setLoadedRowCount(nextOffsetRef.current);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menghapus foto.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function loadMore() {
    if (loadPendingRef.current || loadedRowCount >= total) return;
    loadPendingRef.current = true;
    setLoadingMore(true);
    setLoadError(null);
    const offset = nextOffsetRef.current;
    try {
      const response = await fetch(`/api/admin/galeri?offset=${offset}&limit=${GALLERY_MANAGEMENT_PAGE_SIZE}`);
      const result = await readGalleryResponse<GalleryPageResponse>(response);
      if (!result.data) throw new Error("Data Gallery tidak tersedia.");
      const page = result.data;
      page.items.forEach((photo) => pagedIdsRef.current.add(photo.id));
      nextOffsetRef.current = page.nextOffset ?? page.total;
      setLoadedRowCount(nextOffsetRef.current);
      setTotal(page.total);
      setPhotos((current) => {
        const known = new Set(current.map((photo) => photo.id));
        return [...current, ...page.items.filter((photo) => !known.has(photo.id))];
      });
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Foto berikutnya gagal dimuat.");
    } finally {
      loadPendingRef.current = false;
      setLoadingMore(false);
    }
  }

  async function toggleLock(photo: GaleriFoto) {
    if (!ownerMode || pendingRef.current || uploadBusy) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/galeri/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_locked: !photo.is_locked }),
      });
      const result = await readGalleryResponse<GaleriFoto>(response);
      if (result.data) setPhotos((current) => current.map((item) => item.id === photo.id ? result.data! : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengubah kunci foto.");
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="card grid gap-4 sm:grid-cols-2" onSubmit={add}>
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between gap-3"><label className="text-sm text-gray-600">Judul opsional</label><span className="text-xs tabular-nums text-gray-400">{form.judul.length}/{GALLERY_TITLE_MAX_LENGTH}</span></div>
          <input className="input" value={form.judul} maxLength={GALLERY_TITLE_MAX_LENGTH} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="Maksimal 40 karakter" />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between gap-3"><label className="text-sm text-gray-600">Caption opsional</label><span className="text-xs tabular-nums text-gray-400">{form.deskripsi.length}/{GALLERY_CAPTION_MAX_LENGTH}</span></div>
          <textarea className="input min-h-24" value={form.deskripsi} maxLength={GALLERY_CAPTION_MAX_LENGTH} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Maksimal 120 karakter" />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4"><MediaUpload folder="galeri" galleryFocus disabled={pending} onBusyChange={setUploadBusy} onUploaded={(url, focus) => setForm((current) => ({ ...current, foto_url: url, ...(focus ?? DEFAULT_GALLERY_FOCUS) }))} />{form.foto_url && <span className="text-xs text-emerald-700">Foto dan fokus siap ditambahkan</span>}</div>
        {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        <button className="btn-primary inline-flex items-center justify-center gap-2 sm:col-span-2 sm:justify-self-start" disabled={pending || uploadBusy || !form.foto_url}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambah ke Galeri
        </button>
      </form>

      {photos.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">Galeri masih kosong.</p> : <>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="group relative aspect-square overflow-hidden rounded-md bg-surface-muted">
              <Image src={photo.thumbnail_url ?? photo.foto_url} alt={photo.judul || photo.deskripsi || "Foto galeri XI TP2"} fill sizes="(max-width:640px) 50vw, 33vw" className="object-cover" />
              {photo.is_locked && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-700 shadow-sm"><Lock size={11} /> Owner</span>}
              <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12 text-xs text-white">
                <span className="line-clamp-2">{photo.judul || photo.deskripsi || "Tanpa judul"}</span>
                <span className="flex shrink-0 gap-1">
                  {ownerMode && <button type="button" onClick={() => toggleLock(photo)} disabled={pending || uploadBusy} className="rounded-full bg-white/15 p-2 hover:bg-white/30 disabled:opacity-40" aria-label={`${photo.is_locked ? "Buka kunci" : "Kunci"} ${photo.judul || "foto galeri"}`}>{photo.is_locked ? <LockOpen size={15} /> : <Lock size={15} />}</button>}
                  <button type="button" onClick={() => remove(photo.id)} disabled={pending || uploadBusy || (!ownerMode && photo.is_locked)} className="rounded-full bg-white/15 p-2 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Hapus ${photo.judul || "foto galeri"}`} title={!ownerMode && photo.is_locked ? "Dikunci Owner" : undefined}><Trash2 size={15} /></button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 border-t border-surface-border pt-5">
          <p className="text-xs tabular-nums text-gray-500">{photos.length} dari {total} foto ditampilkan</p>
          {loadError && <p className="text-sm text-rose-600">{loadError}</p>}
          {loadedRowCount < total && <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" onClick={() => void loadMore()} disabled={loadingMore || pending || uploadBusy}>
            {loadingMore && <Loader2 size={16} className="animate-spin" />} {loadingMore ? "Memuat foto..." : "Muat foto berikutnya"}
          </button>}
        </div>
      </>}
    </div>
  );
}
