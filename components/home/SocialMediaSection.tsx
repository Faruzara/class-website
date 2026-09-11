import SocialMediaCard from "./SocialMediaCard";
import RevealOnScroll from "./RevealOnScroll";
import { isSafeSocialUrl } from "@/lib/validation";

type SocialMediaSectionProps = {
  instagramImageUrl?: string | null;
  instagramUrl?: string | null;
  tiktokImageUrl?: string | null;
  tiktokUrl?: string | null;
  transparentBackground?: boolean;
};

export default function SocialMediaSection({ instagramImageUrl, instagramUrl, tiktokImageUrl, tiktokUrl, transparentBackground = false }: SocialMediaSectionProps) {
  const showInstagram = Boolean(instagramImageUrl && instagramUrl && isSafeSocialUrl(instagramUrl, "instagram"));
  const showTiktok = Boolean(tiktokImageUrl && tiktokUrl && isSafeSocialUrl(tiktokUrl, "tiktok"));
  if (!showInstagram && !showTiktok) return null;

  return (
    <RevealOnScroll>
      <section aria-labelledby="social-media-heading" className={`border-t border-neutral-900/[0.08] ${transparentBackground ? "bg-transparent" : "bg-white"}`}>
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-20 lg:px-8">
          <h2 id="social-media-heading" className="section-kicker mb-8">Stay Connected</h2>
          <div className={`grid min-w-0 grid-cols-1 gap-5 md:gap-6 ${showInstagram && showTiktok ? "md:grid-cols-2" : "mx-auto max-w-[720px]"}`}>
            {showInstagram && <SocialMediaCard platform="instagram" imageUrl={instagramImageUrl!} url={instagramUrl} />}
            {showTiktok && <SocialMediaCard platform="tiktok" imageUrl={tiktokImageUrl!} url={tiktokUrl} />}
          </div>
        </div>
      </section>
    </RevealOnScroll>
  );
}
