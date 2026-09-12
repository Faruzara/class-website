"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, Bell, CalendarDays, CheckCircle2, Github, House, Images, Instagram, Loader2, Menu, MessageSquareText, Music2, UsersRound, X } from "lucide-react";
import { CREATOR_GITHUB_URL } from "@/lib/config";
import clsx from "clsx";
import type { ApiResponse, FeedbackType, Pengumuman } from "@/types";
import { isAnnouncementVisible } from "@/lib/announcement-expiry";

const NAV_LINKS = [
  { href: "/", label: "Beranda", icon: House },
  { href: "/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/anggota", label: "Anggota", icon: UsersRound },
  { href: "/galeri", label: "Galeri", icon: Images },
];

const LINE_FALLOFF = (progress: number) => progress * progress * (3 - 2 * progress);

function MobileLineMenu({
  open,
  pathname,
  darkSurface,
  instagramUrl,
  tiktokUrl,
  onClose,
}: {
  open: boolean;
  pathname: string;
  darkSurface: boolean;
  instagramUrl: string;
  tiktokUrl: string;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const targetsRef = useRef<number[]>([]);
  const currentRef = useRef<number[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const activeIndex = Math.max(0, NAV_LINKS.findIndex((link) => link.href === pathname));

  const runFrame = useCallback((now: number) => {
    const elapsed = Math.min((now - lastFrameRef.current) / 1000, 0.05);
    const strength = 1 - Math.exp(-elapsed / 0.1);
    lastFrameRef.current = now;
    let moving = false;

    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const target = Math.max(targetsRef.current[index] ?? 0, index === activeIndex ? 1 : 0);
      const current = currentRef.current[index] ?? 0;
      const next = current + (target - current) * strength;
      const settled = Math.abs(target - next) < 0.0015;
      const effect = settled ? target : next;
      currentRef.current[index] = effect;
      element.style.setProperty("--effect", effect.toFixed(4));
      if (!settled) moving = true;
    });

    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const boundaryEffect = Math.max(
        currentRef.current[index] ?? 0,
        currentRef.current[index + 1] ?? 0
      );
      element.style.setProperty("--adjacent-effect", boundaryEffect.toFixed(4));
    });

    frameRef.current = moving ? window.requestAnimationFrame(runFrame) : null;
  }, [activeIndex]);

  const startMotion = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    lastFrameRef.current = performance.now();
    frameRef.current = window.requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLUListElement>) => {
    const list = listRef.current;
    if (!list) return;
    const pointerY = event.clientY - list.getBoundingClientRect().top;
    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const center = element.offsetTop + element.offsetHeight / 2;
      const proximity = Math.max(0, 1 - Math.abs(pointerY - center) / 100);
      targetsRef.current[index] = LINE_FALLOFF(proximity);
    });
    startMotion();
  }, [startMotion]);

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = NAV_LINKS.map(() => 0);
    startMotion();
  }, [startMotion]);

  useEffect(() => {
    if (open) startMotion();
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [open, startMotion]);

  return (
    <div
      className={clsx(
        "absolute inset-x-0 top-0 z-40 h-[100svh] overflow-hidden md:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Tutup menu navigasi"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={clsx(
          "absolute inset-0 bg-transparent transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={clsx(
          "absolute inset-y-0 right-0 w-[min(70vw,260px)] overflow-hidden bg-transparent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <nav
          aria-label="Navigasi mobile"
          className="flex h-full items-center justify-end pl-4 pr-3"
          style={{
            "--line-accent": "#F17D78",
            "--line-text": darkSurface ? "rgba(255,255,255,0.78)" : "rgba(31,41,55,0.72)",
            "--line-marker": darkSurface ? "rgba(255,255,255,0.30)" : "rgba(17,24,39,0.24)",
          } as CSSProperties}
        >
          <ul
            ref={listRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className="m-0 flex w-full list-none flex-col gap-5 py-8"
          >
            {NAV_LINKS.map((link, index) => (
              <li
                key={link.href}
                ref={(element) => { itemRefs.current[index] = element; }}
                style={{
                  "--effect": index === activeIndex ? 1 : 0,
                  "--adjacent-effect": index === activeIndex || index + 1 === activeIndex ? 1 : 0,
                } as CSSProperties}
                className="relative min-h-6 pr-[54px] text-right before:absolute before:right-0 before:-top-[10px] before:hidden before:h-px before:w-5 before:origin-right before:opacity-60 before:content-[''] before:[background-color:color-mix(in_srgb,var(--line-accent)_calc(var(--effect)*100%),var(--line-marker))] before:[transform:translateX(calc(var(--effect)*-6px))_scaleX(calc(1+var(--effect)*.35))] first:before:block after:absolute after:right-0 after:top-[calc(100%+10px)] after:h-px after:w-5 after:origin-right after:opacity-60 after:content-[''] after:[background-color:color-mix(in_srgb,var(--line-accent)_calc(var(--adjacent-effect)*100%),var(--line-marker))] after:[transform:translateX(calc(var(--adjacent-effect)*-6px))_scaleX(calc(1+var(--adjacent-effect)*.35))]"
              >
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1/2 h-px w-11 origin-right [background-color:color-mix(in_srgb,var(--line-accent)_calc(var(--effect)*100%),var(--line-marker))] [transform:translateY(-50%)_scaleX(calc(.7+var(--effect)*.5))]"
                />
                <Link
                  href={link.href}
                  tabIndex={open ? 0 : -1}
                  onClick={onClose}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="relative inline-grid grid-cols-[auto_1.45rem] items-baseline gap-2 text-[0.9rem] leading-tight [color:color-mix(in_srgb,var(--line-accent)_calc(var(--effect)*100%),var(--line-text))] [transform:translateX(calc(var(--effect)*-16px))]"
                >
                  <span className="text-right">{link.label}</span>
                  <span className="text-right font-mono text-[0.72em] [opacity:calc(.5+var(--effect)*.5)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className="absolute bottom-7 right-3 flex flex-col items-center gap-3"
          style={{ color: darkSurface ? "rgba(255,255,255,.62)" : "rgba(31,41,55,.58)" }}
          aria-label="Media sosial"
        >
          {instagramUrl ? (
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="transition-colors duration-200 hover:text-brand-500">
              <Instagram size={14} strokeWidth={1.6} aria-hidden="true" />
            </a>
          ) : (
            <span aria-hidden="true" className="opacity-45"><Instagram size={14} strokeWidth={1.6} /></span>
          )}
          {tiktokUrl ? (
            <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="transition-colors duration-200 hover:text-brand-500">
              <Music2 size={14} strokeWidth={1.6} aria-hidden="true" />
            </a>
          ) : (
            <span aria-hidden="true" className="opacity-45"><Music2 size={14} strokeWidth={1.6} /></span>
          )}
        </div>
      </div>
    </div>
  );
}

function NavbarActions({ activePanel, unread, onToggle }: { activePanel: "announcements" | "feedback" | null; unread: boolean; onToggle: (panel: "announcements" | "feedback") => void }) {
  return <div className="flex items-center gap-0.5" data-navbar-actions>
    <button type="button" onClick={() => onToggle("announcements")} aria-label="Buka pengumuman" aria-expanded={activePanel === "announcements"} className="relative grid size-10 place-items-center transition-colors hover:text-brand-500">
      <Bell size={18} strokeWidth={1.7} />
      {unread ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-500 ring-2 ring-white/70" aria-label="Ada pengumuman baru" /> : null}
    </button>
    <button type="button" onClick={() => onToggle("feedback")} aria-label="Kirim feedback" aria-expanded={activePanel === "feedback"} className="grid size-10 place-items-center transition-colors hover:text-brand-500">
      <MessageSquareText size={18} strokeWidth={1.7} />
    </button>
  </div>;
}

export default function Navbar({ announcements = [] }: { announcements?: Pengumuman[] }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [overDarkSurface, setOverDarkSurface] = useState(isHome);
  const [showCreator, setShowCreator] = useState(false);
  const [creatorUrl, setCreatorUrl] = useState(CREATOR_GITHUB_URL);
  const [socialLinks, setSocialLinks] = useState({ instagram: "", tiktok: "" });
  const [activePanel, setActivePanel] = useState<"announcements" | "feedback" | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<"announcements" | "feedback">("feedback");
  const [unread, setUnread] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent">("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [announcementClock, setAnnouncementClock] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const progressMarkerRef = useRef<HTMLSpanElement>(null);
  const activeAnnouncements = announcements.filter((item) => isAnnouncementVisible(item, announcementClock));
  const newestAnnouncementDate = activeAnnouncements.reduce<string | null>((latest, item) => !latest || item.created_at > latest ? item.created_at : latest, null);

  useEffect(() => {
    setAnnouncementClock(Date.now());
    const timer = window.setInterval(() => setAnnouncementClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!newestAnnouncementDate) return;
    setUnread(window.localStorage.getItem("navbar-announcements-seen") !== newestAnnouncementDate);
  }, [newestAnnouncementDate]);

  useEffect(() => {
    if (!activePanel) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!panelRef.current?.contains(target) && !target.closest("[data-navbar-actions]")) setActivePanel(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setActivePanel(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [activePanel]);

  function togglePanel(panel: "announcements" | "feedback") {
    setOpen(false);
    if (activePanel === panel) {
      setActivePanel(null);
    } else {
      setRenderedPanel(panel);
      setActivePanel(panel);
    }
    if (panel === "announcements" && newestAnnouncementDate) {
      window.localStorage.setItem("navbar-announcements-seen", newestAnnouncementDate);
      setUnread(false);
    }
  }

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;
      const track = progressTrackRef.current;
      const marker = progressMarkerRef.current;
      if (!track || !marker) return;
      const maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const progress = maximumScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maximumScroll)) : 0;
      const edge = 14;
      const markerX = edge + Math.max(0, track.clientWidth - edge * 2) * progress;
      marker.style.transform = `translate3d(${markerX}px, 0, 0) translateX(-50%)`;
    };

    const scheduleProgress = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress, { passive: true });
    window.addEventListener("pageshow", scheduleProgress, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleProgress, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      window.removeEventListener("pageshow", scheduleProgress);
      window.visualViewport?.removeEventListener("resize", scheduleProgress);
    };
  }, []);

  async function sendFeedback(event: React.FormEvent) {
    event.preventDefault();
    if (feedbackState === "sending") return;
    setFeedbackState("sending");
    setFeedbackError("");
    try {
      const response = await fetch("/api/public/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: feedbackType, message: feedbackMessage, page_path: pathname, website: "" }) });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Feedback gagal dikirim.");
      setFeedbackMessage("");
      setFeedbackState("sent");
    } catch (reason) {
      setFeedbackState("idle");
      setFeedbackError(reason instanceof Error ? reason.message : "Feedback gagal dikirim.");
    }
  }

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const client = createClient(url, key);
    Promise.resolve(
      client.from("site_settings").select("instagram_url, tiktok_url").eq("id", 1).maybeSingle()
    )
      .then(({ data }) => {
        if (data) {
          setSocialLinks({
            instagram: data.instagram_url ?? "",
            tiktok: data.tiktok_url ?? "",
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const updateNavbar = () => {
      if (!isHome) {
        setOverDarkSurface(false);
        return;
      }
      const sampleY = 28;
      const darkSurfaces = document.querySelectorAll<HTMLElement>('[data-navbar-tone="dark"]');
      setOverDarkSurface(Array.from(darkSurfaces).some((surface) => {
        const bounds = surface.getBoundingClientRect();
        return bounds.top <= sampleY && bounds.bottom > sampleY;
      }));
    };
    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });
    window.addEventListener("resize", updateNavbar, { passive: true });
    window.addEventListener("pageshow", updateNavbar, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateNavbar);
      window.removeEventListener("resize", updateNavbar);
      window.removeEventListener("pageshow", updateNavbar);
    };
  }, [isHome]);

  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setCreatorUrl(detail || CREATOR_GITHUB_URL);
      setShowCreator(true);
      window.setTimeout(() => setShowCreator(false), 7000);
    };
    window.addEventListener("creator-github-egg", reveal);
    return () => window.removeEventListener("creator-github-egg", reveal);
  }, []);

  const overHero = isHome && overDarkSurface;

  return (
    <>
      <header
      className={clsx(
        // Keep the transparent mobile header on its own composited layer while
        // photo/reveal layers scroll underneath it. Do not animate its position.
        "inset-x-0 z-50 w-full bg-transparent transition-colors duration-300 max-md:transform-gpu",
        isHome ? "fixed top-0" : "sticky top-0",
        overHero ? "text-white" : "text-gray-900"
      )}
    >
      <nav className="relative z-50 mx-auto flex h-14 max-w-7xl items-center justify-end px-5 lg:px-8">
        <div className="relative z-50 ml-auto flex items-center gap-1">
          <span className="mr-2 hidden text-xs font-medium tracking-wide opacity-70 lg:block">SMKN Jambu</span>
          <NavbarActions activePanel={activePanel} unread={unread} onToggle={togglePanel} />
          <button className="grid size-10 place-items-center md:hidden" onClick={() => { setActivePanel(null); setOpen((value) => !value); }} aria-label={open ? "Tutup menu" : "Buka menu"} aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <MobileLineMenu
        open={open}
        pathname={pathname}
        darkSurface={isHome && overDarkSurface}
        instagramUrl={socialLinks.instagram}
        tiktokUrl={socialLinks.tiktok}
        onClose={() => setOpen(false)}
      />

      </header>

      <div
        ref={panelRef}
        data-navbar-actions
        className={clsx(
          "fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[70] w-[min(calc(100vw-1rem),22rem)] -translate-x-1/2 overflow-visible rounded-2xl border border-white/75 bg-white/70 p-2 text-gray-700 shadow-[0_14px_40px_rgba(17,24,39,0.14)] backdrop-blur-xl",
          open && "max-md:pointer-events-none max-md:translate-y-4 max-md:opacity-0"
        )}
      >
        <div
          ref={progressTrackRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-full mb-2 h-12 overflow-hidden rounded-xl bg-[#121212] shadow-[0_8px_24px_rgba(17,24,39,0.16)]"
        >
          <span
            ref={progressMarkerRef}
            className="absolute left-0 top-2 h-0 w-0 border-x-[4px] border-t-[7px] border-x-transparent border-t-white/35 [will-change:transform]"
          />
          <div className="absolute inset-x-3 bottom-2.5 h-3">
            <span
              className="absolute inset-x-0 bottom-0 h-2 opacity-50"
              style={{ backgroundImage: "repeating-linear-gradient(to right, rgba(255,255,255,0.42) 0 1px, transparent 1px 8px)" }}
            />
            <span
              className="absolute inset-0 opacity-55"
              style={{ backgroundImage: "repeating-linear-gradient(to right, rgba(255,255,255,0.55) 0 1px, transparent 1px 75px)" }}
            />
          </div>
        </div>

        <div
          aria-hidden={activePanel === null}
          inert={activePanel === null}
          className={clsx(
            "grid w-full overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            activePanel ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            {renderedPanel === "feedback" ? (
              <section aria-label="Kirim feedback" className="pb-2 text-gray-900">
                {feedbackState === "sent" ? (
                  <div className="px-3 py-6 text-center">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
                    <p className="mt-2 text-sm font-semibold">Feedback sudah terkirim.</p>
                    <button type="button" onClick={() => setFeedbackState("idle")} className="mt-3 text-xs font-semibold text-brand-700">Kirim feedback lain</button>
                  </div>
                ) : (
                  <form onSubmit={sendFeedback} className="space-y-2">
                    <div className="relative">
                      <button type="button" onClick={() => setActivePanel(null)} className="absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-gray-900" aria-label="Tutup feedback"><X size={14} /></button>
                      <textarea id="navbar-feedback" aria-label="Pesan feedback" required minLength={10} maxLength={1000} value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} className="h-24 w-full resize-none rounded-xl border border-white/80 bg-white/55 px-3 py-2.5 pr-10 text-sm leading-6 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-400" placeholder="Ceritakan secara singkat..." />
                    </div>
                    <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
                    {feedbackError ? <p role="alert" className="px-1 text-xs text-rose-700">{feedbackError}</p> : null}
                    <div className="flex items-center gap-2 px-1">
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-brand-700">Feedback</span>
                      <div className="relative inline-grid min-w-0 grid-cols-2 rounded-lg bg-gray-900/[0.05] p-1" aria-label="Jenis feedback">
                        <span aria-hidden="true" className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md bg-white shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none ${feedbackType === "feature" ? "translate-x-full" : "translate-x-0"}`} />
                        {([["bug", "Bug"], ["feature", "Request"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFeedbackType(value)} aria-pressed={feedbackType === value} className={`relative z-10 min-h-8 px-2 text-[10px] font-semibold transition-colors ${feedbackType === value ? "text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>{label}</button>)}
                      </div>
                      <button disabled={feedbackState === "sending" || feedbackMessage.trim().length < 10} className="ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-800 shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Kirim feedback">{feedbackState === "sending" ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}</button>
                    </div>
                  </form>
                )}
              </section>
            ) : (
              <section aria-label="Pengumuman terbaru" className="relative pb-2 text-gray-900">
                <button type="button" onClick={() => setActivePanel(null)} className="absolute right-1.5 top-1.5 z-10 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white hover:text-gray-900" aria-label="Tutup pengumuman"><X size={14} /></button>
                <div className="max-h-[min(46svh,19rem)] divide-y divide-gray-900/[0.07] overflow-y-auto rounded-xl border border-white/75 bg-white/45">
                  {activeAnnouncements.length ? activeAnnouncements.slice(0, 6).map((item) => (
                    <article key={item.id} className="px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xs font-semibold leading-5">{item.judul}</h3>
                        <span className={`shrink-0 font-mono text-[8px] uppercase ${item.announcement_type === "system" ? "text-brand-700" : "text-gray-400"}`}>{item.announcement_type === "system" ? "System" : "Admin"}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-gray-600">{item.konten}</p>
                      <time className="mt-1.5 block text-[9px] text-gray-400">{new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</time>
                    </article>
                  )) : <p className="px-4 py-8 text-center text-xs text-gray-500">Belum ada pengumuman.</p>}
                </div>
                <div className="flex items-center gap-2 px-1 pt-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-brand-700">Pengumuman</span>
                  <Link href="/pengumuman" onClick={() => setActivePanel(null)} className="ml-auto inline-flex h-9 items-center gap-1 px-2 text-[10px] font-semibold text-gray-600 transition-colors hover:text-gray-900">Semua <ArrowRight size={12} aria-hidden="true" /></Link>
                </div>
              </section>
            )}
          </div>
        </div>

        <nav aria-label="Dock navigasi utama" className="flex items-center justify-center gap-0.5">
          {showCreator ? (
            <a
              href={creatorUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => { if (!creatorUrl) event.preventDefault(); }}
              aria-label="GitHub pembuat situs"
              className="group relative grid h-11 min-w-12 place-items-center rounded-xl bg-white text-gray-900 shadow-sm animate-in fade-in zoom-in"
            >
              <Github size={18} strokeWidth={1.8} className="transition-transform group-hover:scale-110 group-active:scale-110" />
            </a>
          ) : (
            <Link href="/" aria-label="XI TP2 — Beranda" className="grid h-11 min-w-12 place-items-center rounded-xl px-2 font-display text-[11px] font-bold tracking-wide text-gray-900 transition-colors hover:bg-white">XI TP2</Link>
          )}

          <span aria-hidden="true" className="mx-0.5 h-7 w-px shrink-0 bg-gray-900/10" />

          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative grid size-9 shrink-0 place-items-center rounded-xl transition-[background-color,color,box-shadow] min-[360px]:size-10",
                  active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900"
                )}
              >
                <span className="pointer-events-none absolute -top-9 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-700 opacity-0 shadow-sm backdrop-blur-md transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100">{label}</span>
                <Icon size={18} strokeWidth={active ? 2 : 1.7} className={clsx("transition-transform group-hover:scale-110 group-active:scale-110", active && "scale-110")} aria-hidden="true" />
              </Link>
            );
          })}

          <button type="button" onClick={() => togglePanel("announcements")} aria-label="Pengumuman" aria-expanded={activePanel === "announcements"} className={clsx("group relative grid size-9 shrink-0 place-items-center rounded-xl transition-[background-color,color,box-shadow] min-[360px]:size-10", activePanel === "announcements" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900")}>
            <span className="pointer-events-none absolute -top-9 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-700 opacity-0 shadow-sm backdrop-blur-md transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100">Pengumuman</span>
            <Bell size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
            {unread ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-500 ring-2 ring-white" aria-label="Ada pengumuman baru" /> : null}
          </button>

          <button type="button" onClick={() => togglePanel("feedback")} aria-label="Feedback" aria-expanded={activePanel === "feedback"} className={clsx("group relative grid size-9 shrink-0 place-items-center rounded-xl transition-[background-color,color,box-shadow] min-[360px]:size-10", activePanel === "feedback" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900")}>
            <span className="pointer-events-none absolute -top-9 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-700 opacity-0 shadow-sm backdrop-blur-md transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100">Feedback</span>
            <MessageSquareText size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
          </button>
        </nav>
      </div>
    </>
  );
}
