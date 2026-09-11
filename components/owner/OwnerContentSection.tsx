"use client";

import { useState } from "react";
import { HomepageEditor, SettingsEditor } from "@/components/admin/HomepageEditor";
import ScheduleEditor from "@/components/admin/ScheduleEditor";
import MembersEditor from "@/components/admin/MembersEditor";
import GalleryEditor from "@/components/admin/GalleryEditor";
import OwnerAnnouncementManager from "@/components/owner/OwnerAnnouncementManager";
import type { Anggota, GaleriFoto, JadwalItem, Pengumuman, SiteSettings } from "@/types";

export type OwnerContentSectionKey = "homepage" | "schedule" | "members" | "gallery";
type HomepageTab = "hero" | "announcements" | "social";

type Props = {
  section: OwnerContentSectionKey;
  initialHomepageTab?: HomepageTab;
  settings?: SiteSettings | null;
  schedule?: JadwalItem[];
  members?: Anggota[];
  gallery?: GaleriFoto[];
  galleryTotal?: number;
  announcements?: Pengumuman[];
};

const EDITOR_SURFACE = "mt-6 border-t border-surface-border pt-6 [&_.card]:rounded-none [&_.card]:border-x-0 [&_.card]:bg-transparent [&_.card]:shadow-none [&_.card]:px-0";

const COPY: Record<OwnerContentSectionKey, { number: string; title: string; description: string }> = {
  homepage: { number: "01", title: "Homepage", description: "Atur foto utama, pengumuman, dan tautan sosial yang tampil di halaman publik." },
  schedule: { number: "02", title: "Schedule", description: "Kelola susunan jadwal tanpa bercampur dengan editor konten lainnya." },
  members: { number: "03", title: "Members", description: "Kelola data anggota dan struktur kelas dalam satu ruang kerja khusus." },
  gallery: { number: "04", title: "Gallery", description: "Kelola dokumentasi foto dan urutan tampil galeri publik." },
};

export default function OwnerContentSection({ section, initialHomepageTab = "hero", settings = null, schedule = [], members = [], gallery = [], galleryTotal, announcements = [] }: Props) {
  const [homepageTab, setHomepageTab] = useState<HomepageTab>(initialHomepageTab);
  const copy = COPY[section];

  return (
    <section id={`owner-content-${section}`} aria-labelledby="owner-content-title" className="border-t border-surface-border pt-10">
      <header className="grid gap-3 border-b border-surface-border pb-8 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <p className="font-mono text-[10px] text-brand-700">CONTENT / {copy.number}</p>
        <div>
          <h2 id="owner-content-title" className="font-display text-2xl font-semibold text-gray-900">{copy.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">{copy.description}</p>
        </div>
      </header>

      {section === "homepage" ? (
        <div className="pt-6">
          <div className="flex max-w-full overflow-x-auto border-y border-surface-border" role="tablist" aria-label="Bagian homepage">
            {([["hero", "Foto Utama & Tentang"], ["announcements", "Announcements"], ["social", "Social"]] as const).map(([tab, label]) => (
              <button key={tab} type="button" role="tab" aria-selected={homepageTab === tab} onClick={() => setHomepageTab(tab)} className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-xs font-semibold ${homepageTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>{label}</button>
            ))}
          </div>
          <div className={EDITOR_SURFACE}>
            {homepageTab === "hero" ? <HomepageEditor settings={settings} ownerMode /> : homepageTab === "announcements" ? <OwnerAnnouncementManager initialAnnouncements={announcements} /> : <SettingsEditor settings={settings} ownerMode />}
          </div>
        </div>
      ) : null}
      {section === "schedule" ? <div className={EDITOR_SURFACE}><ScheduleEditor initialItems={schedule} /></div> : null}
      {section === "members" ? <div className={EDITOR_SURFACE}><MembersEditor initialMembers={members} ownerMode /></div> : null}
      {section === "gallery" ? <div className={EDITOR_SURFACE}><GalleryEditor initialPhotos={gallery} initialTotal={galleryTotal} ownerMode /></div> : null}
    </section>
  );
}
