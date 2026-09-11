import { notFound } from "next/navigation";
import OwnerContentSection, { type OwnerContentSectionKey } from "@/components/owner/OwnerContentSection";
import { getAnggota, getGaleriPage, getJadwal, getPengumuman, getSiteSettings } from "@/lib/db";
import { GALLERY_MANAGEMENT_PAGE_SIZE } from "@/lib/gallery-constants";

export const dynamic = "force-dynamic";

const SECTIONS: OwnerContentSectionKey[] = ["homepage", "schedule", "members", "gallery"];

function isContentSection(value: string): value is OwnerContentSectionKey {
  return SECTIONS.includes(value as OwnerContentSectionKey);
}

export default async function OwnerContentSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ section }, { tab }] = await Promise.all([params, searchParams]);
  if (!isContentSection(section)) notFound();

  if (section === "homepage") {
    const [settings, announcements] = await Promise.all([
      getSiteSettings().catch(() => null),
      getPengumuman(undefined, { includeExpired: true }).catch(() => []),
    ]);
    const initialHomepageTab = tab === "announcements" || tab === "social" ? tab : "hero";
    return <OwnerContentSection section="homepage" initialHomepageTab={initialHomepageTab} settings={settings} announcements={announcements} />;
  }
  if (section === "schedule") return <OwnerContentSection section="schedule" schedule={await getJadwal().catch(() => [])} />;
  if (section === "members") return <OwnerContentSection section="members" members={await getAnggota(true).catch(() => [])} />;
  const gallery = await getGaleriPage(0, GALLERY_MANAGEMENT_PAGE_SIZE).catch(() => ({ items: [], total: 0 }));
  return <OwnerContentSection section="gallery" gallery={gallery.items} galleryTotal={gallery.total} />;
}
