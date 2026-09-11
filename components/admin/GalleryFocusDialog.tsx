"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { DEFAULT_GALLERY_FOCUS, dragGalleryFocus, getGalleryObjectPosition, getGalleryOrientation, type GalleryFocus } from "@/lib/gallery-focus";

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (focus: GalleryFocus) => Promise<void>;
};
type Asset = { url: string; width: number; height: number };

export default function GalleryFocusDialog({ file, onCancel, onConfirm }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const dragRef = useRef<{ pointerId: number; x: number; y: number; focus: GalleryFocus; width: number; height: number } | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [focus, setFocus] = useState<GalleryFocus>(DEFAULT_GALLERY_FOCUS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    let settled = false;
    setAsset(null);
    setFocus(DEFAULT_GALLERY_FOCUS);
    setError(null);
    const fail = () => {
      if (settled) return;
      settled = true;
      setError("Foto gagal dibuka. Batalkan lalu pilih file JPG, PNG, atau WebP yang valid.");
    };
    const timer = window.setTimeout(fail, 10000);
    image.onload = () => {
      if (settled) return;
      window.clearTimeout(timer);
      if (!image.naturalWidth || !image.naturalHeight) return fail();
      settled = true;
      setAsset({ url, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => { window.clearTimeout(timer); fail(); };
    image.src = url;
    return () => {
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!savingRef.current) cancelRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']") ?? []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!asset || savingRef.current || !event.isPrimary || event.button !== 0 || dragRef.current) return;
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, focus, width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !asset || savingRef.current || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setFocus(dragGalleryFocus(drag.focus, asset, drag, { x: event.clientX - drag.x, y: event.clientY - drag.y }));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function confirm() {
    if (!asset || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(focus);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengunggah foto. Silakan coba lagi.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function preview(label: string, aspectRatio: number, className = "") {
    if (!asset) return null;
    return (
      <div className={className}>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-gray-500">{label}</p>
        <div
          className="relative w-full touch-none select-none overflow-hidden bg-neutral-100 cursor-grab active:cursor-grabbing"
          style={{ aspectRatio }}
          onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          onDragStart={(event) => event.preventDefault()}
        >
          {/* Blob preview uses the original file; no canvas/export or permanent crop. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.url} alt={`Preview ${label}`} draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: getGalleryObjectPosition(focus) }} />
          <div className="pointer-events-none absolute inset-0 border border-white/70">
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
            <span className="absolute inset-y-0 right-1/3 w-px bg-white/40" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
            <span className="absolute inset-x-0 bottom-1/3 h-px bg-white/40" />
          </div>
        </div>
      </div>
    );
  }

  const portrait = asset && getGalleryOrientation(asset.width, asset.height) === "portrait";
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/70 px-4 py-5">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl outline-none sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">Atur fokus foto Gallery</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Geser foto atau gunakan slider. File asli tetap utuh; posisi ini hanya dipakai di Homepage.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} aria-label="Batalkan pengaturan fokus" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"><X size={18} /></button>
        </div>

        {!asset && !error && <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500" role="status"><Loader2 size={20} className="animate-spin" /> Membuka foto...</div>}
        {portrait ? preview("Portrait", 3 / 4, "mx-auto max-w-[240px]") : asset && (
          <div className="space-y-4">
            {preview("Wide · Landscape 1 & 4", 32 / 9)}
            {preview("Compact · Landscape 2 & 3 / Mobile", 16 / 10, "mx-auto w-3/4")}
          </div>
        )}
        {asset && (
          <div className="mt-4 space-y-3">
            <p className="text-[11px] leading-relaxed text-gray-500">Preview memakai fokus yang sama. Crop dapat sedikit berbeda sesuai layar; foto hanya bisa digeser pada sisi yang terpotong.</p>
            {(["object_position_x", "object_position_y"] as const).map((axis) => (
              <label key={axis} className="block text-xs text-gray-600">
                <span className="flex justify-between gap-2"><span>Fokus {axis === "object_position_x" ? "horizontal" : "vertikal"}</span><span className="tabular-nums">{Math.round(focus[axis])}%</span></span>
                <input type="range" min="0" max="100" step="0.1" value={focus[axis]} disabled={saving} onInput={(event) => {
                  const value = Number(event.currentTarget.value);
                  setFocus((current) => ({ ...current, [axis]: value }));
                }} className="mt-2 w-full accent-brand-500" />
              </label>
            ))}
            <button type="button" disabled={saving} onClick={() => setFocus(DEFAULT_GALLERY_FOCUS)} className="text-xs text-gray-500 underline underline-offset-4">Kembalikan ke tengah</button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-rose-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Batal</button>
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={confirm} disabled={saving || !asset}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? "Mengunggah..." : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
