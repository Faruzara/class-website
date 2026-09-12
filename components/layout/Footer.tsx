"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowUpRight, Instagram, Music2 } from "lucide-react";
import { CREATOR_GITHUB_URL, SCHOOL_ADDRESS, SCHOOL_WEBSITE_URL } from "@/lib/config";

export default function Footer() {
  const lastTap = useRef(0);
  const [links, setLinks] = useState({
    instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
    tiktok: process.env.NEXT_PUBLIC_TIKTOK_URL ?? "",
    creatorGithub: CREATOR_GITHUB_URL,
  });

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const client = createClient(url, key);
    Promise.resolve(client.from("site_settings").select("instagram_url, tiktok_url, creator_github_url").eq("id", 1).maybeSingle())
      .then(({ data }) => {
        if (data) setLinks({ instagram: data.instagram_url ?? "", tiktok: data.tiktok_url ?? "", creatorGithub: data.creator_github_url ?? CREATOR_GITHUB_URL });
      })
      .catch(() => undefined);
  }, []);

  const socials = [
    { href: links.instagram, label: "Instagram", icon: Instagram },
    { href: links.tiktok, label: "TikTok", icon: Music2 },
  ].filter((social) => social.href);

  function triggerEgg() {
    window.dispatchEvent(new CustomEvent("creator-github-egg", { detail: links.creatorGithub }));
  }

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 350) triggerEgg();
    lastTap.current = now;
  }

  return (
    <footer className="mt-auto border-t border-surface-border bg-white">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid gap-8 py-8 sm:grid-cols-2 sm:items-start md:py-10">
          <div className="text-center sm:text-left">
            <p className="text-sm text-gray-600">XI Teknik Pemesinan 2 <span className="mx-1 cursor-default text-brand-500" onDoubleClick={triggerEgg} onTouchEnd={handleTap}>·</span> SMKN Jambu</p>
            {socials.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-4 sm:justify-start">
                {socials.map(({ href, label, icon: Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-brand-700">
                    <Icon size={14} aria-hidden="true" />{label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="mx-auto max-w-xs text-center sm:mx-0 sm:justify-self-end sm:text-right">
            {SCHOOL_WEBSITE_URL ? (
              <a
                href={SCHOOL_WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-800 underline decoration-brand-400/70 underline-offset-4 transition-colors hover:text-brand-700"
              >
                Official School Website
                <ArrowUpRight size={14} aria-hidden="true" className="text-neutral-400" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500">
                Official School Website
                <ArrowUpRight size={14} aria-hidden="true" className="text-neutral-400" />
              </span>
            )}
            <address className="mt-3 text-sm font-normal not-italic leading-6 text-neutral-500">
              {SCHOOL_ADDRESS}
            </address>
          </div>
        </div>
        <p className="border-t border-surface-border py-5 text-center text-xs text-neutral-400">© 2026 XI TP2. All moments preserved.</p>
      </div>
    </footer>
  );
}
