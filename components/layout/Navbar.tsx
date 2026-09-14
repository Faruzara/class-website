"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, CheckCircle2, Ellipsis, Github, Images, Instagram, Loader2, MessageSquareText, Music2, UsersRound, X } from "lucide-react";
import { CREATOR_GITHUB_URL } from "@/lib/config";
import clsx from "clsx";
import type { ApiResponse, FeedbackType, Pengumuman } from "@/types";
import { isAnnouncementVisible } from "@/lib/announcement-expiry";
import SoundCloudDockPlayer from "./SoundCloudDockPlayer";
import SoundCloudLyricsColumn from "./SoundCloudLyricsColumn";
import type { MusicTrack } from "@/types";

const NAV_LINKS = [
  { href: "/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/anggota", label: "Anggota", icon: UsersRound },
  { href: "/galeri", label: "Galeri", icon: Images },
];

const SCROLL_TICK_COUNT = 56;
const SCROLL_MAJOR_EVERY = 5;
const DOCK_ICON_CLASS = "group relative grid size-9 shrink-0 place-items-center rounded-xl transition-[background-color,color,box-shadow] min-[360px]:size-10";
const DOCK_ICON_IDLE = "text-gray-500 hover:bg-white hover:text-gray-900";
const DOCK_TOOLTIP_CLASS = "pointer-events-none absolute -top-9 whitespace-nowrap rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-700 opacity-0 shadow-sm backdrop-blur-md transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:-translate-y-0.5 group-focus-visible:opacity-100";

export default function Navbar({ announcements = [], musicTracks = [] }: { announcements?: Pengumuman[]; musicTracks?: MusicTrack[] }) {
  const pathname = usePathname();
  const [showCreator, setShowCreator] = useState(false);
  const [creatorUrl, setCreatorUrl] = useState(CREATOR_GITHUB_URL);
  const [socialLinks, setSocialLinks] = useState({ instagram: "", tiktok: "" });
  const [activePanel, setActivePanel] = useState<"announcements" | "feedback" | "music" | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<"announcements" | "feedback" | "music">("feedback");
  const [unread, setUnread] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent">("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [announcementClock, setAnnouncementClock] = useState(0);
  const [dockRevealed, setDockRevealed] = useState(false);
  const [dockHiddenForFooter, setDockHiddenForFooter] = useState(false);
  const [dockAtPageEdge, setDockAtPageEdge] = useState(true);
  const dockAtPageEdgeRef = useRef(true);
  const [dockNeededForShortPage, setDockNeededForShortPage] = useState(false);
  const [dockPage, setDockPage] = useState<1 | 2>(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const progressMarkerRef = useRef<HTMLSpanElement>(null);
  const footerHideTimerRef = useRef<number | null>(null);
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

  function togglePanel(panel: "announcements" | "feedback" | "music") {
    setDockRevealed(true);
    setDockHiddenForFooter(false);
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
      const revealAfter = Math.min(160, Math.max(120, window.innerHeight * 0.16));
      const progress = maximumScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maximumScroll)) : 0;
      setDockNeededForShortPage(maximumScroll < revealAfter);
      const distanceFromTop = Math.max(0, window.scrollY);
      const distanceFromBottom = Math.max(0, maximumScroll - window.scrollY);
      const edgeThreshold = dockAtPageEdgeRef.current ? 36 : 8;
      const nextAtPageEdge = distanceFromTop <= edgeThreshold || distanceFromBottom <= edgeThreshold;
      if (nextAtPageEdge !== dockAtPageEdgeRef.current) {
        dockAtPageEdgeRef.current = nextAtPageEdge;
        setDockAtPageEdge(nextAtPageEdge);
      }
      const edge = 4;
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
    const layoutObserver = new ResizeObserver(scheduleProgress);
    layoutObserver.observe(document.body);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      layoutObserver.disconnect();
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      window.removeEventListener("pageshow", scheduleProgress);
      window.visualViewport?.removeEventListener("resize", scheduleProgress);
    };
  }, []);

  useEffect(() => {
    let revealed = false;
    setDockPage(1);
    setDockRevealed(false);
    setDockHiddenForFooter(false);

    const revealDock = () => {
      if (revealed) return;
      const revealAfter = Math.min(160, Math.max(120, window.innerHeight * 0.16));
      if (window.scrollY < revealAfter) return;
      revealed = true;
      setDockRevealed(true);
      window.removeEventListener("scroll", revealDock);
    };

    const footer = document.querySelector("footer");
    const footerObserver = footer ? new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        if (footerHideTimerRef.current !== null) window.clearTimeout(footerHideTimerRef.current);
        footerHideTimerRef.current = window.setTimeout(() => {
          setActivePanel((panel) => panel === "music" ? panel : null);
          setDockHiddenForFooter(true);
        }, 2000);
      } else {
        if (footerHideTimerRef.current !== null) window.clearTimeout(footerHideTimerRef.current);
        footerHideTimerRef.current = null;
        setDockHiddenForFooter(false);
      }
    }, { threshold: 0.08 }) : null;

    revealDock();
    window.addEventListener("scroll", revealDock, { passive: true });
    if (footer && footerObserver) footerObserver.observe(footer);

    return () => {
      window.removeEventListener("scroll", revealDock);
      footerObserver?.disconnect();
      if (footerHideTimerRef.current !== null) window.clearTimeout(footerHideTimerRef.current);
      footerHideTimerRef.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    if (dockAtPageEdge) setActivePanel((panel) => panel === "music" ? panel : null);
  }, [dockAtPageEdge]);

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
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setCreatorUrl(detail || CREATOR_GITHUB_URL);
      setShowCreator(true);
      window.setTimeout(() => setShowCreator(false), 7000);
    };
    window.addEventListener("creator-github-egg", reveal);
    return () => window.removeEventListener("creator-github-egg", reveal);
  }, []);

  const panelKeepsDockVisible = activePanel !== null && activePanel !== "music";
  const dockVisible = panelKeepsDockVisible || dockNeededForShortPage || (dockRevealed && !dockHiddenForFooter && !dockAtPageEdge);

  return (
    <>
      <div
        aria-label="Media sosial"
        className="fixed right-3 z-[65] flex flex-col items-center gap-3 text-gray-700 sm:right-5"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {socialLinks.instagram ? (
          <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="transition-[color,transform] hover:scale-110 hover:text-brand-600">
            <Instagram size={16} strokeWidth={1.7} aria-hidden="true" />
          </a>
        ) : (
          <span aria-hidden="true" className="opacity-40"><Instagram size={16} strokeWidth={1.7} /></span>
        )}
        {socialLinks.tiktok ? (
          <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="transition-[color,transform] hover:scale-110 hover:text-brand-600">
            <Music2 size={16} strokeWidth={1.7} aria-hidden="true" />
          </a>
        ) : (
          <span aria-hidden="true" className="opacity-40"><Music2 size={16} strokeWidth={1.7} /></span>
        )}
      </div>

      <div
        ref={panelRef}
        data-navbar-actions
        className={clsx(
          "fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[70] w-[min(calc(100vw-1rem),22rem)] -translate-x-1/2 overflow-visible rounded-2xl border border-white/75 bg-white/70 p-2 text-gray-700 shadow-[0_14px_40px_rgba(17,24,39,0.14)] backdrop-blur-xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          dockVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"
        )}
      >
        <div
          ref={progressTrackRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 bottom-full mb-2 h-[22px]"
        >
          <span
            ref={progressMarkerRef}
            className="absolute left-0 top-0 h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-gray-950/60 [will-change:transform]"
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[14px] items-end justify-between">
            {Array.from({ length: SCROLL_TICK_COUNT }, (_, index) => {
              const major = index % SCROLL_MAJOR_EVERY === 0;
              return (
                <span
                  key={index}
                  className="w-px shrink-0"
                  style={{
                    height: major ? "12px" : "7px",
                    background: major ? "rgba(17,24,39,0.52)" : "rgba(17,24,39,0.28)",
                  }}
                />
              );
            })}
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
            {renderedPanel === "music" ? (
              <section aria-label="Pemutar musik SoundCloud" className="pb-2 text-gray-900">
                <div className="relative flex min-h-[7rem] items-center overflow-hidden rounded-xl border border-white/75 bg-white/45">
                  <SoundCloudDockPlayer tracks={musicTracks} />
                  <button type="button" onClick={() => setActivePanel(null)} className="absolute right-1.5 top-1.5 z-20 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:text-gray-900" aria-label="Tutup pemutar musik"><X size={13} /></button>
                </div>
              </section>
            ) : renderedPanel === "feedback" ? (
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

        <nav aria-label="Dock navigasi utama" className="relative flex min-h-11 items-center justify-center gap-0.5">
          <div
            aria-hidden={dockPage !== 1}
            inert={dockPage !== 1}
            className={clsx(
              "flex min-w-0 items-center gap-0.5 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              dockPage === 1 ? "translate-x-0 opacity-100" : "pointer-events-none absolute -translate-x-3 opacity-0"
            )}
          >
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
                    DOCK_ICON_CLASS,
                    active ? "bg-white text-gray-900 shadow-sm" : DOCK_ICON_IDLE
                  )}
                >
                  <span className={DOCK_TOOLTIP_CLASS}>{label}</span>
                  <Icon size={18} strokeWidth={active ? 2 : 1.7} className={clsx("transition-transform group-hover:scale-110 group-active:scale-110", active && "scale-110")} aria-hidden="true" />
                </Link>
              );
            })}

            <button type="button" onClick={() => togglePanel("announcements")} aria-label="Pengumuman" aria-expanded={activePanel === "announcements"} className={clsx(DOCK_ICON_CLASS, activePanel === "announcements" ? "bg-white text-gray-900 shadow-sm" : DOCK_ICON_IDLE)}>
              <span className={DOCK_TOOLTIP_CLASS}>Pengumuman</span>
              <Bell size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
              {unread ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-500 ring-2 ring-white" aria-label="Ada pengumuman baru" /> : null}
            </button>

            <button type="button" onClick={() => togglePanel("feedback")} aria-label="Feedback" aria-expanded={activePanel === "feedback"} className={clsx(DOCK_ICON_CLASS, activePanel === "feedback" ? "bg-white text-gray-900 shadow-sm" : DOCK_ICON_IDLE)}>
              <span className={DOCK_TOOLTIP_CLASS}>Feedback</span>
              <MessageSquareText size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
            </button>

            <button
              type="button"
              onClick={() => { setActivePanel(null); setDockPage(2); }}
              aria-label="Buka menu 2"
              className={clsx(DOCK_ICON_CLASS, DOCK_ICON_IDLE)}
            >
              <span className={DOCK_TOOLTIP_CLASS}>Menu 2</span>
              <Ellipsis size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
            </button>
          </div>

          <div
            aria-hidden={dockPage !== 2}
            inert={dockPage !== 2}
            className={clsx(
              "flex min-w-0 items-center justify-between gap-1 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              dockPage === 2 ? "w-full translate-x-0 opacity-100" : "pointer-events-none absolute inset-x-0 translate-x-3 opacity-0"
            )}
          >
            <SoundCloudLyricsColumn />
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              <span aria-hidden="true" className="mx-0.5 h-7 w-px shrink-0 bg-gray-900/10" />
              <button
                type="button"
                onClick={() => togglePanel("music")}
                aria-label="Musik"
                aria-expanded={activePanel === "music"}
                className={clsx(
                  DOCK_ICON_CLASS,
                  activePanel === "music" ? "bg-white text-gray-900 shadow-sm" : DOCK_ICON_IDLE
                )}
              >
                <span className={DOCK_TOOLTIP_CLASS}>Musik</span>
                <Music2 size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
              </button>
              <button
                type="button"
                onClick={() => { setActivePanel(null); setDockPage(1); }}
                aria-label="Kembali ke menu utama"
                className={clsx(DOCK_ICON_CLASS, DOCK_ICON_IDLE)}
              >
                <span className={DOCK_TOOLTIP_CLASS}>Kembali</span>
                <ArrowLeft size={18} strokeWidth={1.7} className="transition-transform group-hover:scale-110 group-active:scale-110" />
              </button>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
