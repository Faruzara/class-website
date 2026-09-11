import PublicLayout from "@/components/layout/PublicLayout";
import HomepageData from "@/components/home/HomepageData";
import HomepageExperience from "@/components/home/HomepageExperience";
import SocialMediaSection from "@/components/home/SocialMediaSection";
import { getSiteSettings } from "@/lib/db";
import { statSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BerandaPage() {
  const settings = await getSiteSettings().catch(() => null);
  const localHeroPath = "/images/hero-workshop.png";
  let localHeroVersion = "1";
  try {
    localHeroVersion = String(statSync(path.join(process.cwd(), "public", "images", "hero-workshop.png")).mtimeMs);
  } catch {
    // Gunakan fallback tetap jika file lokal tidak tersedia.
  }
  const localHero = `${localHeroPath}?v=${localHeroVersion}`;
  const heroImage = settings?.hero_image_url || process.env.NEXT_PUBLIC_HERO_IMAGE_URL || localHero;
  const aboutText =
    settings?.about_text || process.env.NEXT_PUBLIC_ABOUT_CLASS ||
    "Kelas yang tumbuh lewat ketelitian, kerja sama, dan semangat belajar di bidang teknik pemesinan.";

  return (
    <PublicLayout>
      <HomepageExperience
        heroImage={heroImage}
        aboutText={aboutText}
        objectFit={settings?.hero_object_fit}
        objectPosition={`${settings?.hero_object_position_x ?? 50}% ${settings?.hero_object_position_y ?? 50}%`}
      />
      <HomepageData>
        <SocialMediaSection transparentBackground instagramImageUrl={settings?.instagram_image_url} instagramUrl={settings?.instagram_url} tiktokImageUrl={settings?.tiktok_image_url} tiktokUrl={settings?.tiktok_url} />
      </HomepageData>
    </PublicLayout>
  );
}
