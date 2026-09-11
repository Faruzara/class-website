"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Image as ImageIcon, LayoutTemplate, Users } from "lucide-react";
import { HomepageEditor, SettingsEditor } from "@/components/admin/HomepageEditor";
import ScheduleEditor from "@/components/admin/ScheduleEditor";
import MembersEditor from "@/components/admin/MembersEditor";
import GalleryEditor from "@/components/admin/GalleryEditor";
import OwnerAnnouncementManager from "@/components/owner/OwnerAnnouncementManager";
import type { Anggota, GaleriFoto, JadwalItem, Pengumuman, SiteSettings } from "@/types";

type Section = "homepage" | "schedule" | "members" | "gallery";
type HomepageTab = "hero" | "announcements" | "social";

const EDITOR_SURFACE = "mt-6 border-t border-surface-border pt-6 [&_.card]:rounded-none [&_.card]:border-x-0 [&_.card]:bg-transparent [&_.card]:shadow-none [&_.card]:px-0";

export default function OwnerContentManagement({ settings, schedule, members, gallery, announcements }: {
  settings: SiteSettings | null;
  schedule: JadwalItem[];
  members: Anggota[];
  gallery: GaleriFoto[];
  announcements: Pengumuman[];
}) {
  const [open, setOpen] = useState<Set<Section>>(new Set<Section>(["homepage"]));
  const [visited, setVisited] = useState<Set<Section>>(new Set<Section>(["homepage"]));
  const [homepageTab, setHomepageTab] = useState<HomepageTab>("hero");

  useEffect(() => {
    const syncHash = () => {
      const section = window.location.hash.replace("#owner-content-", "") as Section;
      if (!["homepage", "schedule", "members", "gallery"].includes(section)) return;
      setVisited((current) => new Set(current).add(section));
      setOpen(new Set([section]));
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function toggle(section: Section) {
    setVisited((current) => new Set(current).add(section));
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }

  const sections = [
    { key: "homepage" as const, id: "owner-content-homepage", number: "01", title: "Homepage", detail: `${announcements.length} pengumuman`, icon: LayoutTemplate },
    { key: "schedule" as const, id: "owner-content-schedule", number: "02", title: "Schedule", detail: `${schedule.length} mata jadwal`, icon: CalendarDays },
    { key: "members" as const, id: "owner-content-members", number: "03", title: "Members", detail: `${members.length} anggota`, icon: Users },
    { key: "gallery" as const, id: "owner-content-gallery", number: "04", title: "Gallery", detail: `${gallery.length} media`, icon: ImageIcon },
  ];

  return (
    <section aria-labelledby="content-management-title" className="border-t border-surface-border pt-10">
      <div className="mb-7 grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]"><p className="font-mono text-[10px] text-brand-700">CONTENT</p><div><h2 id="content-management-title" className="font-display text-2xl font-semibold text-gray-900">Content Management</h2><p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">Kelola bagian publik tanpa meninggalkan Owner control panel.</p></div></div>
      <div className="divide-y divide-surface-border border-y border-surface-border">
        {sections.map(({ key, id, number, title, detail, icon: Icon }) => {
          const expanded = open.has(key);
          return (
            <div key={key} id={id}>
              <button type="button" onClick={() => toggle(key)} aria-expanded={expanded} aria-controls={`${id}-editor`} className="grid min-h-20 w-full grid-cols-[2.5rem_2rem_minmax(0,1fr)_auto] items-center gap-3 py-4 text-left">
                <span className="font-mono text-[10px] text-gray-400">{number}</span><Icon size={17} className={expanded ? "text-brand-700" : "text-gray-400"} /><span><strong className="block text-sm font-semibold text-gray-900">{title}</strong><span className="mt-1 block text-xs text-gray-500">{detail}</span></span><ChevronDown size={17} className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {visited.has(key) ? <div id={`${id}-editor`} hidden={!expanded} className="pb-10">
                {key === "homepage" ? <div>
                  <div className="flex max-w-full overflow-x-auto border-y border-surface-border" role="tablist" aria-label="Bagian homepage">
                    {([['hero', 'Foto Utama & Tentang'], ['announcements', 'Announcements'], ['social', 'Social']] as const).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={homepageTab === tab} onClick={() => setHomepageTab(tab)} className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-xs font-semibold ${homepageTab === tab ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500"}`}>{label}</button>)}
                  </div>
                  <div className={EDITOR_SURFACE}>{homepageTab === "hero" ? <HomepageEditor settings={settings} ownerMode /> : homepageTab === "announcements" ? <OwnerAnnouncementManager initialAnnouncements={announcements} /> : <SettingsEditor settings={settings} ownerMode />}</div>
                </div> : null}
                {key === "schedule" ? <div className={EDITOR_SURFACE}><ScheduleEditor initialItems={schedule} /></div> : null}
                {key === "members" ? <div className={EDITOR_SURFACE}><MembersEditor initialMembers={members} ownerMode /></div> : null}
                {key === "gallery" ? <div className={EDITOR_SURFACE}><GalleryEditor initialPhotos={gallery} ownerMode /></div> : null}
              </div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
