import Image from "next/image";
import { ArrowUpRight, Instagram } from "lucide-react";
import { isSafeSocialUrl } from "@/lib/validation";

type SocialMediaCardProps = {
  imageUrl: string;
  url?: string | null;
  platform: "instagram" | "tiktok";
  preview?: boolean;
};

// Shared by the homepage and Settings so the saved crop has the same frame.
export default function SocialMediaCard({ imageUrl, url, platform, preview = false }: SocialMediaCardProps) {
  const title = platform === "instagram" ? "Instagram" : "TikTok";
  const href = url && isSafeSocialUrl(url, platform) ? url : null;
  const username = href ? new URL(href).pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") : null;
  const handle = username && /^[a-zA-Z0-9_.]{1,30}$/.test(username) ? `@${username}` : "XI TP2 · SMKN Jambu";
  const frameClass = "group relative isolate block aspect-[16/9] w-full overflow-hidden rounded-[1.5rem] bg-neutral-900 text-white ring-1 ring-inset ring-white/15 sm:rounded-[2rem]";
  const content = <>
    <Image src={imageUrl} alt="" fill sizes="(max-width: 767px) 90vw, (max-width: 1279px) 46vw, 600px" className="object-cover object-center" />
    <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
    <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
    <div className="relative flex h-full flex-col justify-between p-5 sm:p-6 lg:p-8">
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/70 sm:text-[10px]">Beyond the classroom</p>
      <div className="flex items-center gap-4 lg:gap-6">
        <span aria-hidden="true" className="flex h-14 w-14 shrink-0 -rotate-6 items-center justify-center rounded-2xl border border-white/30 bg-white/15 sm:h-16 sm:w-16 lg:h-20 lg:w-20 sm:rounded-[1.4rem]">
          {platform === "instagram" ? <Instagram className="h-8 w-8 lg:h-11 lg:w-11" strokeWidth={1.7} /> : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 lg:h-11 lg:w-11" aria-hidden="true">
              <path d="M16.6 2c.2 2.7 1.7 4.3 4.4 4.5v3.2a8.2 8.2 0 0 1-4.4-1.3v7.1a6.5 6.5 0 1 1-5.6-6.4v3.3a3.2 3.2 0 1 0 2.3 3.1V2h3.3Z" />
            </svg>
          )}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl lg:text-4xl">{title}</h3>
          <p className="mt-1 truncate text-xs text-white/75 sm:text-sm">{handle}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="max-w-[75%] text-[10px] font-light leading-relaxed text-white/75 sm:text-xs lg:text-sm">{platform === "instagram" ? "Follow our everyday moments." : "Catch our class in motion."}</p>
        <ArrowUpRight aria-hidden="true" className="h-5 w-5 shrink-0 text-white/80 transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
      </div>
    </div>
  </>;

  return !preview && href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${title} ${handle} (tab baru)`} className={`${frameClass} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500`}>
      {content}
    </a>
  ) : <div className={frameClass}>{content}</div>;
}
