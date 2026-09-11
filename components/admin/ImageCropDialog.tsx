"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Move, ZoomIn, X } from "lucide-react";

type Point = { x: number; y: number };
type Size = { width: number; height: number };

type ImageCropDialogProps = {
  file: File;
  aspectRatio: number;
  title: string;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
};

export default function ImageCropDialog({ file, aspectRatio, title, onCancel, onConfirm }: ImageCropDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);
    setImageSize({ width: 0, height: 0 });
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(nextObjectUrl);
  }, [file]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel, saving]);

  function getMetrics(zoomValue = zoom) {
    if (!viewportSize.width || !viewportSize.height || !imageSize.width || !imageSize.height) return null;
    const baseScale = Math.max(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height);
    const scale = baseScale * zoomValue;
    const renderedWidth = imageSize.width * scale;
    const renderedHeight = imageSize.height * scale;
    return {
      scale,
      renderedWidth,
      renderedHeight,
      maxX: Math.max((renderedWidth - viewportSize.width) / 2, 0),
      maxY: Math.max((renderedHeight - viewportSize.height) / 2, 0),
    };
  }

  function constrain(point: Point, zoomValue = zoom) {
    const metrics = getMetrics(zoomValue);
    if (!metrics) return { x: 0, y: 0 };
    return {
      x: Math.max(-metrics.maxX, Math.min(metrics.maxX, point.x)),
      y: Math.max(-metrics.maxY, Math.min(metrics.maxY, point.y)),
    };
  }

  useEffect(() => {
    setOffset((current) => constrain(current));
    // Ukuran viewport/gambar menentukan batas geser baru.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.width, viewportSize.height, imageSize.width, imageSize.height]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (saving || !imageSize.width) return;
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    setOffset((current) => constrain({ x: current.x + deltaX, y: current.y + deltaY }));
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  function cancelNativeDrag(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleLostPointerCapture(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function updateZoom(nextZoom: number) {
    setZoom(nextZoom);
    setOffset((current) => constrain(current, nextZoom));
  }

  async function createCroppedFile() {
    const image = imageRef.current;
    const metrics = getMetrics();
    if (!image || !metrics) throw new Error("Foto belum siap diproses.");

    const sourceWidth = viewportSize.width / metrics.scale;
    const sourceHeight = viewportSize.height / metrics.scale;
    const sourceX = Math.max(0, Math.min(imageSize.width - sourceWidth, (imageSize.width - sourceWidth) / 2 - offset.x / metrics.scale));
    const sourceY = Math.max(0, Math.min(imageSize.height - sourceHeight, (imageSize.height - sourceHeight) / 2 - offset.y / metrics.scale));
    const outputWidth = Math.max(1, Math.min(1200, Math.floor(sourceWidth)));
    const outputHeight = Math.max(1, Math.round(outputWidth / aspectRatio));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses crop foto.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("Gagal membuat hasil crop foto.");
    const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "foto";
    return new File([blob], `${baseName}-cropped.webp`, { type: "image/webp", lastModified: Date.now() });
  }

  async function confirmCrop() {
    if (saving || !imageSize.width) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(await createCroppedFile());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menyimpan hasil crop.");
      setSaving(false);
    }
  }

  const metrics = getMetrics();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-neutral-950/70 px-4 py-5" role="dialog" aria-modal="true" aria-labelledby="image-crop-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="image-crop-title" className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">Geser foto di dalam kotak dan gunakan zoom sampai posisi wajah sesuai.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40" aria-label="Batalkan crop">
            <X size={18} />
          </button>
        </div>

        <div
          ref={viewportRef}
          className={`relative mx-auto w-[min(82vw,360px)] touch-none select-none overflow-hidden bg-neutral-900 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ aspectRatio }}
          onDragStart={cancelNativeDrag}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={handleLostPointerCapture}
        >
          {objectUrl && (
            <img
              ref={imageRef}
              src={objectUrl}
              alt="Preview crop"
              draggable={false}
              onDragStart={cancelNativeDrag}
              onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setError("Preview foto gagal dibuka. Pilih kembali file JPG, PNG, atau WebP.")}
              className="crop-source-image pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={metrics ? {
                width: metrics.renderedWidth,
                height: metrics.renderedHeight,
                transform: `translate3d(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px), 0)`,
              } : undefined}
            />
          )}
          {!metrics && <div className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 className="animate-spin" size={24} /></div>}

          <div className="pointer-events-none absolute inset-0 border border-white/80 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18)]">
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/45" />
            <span className="absolute inset-y-0 right-1/3 w-px bg-white/45" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/45" />
            <span className="absolute inset-x-0 bottom-1/3 h-px bg-white/45" />
          </div>
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] text-white/85 backdrop-blur-sm">
            <Move size={12} /> Geser foto
          </div>
        </div>

        <label className="mx-auto mt-5 flex w-[min(82vw,360px)] items-center gap-3 text-xs text-gray-600">
          <ZoomIn size={16} className="shrink-0" />
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} disabled={saving} className="w-full accent-brand-500" aria-label="Perbesar foto" />
          <span className="w-10 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
        </label>

        {error && <p className="mt-3 text-center text-xs text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>Batal</button>
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={confirmCrop} disabled={saving || !metrics}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Menyimpan..." : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
