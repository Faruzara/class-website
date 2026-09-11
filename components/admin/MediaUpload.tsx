"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import ImageCropDialog from "./ImageCropDialog";
import GalleryFocusDialog from "./GalleryFocusDialog";
import type { GalleryFocus } from "@/lib/gallery-focus";

type MediaUploadProps = {
  folder: "hero" | "anggota" | "galeri" | "social";
  onUploaded: (url: string, focus?: GalleryFocus) => void;
  replaceUrl?: string | null;
  label?: string;
  cropAspect?: number;
  cropTitle?: string;
  galleryFocus?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  protectedAsset?: { kind: "member" | "gallery" | "instagram" | "tiktok"; id?: string };
};

export default function MediaUpload({ folder, onUploaded, replaceUrl, label = "Upload foto", cropAspect, cropTitle = "Atur posisi foto", galleryFocus = false, disabled = false, onBusyChange, protectedAsset }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    onBusyChange?.(loading || cropFile !== null);
  }, [loading, cropFile, onBusyChange]);

  async function upload(file?: File, focus?: GalleryFocus) {
    if (!file) return;
    if (uploadingRef.current) throw new Error("Upload masih berjalan.");
    uploadingRef.current = true;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    if (replaceUrl) form.append("replace_url", replaceUrl);
    if (protectedAsset) {
      form.append("protected_kind", protectedAsset.kind);
      if (protectedAsset.id) form.append("protected_id", protectedAsset.id);
    }

    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body: form });
      const raw = await response.text();
      if (!raw.trim()) throw new Error(`Server tidak mengirim respons (${response.status})`);
      let result: { success?: boolean; error?: string; data?: { url?: string } };
      try {
        result = JSON.parse(raw);
      } catch {
        throw new Error("Respons server tidak valid.");
      }
      if (!response.ok || !result.success || !result.data?.url) throw new Error(result.error ?? "Upload gagal");
      onUploaded(result.data.url, focus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload gagal";
      setError(message);
      throw new Error(message);
    } finally {
      uploadingRef.current = false;
      setLoading(false);
    }
  }

  function resetSelection() {
    setCropFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectFile(file?: File) {
    if (!file || disabled || loading || cropFile) return;
    setError(null);
    if (galleryFocus && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024)) {
      setError("Gunakan JPG, PNG, atau WebP maksimal 4 MB.");
      resetSelection();
      return;
    }
    if (cropAspect || galleryFocus) {
      setCropFile(file);
      return;
    }
    void upload(file).catch(() => undefined).finally(resetSelection);
  }

  async function confirmCrop(file: File) {
    await upload(file);
    resetSelection();
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
      <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={() => inputRef.current?.click()} disabled={disabled || loading || cropFile !== null}>
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        {loading ? "Mengunggah..." : label}
      </button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      {cropFile && galleryFocus && (
        <GalleryFocusDialog file={cropFile} onCancel={resetSelection} onConfirm={async (focus) => {
          await upload(cropFile, focus);
          resetSelection();
        }} />
      )}
      {cropFile && !galleryFocus && cropAspect && (
        <ImageCropDialog file={cropFile} aspectRatio={cropAspect} title={cropTitle} onCancel={resetSelection} onConfirm={confirmCrop} />
      )}
    </div>
  );
}
