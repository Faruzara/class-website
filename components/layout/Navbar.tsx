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
  const [unread, setUnread] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent">("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [announcementClock, setAnnouncementClock] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
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
    setActivePanel((current) => current === panel ? null : panel);
    if (panel === "announcements" && newestAnnouncementDate) {
      window.localStorage.setItem("navbar-announcements-seen", newestAnnouncementDate);
      setUnread(false);
    }
  }

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

      <div ref={panelRef} className="absolute right-4 top-14 z-[60] w-[calc(100%-2rem)] max-w-sm text-gray-900 sm:right-6 lg:right-8">
        {activePanel === "announcements" ? <section aria-label="Pengumuman terbaru" className="overflow-hidden rounded-lg border border-white/80 bg-white/85 shadow-[0_18px_45px_rgba(31,41,55,0.14)] backdrop-blur-md">
          <div className="flex items-center justify-between px-5 pb-2 pt-4"><div><p className="font-mono text-[10px] text-brand-700">UPDATES</p><h2 className="mt-1 text-sm font-semibold">Pengumuman</h2></div><div className="flex items-center gap-1"><Link href="/pengumuman" onClick={() => setActivePanel(null)} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-white/70" aria-label="Lihat semua pengumuman">Semua <ArrowRight size={12} aria-hidden="true" /></Link><button type="button" onClick={() => setActivePanel(null)} className="grid size-9 place-items-center rounded-md text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-900" aria-label="Tutup pengumuman"><X size={16} /></button></div></div>
          <div className="max-h-[min(60vh,28rem)] divide-y divide-surface-border overflow-y-auto">
            {activeAnnouncements.length ? activeAnnouncements.slice(0, 6).map((item) => <article key={item.id} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold leading-5">{item.judul}</h3><span className={`shrink-0 font-mono text-[9px] uppercase ${item.announcement_type === "system" ? "text-brand-700" : "text-gray-400"}`}>{item.announcement_type === "system" ? "System" : "Admin"}</span></div><p className="mt-1.5 line-clamp-3 text-xs leading-5 text-gray-600">{item.konten}</p><time className="mt-2 block text-[10px] text-gray-400">{new Date(item.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</time></article>) : <p className="px-5 py-10 text-center text-sm text-gray-500">Belum ada pengumuman.</p>}
          </div>
        </section> : null}

        {activePanel === "feedback" ? <section aria-label="Kirim feedback" className="overflow-hidden rounded-lg border border-white/80 bg-white/85 shadow-[0_18px_45px_rgba(31,41,55,0.14)] backdrop-blur-md">
          <div className="flex items-center justify-between px-5 pb-2 pt-4"><div><p className="font-mono text-[10px] text-brand-700">FEEDBACK</p><h2 className="mt-1 text-sm font-semibold">Bantu kami memperbaiki situs</h2></div><button type="button" onClick={() => setActivePanel(null)} className="grid size-9 place-items-center rounded-md text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-900" aria-label="Tutup feedback"><X size={16} /></button></div>
          {feedbackState === "sent" ? <div className="px-5 py-10 text-center"><CheckCircle2 size={26} className="mx-auto text-emerald-600" /><p className="mt-3 text-sm font-semibold">Feedback sudah terkirim.</p><p className="mt-1 text-xs text-gray-500">Terima kasih sudah memberi tahu.</p><button type="button" onClick={() => setFeedbackState("idle")} className="mt-5 text-xs font-semibold text-brand-700">Kirim feedback lain</button></div> : <form onSubmit={sendFeedback} className="space-y-4 px-5 py-5">
            <div className="relative inline-grid grid-cols-2 rounded-md bg-gray-100 p-1" aria-label="Jenis feedback">
              <span aria-hidden="true" className={`absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded bg-gray-900 shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none ${feedbackType === "feature" ? "translate-x-full" : "translate-x-0"}`} />
              {([["bug", "Bug"], ["feature", "Request fitur"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFeedbackType(value)} aria-pressed={feedbackType === value} className={`relative z-10 min-h-9 min-w-[6.5rem] px-3 text-xs font-semibold transition-colors duration-300 ${feedbackType === value ? "text-white" : "text-gray-500 hover:text-gray-900"}`}>{label}</button>)}
            </div>
            <div><label htmlFor="navbar-feedback" className="mb-1.5 block text-xs text-gray-600">Apa yang terjadi atau ingin ditambahkan?</label><textarea id="navbar-feedback" required minLength={10} maxLength={1000} value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} className="min-h-28 w-full resize-y rounded-md border border-surface-border bg-white/90 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500" placeholder="Ceritakan secara singkat..." /></div>
            <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
            {feedbackError ? <p role="alert" className="text-xs text-rose-700">{feedbackError}</p> : null}
            <div className="flex justify-end"><button disabled={feedbackState === "sending" || feedbackMessage.trim().length < 10} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-px hover:bg-brand-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">{feedbackState === "sending" ? <Loader2 size={15} className="animate-spin" /> : <MessageSquareText size={15} />}Kirim</button></div>
          </form>}
        </section> : null}
      </div>

      <MobileLineMenu
        open={open}
        pathname={pathname}
        darkSurface={isHome && overDarkSurface}
        instagramUrl={socialLinks.instagram}
        tiktokUrl={socialLinks.tiktok}
        onClose={() => setOpen(false)}
      />

      <nav
        aria-label="Dock navigasi utama"
        className={clsx(
          "fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[70] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/90 bg-white/85 p-1.5 text-gray-700 shadow-[0_14px_40px_rgba(17,24,39,0.16)] backdrop-blur-lg transition-[opacity,transform] duration-300",
          open && "max-md:pointer-events-none max-md:translate-y-4 max-md:opacity-0"
        )}
      >
        {showCreator ? (
          <a
            href={creatorUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => { if (!creatorUrl) event.preventDefault(); }}
            aria-label="GitHub pembuat situs"
            className="grid h-11 min-w-12 place-items-center rounded-xl text-gray-900 transition-colors hover:bg-white animate-in fade-in zoom-in"
          >
            <Github size={18} strokeWidth={1.8} />
          </a>
        ) : (
          <Link
            href="/"
            aria-label="XI TP2 — Beranda"
            className="grid h-11 min-w-12 place-items-center rounded-xl px-2 font-display text-[11px] font-bold tracking-wide text-gray-900 transition-colors hover:bg-white"
          >
            XI TP2
          </Link>
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
                "relative flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[9px] font-medium leading-none transition-colors sm:min-w-12",
                active ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-white hover:text-gray-900"
              )}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.7} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
