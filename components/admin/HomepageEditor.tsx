"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Lock, LockOpen, Save } from "lucide-react";
import MediaUpload from "./MediaUpload";
import SocialMediaCard from "@/components/home/SocialMediaCard";
import type { SiteSettings } from "@/types";

const DEFAULT_ABOUT = "Kelas yang tumbuh lewat ketelitian, kerja sama, dan semangat belajar di bidang teknik pemesinan.";

async function readApiResponse(response: Response): Promise<{ success: boolean; error?: string }> {
  const raw = await response.text();
  if (!raw.trim()) return { success: false, error: `Server tidak mengirim respons (${response.status})` };
  try {
    const result = JSON.parse(raw) as { success?: boolean; error?: string };
    return {
      success: response.ok && result.success === true,
      error: result.error ?? (!response.ok ? `Server error (${response.status})` : undefined),
    };
  } catch {
    return { success: false, error: "Respons server tidak valid." };
  }
}

export function HomepageEditor({ settings, ownerMode = false }: { settings: SiteSettings | null; ownerMode?: boolean }) {
  const [hero, setHero] = useState(settings?.hero_image_url ?? "");
  const [about, setAbout] = useState(settings?.about_text ?? DEFAULT_ABOUT);
  const [heroLocked, setHeroLocked] = useState(settings?.hero_image_locked ?? false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({ hero, about, heroLocked: settings?.hero_image_locked ?? false }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hero_image_url: hero || null,
          about_text: about,
          ...(ownerMode ? { hero_image_locked: heroLocked } : {}),
        }),
      });
      const result = await readApiResponse(response);
      setMessage(result.success ? "Homepage berhasil disimpan." : result.error ?? "Gagal menyimpan.");
      window.setTimeout(() => setMessage(null), 3000);
      if (result.success) setSavedSnapshot({ hero, about, heroLocked });
    } catch {
      setMessage("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = hero !== savedSnapshot.hero || about !== savedSnapshot.about || (ownerMode && heroLocked !== savedSnapshot.heroLocked);

  const preview = hero || "/images/hero-workshop.png";
  return (
    <div className="space-y-6">
      <section className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Foto Utama Homepage</h2>
          {ownerMode ? (
            <button type="button" onClick={() => setHeroLocked((current) => !current)} className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${heroLocked ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"}`} aria-pressed={heroLocked}>
              {heroLocked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
              {heroLocked ? "Buka kunci" : "Kunci foto"}
            </button>
          ) : heroLocked ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-3 text-xs font-semibold text-gray-500">
              <Lock size={14} aria-hidden="true" /> Dikunci Owner
            </span>
          ) : null}
        </div>
        <div className="relative mb-4 aspect-[16/7] overflow-hidden rounded-xl bg-surface-muted">
          <Image src={preview} alt="Preview foto utama Homepage" fill sizes="800px" style={{ objectFit: settings?.hero_object_fit ?? "cover", objectPosition: `${settings?.hero_object_position_x ?? 50}% ${settings?.hero_object_position_y ?? 50}%` }} />
        </div>
        <MediaUpload folder="hero" onUploaded={setHero} label="Ganti foto utama" disabled={!ownerMode && heroLocked} />
        {!ownerMode && heroLocked && <p className="mt-2 text-xs text-gray-500">Foto ini hanya dapat diubah setelah Owner membuka kuncinya.</p>}
        <p className="mt-2 text-xs text-gray-500">JPG, PNG, atau WebP maksimal 4 MB. Jika dikosongkan, gambar default digunakan.</p>
      </section>

      <section className="card">
        <label className="mb-2 block font-semibold text-gray-900">Tentang Kelas</label>
        <textarea className="input min-h-32 resize-y" value={about} maxLength={240} onChange={(event) => setAbout(event.target.value)} />
        <p className="mt-2 text-xs text-gray-500">Gunakan 2–4 baris singkat. {about.length}/240</p>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary inline-flex items-center gap-2" onClick={save} disabled={saving || !about.trim() || !dirty}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Homepage
        </button>
        {message && <p className="text-sm text-gray-600">{message}</p>}
        {dirty && <p className="text-xs text-amber-600">Unsaved Changes</p>}
      </div>
    </div>
  );
}

export function SettingsEditor({ settings, ownerMode = false }: { settings: SiteSettings | null; ownerMode?: boolean }) {
  const [instagram, setInstagram] = useState(settings?.instagram_url ?? "");
  const [instagramImage, setInstagramImage] = useState(settings?.instagram_image_url ?? "");
  const [tiktok, setTiktok] = useState(settings?.tiktok_url ?? "");
  const [tiktokImage, setTiktokImage] = useState(settings?.tiktok_image_url ?? "");
  const [instagramImageLocked, setInstagramImageLocked] = useState(settings?.instagram_image_locked ?? false);
  const [tiktokImageLocked, setTiktokImageLocked] = useState(settings?.tiktok_image_locked ?? false);
  const [saving, setSaving] = useState(false);
  const [instagramUploadBusy, setInstagramUploadBusy] = useState(false);
  const [tiktokUploadBusy, setTiktokUploadBusy] = useState(false);
  const uploadBusy = instagramUploadBusy || tiktokUploadBusy;
  const savingRef = useRef(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({ instagram, instagramImage, tiktok, tiktokImage, instagramImageLocked, tiktokImageLocked }));

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
  }, []);

  async function save() {
    if (savingRef.current || uploadBusy) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    const snapshot = { instagram, instagramImage, tiktok, tiktokImage, instagramImageLocked, tiktokImageLocked };
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagram_url: instagram || null,
          tiktok_url: tiktok || null,
          ...(instagramImage !== savedSnapshot.instagramImage ? { instagram_image_url: instagramImage || null } : {}),
          ...(tiktokImage !== savedSnapshot.tiktokImage ? { tiktok_image_url: tiktokImage || null } : {}),
          ...(ownerMode && instagramImageLocked !== savedSnapshot.instagramImageLocked ? { instagram_image_locked: instagramImageLocked } : {}),
          ...(ownerMode && tiktokImageLocked !== savedSnapshot.tiktokImageLocked ? { tiktok_image_locked: tiktokImageLocked } : {}),
        }),
      });
      const result = await readApiResponse(response);
      setMessage(result.success ? "Social links berhasil disimpan." : result.error ?? "Gagal menyimpan.");
      if (result.success) {
        setSavedSnapshot(snapshot);
        messageTimer.current = setTimeout(() => setMessage(null), 3000);
      }
    } catch {
      setMessage("Gagal terhubung ke server.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const dirty = instagram !== savedSnapshot.instagram || instagramImage !== savedSnapshot.instagramImage || tiktok !== savedSnapshot.tiktok || tiktokImage !== savedSnapshot.tiktokImage || (ownerMode && (instagramImageLocked !== savedSnapshot.instagramImageLocked || tiktokImageLocked !== savedSnapshot.tiktokImageLocked));

  return (
    <div className="card space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Instagram URL</label>
        <input className="input" type="url" value={instagram} disabled={saving} onChange={(event) => setInstagram(event.target.value)} placeholder="https://instagram.com/..." />
      </div>
      <div className="space-y-4 border-y border-surface-border py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-medium text-gray-900">Panel Instagram Homepage</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">Tampil di bawah Class Members jika URL Instagram dan foto latar sudah disimpan.</p>
          </div>
          {ownerMode ? <button type="button" onClick={() => setInstagramImageLocked((value) => !value)} className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${instagramImageLocked ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-gray-600"}`}>{instagramImageLocked ? <LockOpen size={14} /> : <Lock size={14} />}{instagramImageLocked ? "Buka kunci" : "Kunci gambar"}</button> : instagramImageLocked ? <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-3 text-xs font-semibold text-gray-500"><Lock size={14} /> Dikunci Owner</span> : null}
        </div>
        <div className="max-w-[720px]">
          {instagramImage ? <SocialMediaCard platform="instagram" imageUrl={instagramImage} url={instagram} preview /> : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-[1.5rem] border border-dashed border-surface-border bg-surface-muted px-6 text-center text-sm text-gray-500 sm:rounded-[2rem]">Unggah foto untuk latar panel Instagram.</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MediaUpload folder="social" cropAspect={16 / 9} cropTitle="Atur latar Instagram" label={instagramImage ? "Ganti latar Instagram" : "Upload latar Instagram"} disabled={saving || tiktokUploadBusy || (!ownerMode && instagramImageLocked)} protectedAsset={{ kind: "instagram" }} onBusyChange={setInstagramUploadBusy} onUploaded={setInstagramImage} />
          {instagramImage && <button type="button" className="text-xs text-gray-500 underline underline-offset-4 disabled:opacity-40" disabled={saving || uploadBusy || (!ownerMode && instagramImageLocked)} onClick={() => setInstagramImage("")}>Hapus latar</button>}
        </div>
        <p className="text-xs leading-relaxed text-gray-500">Geser dan zoom foto di bingkai 16:9, lalu konfirmasi. JPG, PNG, atau WebP maksimal 4 MB. Perubahan baru tampil di homepage setelah Simpan Settings.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">TikTok URL</label>
        <input className="input" type="url" value={tiktok} disabled={saving} onChange={(event) => setTiktok(event.target.value)} placeholder="https://tiktok.com/@..." />
      </div>
      <div className="space-y-4 border-y border-surface-border py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-medium text-gray-900">Panel TikTok Homepage</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">Di sebelah kanan Instagram pada desktop, dan di bawahnya pada mobile. Tampil setelah URL TikTok dan foto latar disimpan.</p>
          </div>
          {ownerMode ? <button type="button" onClick={() => setTiktokImageLocked((value) => !value)} className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${tiktokImageLocked ? "border-brand-300 bg-brand-50 text-brand-700" : "border-surface-border bg-white text-gray-600"}`}>{tiktokImageLocked ? <LockOpen size={14} /> : <Lock size={14} />}{tiktokImageLocked ? "Buka kunci" : "Kunci gambar"}</button> : tiktokImageLocked ? <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-3 text-xs font-semibold text-gray-500"><Lock size={14} /> Dikunci Owner</span> : null}
        </div>
        <div className="max-w-[720px]">
          {tiktokImage ? <SocialMediaCard platform="tiktok" imageUrl={tiktokImage} url={tiktok} preview /> : (
            <div className="flex aspect-[16/9] items-center justify-center rounded-[1.5rem] border border-dashed border-surface-border bg-surface-muted px-6 text-center text-sm text-gray-500 sm:rounded-[2rem]">Unggah foto untuk latar panel TikTok.</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MediaUpload folder="social" cropAspect={16 / 9} cropTitle="Atur latar TikTok" label={tiktokImage ? "Ganti latar TikTok" : "Upload latar TikTok"} disabled={saving || instagramUploadBusy || (!ownerMode && tiktokImageLocked)} protectedAsset={{ kind: "tiktok" }} onBusyChange={setTiktokUploadBusy} onUploaded={setTiktokImage} />
          {tiktokImage && <button type="button" className="text-xs text-gray-500 underline underline-offset-4 disabled:opacity-40" disabled={saving || uploadBusy || (!ownerMode && tiktokImageLocked)} onClick={() => setTiktokImage("")}>Hapus latar</button>}
        </div>
        <p className="text-xs leading-relaxed text-gray-500">Geser dan zoom foto di bingkai 16:9, lalu konfirmasi. JPG, PNG, atau WebP maksimal 4 MB. Perubahan baru tampil di homepage setelah Simpan Settings.</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary inline-flex items-center gap-2" onClick={save} disabled={saving || uploadBusy || !dirty}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Settings
        </button>
        {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
        {dirty && <p className="text-xs text-amber-600">Unsaved Changes</p>}
      </div>
    </div>
  );
}
