"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ArrowUpRight, ChevronLeft, ChevronRight, User } from "lucide-react";
import RevealOnScroll from "./RevealOnScroll";
import LiveMomentsSection from "./LiveMomentsSection";
import type { Anggota, GaleriFoto } from "@/types";
import { orderClassStructure } from "@/lib/member-roles";
import { getGalleryObjectPosition, getGalleryOrientation, type GalleryOrientation } from "@/lib/gallery-focus";
import { GALLERY_LAYOUTS, createGallerySession, prepareGalleryPools, fillGallerySlots, type GalleryPools, type GallerySession, type GallerySlot, type GallerySlotKind, type GalleryVariant } from "./homepage-gallery";

const CAROUSEL_TRANSITION_MS = 280;
type CoreMemberItem = { role: string; member: Anggota };
const galleryOrientationCache = new Map<string, Promise<GalleryOrientation>>();

function shuffleMembers(members: Anggota[]) {
  const shuffled = [...members];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function detectGalleryOrientation(photo: GaleriFoto): Promise<GalleryOrientation> {
  const cached = galleryOrientationCache.get(photo.id);
  if (cached) return cached;

  const orientation = new Promise<GalleryOrientation>((resolve) => {
    const image = new window.Image();
    const timeout = window.setTimeout(() => resolve("landscape"), 8000);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(getGalleryOrientation(image.naturalWidth, image.naturalHeight));
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve("landscape");
    };
    image.src = photo.foto_url;
  });

  galleryOrientationCache.set(photo.id, orientation);
  return orientation;
}

export default function HomepageData({ children }: { children?: ReactNode }) {
  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [galeri, setGaleri] = useState<GaleriFoto[]>([]);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [galleryPools, setGalleryPools] = useState<GalleryPools>({ portraits: [], landscapes: [] });
  const [gallerySession, setGallerySession] = useState<GallerySession | null>(null);
  const gallerySessionRef = useRef<GallerySession | null>(null);

  useEffect(() => {
    // Choose once after hydration, including React StrictMode's effect replay.
    // The chosen variant is independent of image counts, loading, and viewport size.
    gallerySessionRef.current ??= createGallerySession(Math.random(), Math.random());
    setGallerySession(gallerySessionRef.current);
  }, []);

  // One selection for every viewport; only CSS changes when crossing a breakpoint.
  const gallerySlots = useMemo(() => fillGallerySlots(gallerySession?.variant ?? "A", galleryPools), [galleryPools, gallerySession]);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      setGalleryLoaded(true);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const client = createClient(supabaseUrl, anonKey);

    Promise.all([
      client
        .from("anggota")
        .select("*")
        .eq("is_visible", true)
        .order("nomor_absen", { ascending: true })
        .abortSignal(controller.signal),
      client
        .from("galeri")
        .select("*")
        .order("urutan", { ascending: true })
        .abortSignal(controller.signal),
    ])
      .then(([anggotaResult, galeriResult]) => {
        if (!anggotaResult.error) setAnggota(shuffleMembers(anggotaResult.data ?? []));
        if (!galeriResult.error) setGaleri(galeriResult.data ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timeout);
        setGalleryLoaded(true);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const coreMembers = useMemo<CoreMemberItem[]>(() => {
    return orderClassStructure(anggota);
  }, [anggota]);

  useEffect(() => {
    let cancelled = false;

    if (!gallerySession || galeri.length === 0) {
      setGalleryPools({ portraits: [], landscapes: [] });
      return () => {
        cancelled = true;
      };
    }

    Promise.all(
      galeri.map(async (photo) => ({
        photo,
        orientation: await detectGalleryOrientation(photo),
      })),
    ).then((classified) => {
      if (cancelled) return;

      setGalleryPools(prepareGalleryPools(classified, gallerySession.seed));
    });

    return () => {
      cancelled = true;
    };
  }, [galeri, gallerySession]);

  return (
    <>
      <RevealOnScroll>
        <section className="border-t border-neutral-900/[0.08] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
            <div className="mb-10">
              <p className="section-kicker mb-3">Class Structure</p>
            </div>

            {coreMembers.length > 0 ? <CoreMembersCarousel items={coreMembers} /> : (
              <EmptyState>Class structure will appear once the officer data is available.</EmptyState>
            )}
          </div>
        </section>
      </RevealOnScroll>

      <LiveMomentsSection />

      <RevealOnScroll>
        <section className="border-t border-neutral-900/[0.08] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-20 md:py-28 lg:px-8">
            <SectionHeading
              kicker="Gallery"
              href="/galeri"
              linkLabel="View Gallery"
            />
            {!galleryLoaded || galeri.length > 0 ? (
              gallerySession && <GalleryGrid variant={gallerySession.variant} slots={gallerySlots} />
            ) : (
              <GalleryEmptyState />
            )}
          </div>
        </section>
      </RevealOnScroll>

      <div className="members-social-background relative isolate overflow-x-clip bg-white">
        <div className="class-members-foliage-stage relative border-t border-neutral-900/[0.08]">
          <div aria-hidden="true" className="class-members-foliage-track pointer-events-none absolute inset-x-0 top-0 z-0 select-none">
            <div className="class-members-foliage sticky top-0 ml-auto" />
          </div>
          <RevealOnScroll className="relative z-10">
            <section className="class-members-section relative">
              <div className="relative z-10 mx-auto max-w-7xl px-5 py-20 md:py-24 lg:px-8">
                <SectionHeading
                  kicker="Class Members"
                  title="The people of XI TP2"
                  href="/anggota"
                  linkLabel="View All Members"
                />
                {anggota.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-6">
                    {anggota.slice(0, 6).map((member) => (
                      <PersonItem
                        key={member.id}
                        name={member.nama}
                        role={member.jabatan}
                        imageUrl={member.foto_url}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="border-t border-neutral-900/[0.08] py-8 text-sm text-gray-500">
                    Member data is not available yet.
                  </p>
                )}
              </div>
            </section>
          </RevealOnScroll>
        </div>
        <div className="relative z-10">{children}</div>
      </div>
    </>
  );
}

function carouselTransitionEasing(progress: number) {
  // Samakan gerak scroll dengan cubic-bezier(0.33, 1, 0.68, 1)
  // yang dipakai oleh perubahan lebar panel.
  let parameter = progress;
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const inverse = 1 - parameter;
    const x = 3 * inverse * inverse * parameter * 0.33
      + 3 * inverse * parameter * parameter * 0.68
      + parameter * parameter * parameter;
    const derivative = 3 * inverse * inverse * 0.33
      + 6 * inverse * parameter * (0.68 - 0.33)
      + 3 * parameter * parameter * (1 - 0.68);
    if (Math.abs(derivative) < 0.0001) break;
    parameter = Math.max(0, Math.min(1, parameter - (x - progress) / derivative));
  }
  return 1 - Math.pow(1 - parameter, 3);
}

function getCarouselIndicatorWindowStart(active: number, total: number, previousStart: number): number {
  if (total === 0) return 0;
  const count = Math.min(total, 5);
  const logicalIndex = ((active % total) + total) % total;
  // Keep the last window while the active item is inside it. Move only at
  // either edge, so reversing direction retraces the dots instead of pinning
  // the indicator to dot 5 for a second item.
  const earliestStart = Math.max(0, logicalIndex - count + 1);
  const latestStart = Math.min(logicalIndex, total - count);
  return Math.max(earliestStart, Math.min(previousStart, latestStart));
}

function getCarouselIndicators(active: number, total: number, previousStart = 0): Array<{ active: boolean; faded: boolean }> {
  if (total === 0) return [];
  const count = Math.min(total, 5);
  const logicalIndex = ((active % total) + total) % total;
  const start = getCarouselIndicatorWindowStart(logicalIndex, total, previousStart);
  return Array.from({ length: count }, (_, position) => {
    const isActive = start + position === logicalIndex;
    return {
      active: isActive,
      faded: !isActive && ((position === 0 && start > 0)
        || (position === count - 1 && start + count < total)),
    };
  });
}

function CoreMembersCarousel({ items }: { items: CoreMemberItem[] }) {
  const infiniteEnabled = items.length >= 4;
  const renderedItems = useMemo(() => {
    const copies = infiniteEnabled ? [0, 1, 2] : [1];
    return copies.flatMap((copy) => items.map((item) => ({
      ...item,
      copy,
      renderKey: `${copy}-${item.member.id}`,
    })));
  }, [infiniteEnabled, items]);
  const initialIndex = infiniteEnabled ? items.length : 0;
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const activeIndexRef = useRef(initialIndex);
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastDirection: 0, distanceSinceCommit: 0, releasing: false });
  const autoTimerRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const initializationRef = useRef(true);
  const programmaticFrameRef = useRef<number | null>(null);
  const motionRef = useRef<{ fromOffset: number; startedAt: number; duration: number } | null>(null);
  const transitionUntilRef = useRef(0);
  const indicatorWindowStartRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  function getLogicalIndex(index: number) {
    if (items.length === 0) return 0;
    return ((index % items.length) + items.length) % items.length;
  }

  function getScrollTarget(index: number) {
    const viewport = viewportRef.current;
    const item = itemRefs.current[index];
    if (!viewport || !item) return null;
    const viewportRect = viewport.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const viewportCenter = viewportRect.left + viewport.clientWidth / 2;
    const itemCenter = itemRect.left + itemRect.width / 2;
    const target = viewport.scrollLeft + itemCenter - viewportCenter;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    return Math.max(0, Math.min(target, maxScroll));
  }

  function getCarouselWidths() {
    const desktop = window.innerWidth >= 768;
    return {
      activeWidth: desktop
        ? Math.max(260, Math.min(window.innerWidth * 0.28, 340))
        : Math.max(170, Math.min(window.innerWidth * 0.5, 220)),
      nearWidth: desktop
        ? Math.max(156, Math.min(window.innerWidth * 0.16, 194))
        : Math.max(100, Math.min(window.innerWidth * 0.28, 128)),
      farWidth: desktop
        ? Math.max(118, Math.min(window.innerWidth * 0.12, 146))
        : Math.max(78, Math.min(window.innerWidth * 0.21, 98)),
    };
  }

  function scrollToIndex(index: number) {
    const viewport = viewportRef.current;
    const target = getScrollTarget(index);
    if (!viewport || target === null) return;
    viewport.scrollLeft = target;
  }

  function clearAutoTimer() {
    if (autoTimerRef.current !== null) {
      window.clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }

  function clearProgrammaticScroll() {
    if (programmaticFrameRef.current !== null) {
      window.cancelAnimationFrame(programmaticFrameRef.current);
      programmaticFrameRef.current = null;
    }
    motionRef.current = null;
  }

  function normalizeInfinitePosition(viewport: HTMLDivElement) {
    if (!infiniteEnabled) return;
    const currentIndex = activeIndexRef.current;
    const normalizedIndex = items.length + getLogicalIndex(currentIndex);
    if (currentIndex === normalizedIndex) return;

    const currentTarget = getScrollTarget(currentIndex);
    if (currentTarget === null) return;
    const offset = viewport.scrollLeft - currentTarget;

    // Rebase equivalent copies only after expansion has settled. Force layout
    // before restoring transitions so the invisible rebase cannot animate.
    viewport.classList.add("is-repositioning");
    activeIndexRef.current = normalizedIndex;
    flushSync(() => setActiveIndex(normalizedIndex));
    const normalizedTarget = getScrollTarget(normalizedIndex);
    if (normalizedTarget !== null) viewport.scrollLeft = normalizedTarget + offset;
    viewport.classList.remove("is-repositioning");
  }

  function beginOffsetMotion(now: number, duration = CAROUSEL_TRANSITION_MS) {
    const viewport = viewportRef.current;
    const target = getScrollTarget(activeIndexRef.current);
    if (!viewport || target === null) return;
    motionRef.current = { fromOffset: viewport.scrollLeft - target, startedAt: now, duration };
  }

  function changeActiveCard(index: number, now: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const scrollLeft = viewport.scrollLeft;
    activeIndexRef.current = index;
    flushSync(() => setActiveIndex(index));
    // Measure live, animated geometry rather than predicting final widths.
    // The new card starts exactly where it was, with no center teleport.
    viewport.scrollLeft = scrollLeft;
    transitionUntilRef.current = now + CAROUSEL_TRANSITION_MS;
    beginOffsetMotion(now);
  }

  function requestMotionFrame() {
    if (programmaticFrameRef.current !== null) return;
    programmaticFrameRef.current = window.requestAnimationFrame(animateCarousel);
  }

  function animateCarousel(now: number) {
    programmaticFrameRef.current = null;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const drag = dragRef.current;
    const motion = motionRef.current;
    const progress = motion ? Math.min((now - motion.startedAt) / motion.duration, 1) : 1;
    const offset = motion ? motion.fromOffset * (1 - carouselTransitionEasing(progress)) : 0;
    const target = getScrollTarget(activeIndexRef.current);
    if (target === null) return;

    // Drag, expansion and settling share this single position writer.
    viewport.scrollLeft = target + offset - drag.distanceSinceCommit;
    if (motion && progress >= 1) motionRef.current = null;
    const settled = motionRef.current === null && now >= transitionUntilRef.current;
    if (settled) normalizeInfinitePosition(viewport);

    if (drag.releasing) {
      drag.releasing = false;
      if (drag.distanceSinceCommit !== 0) {
        drag.distanceSinceCommit = 0;
        // Resume from the current visual position; never start a second snap.
        beginOffsetMotion(now, Math.max(180, transitionUntilRef.current - now));
      }
    }

    if (drag.active || motionRef.current || now < transitionUntilRef.current) requestMotionFrame();
  }

  function scheduleProgrammaticScroll(index: number, behavior: ScrollBehavior = "smooth") {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (behavior === "auto") {
      viewport.classList.add("is-repositioning");
      activeIndexRef.current = index;
      flushSync(() => setActiveIndex(index));
      scrollToIndex(index);
      viewport.classList.remove("is-repositioning");
      return;
    }
    changeActiveCard(index, performance.now());
    requestMotionFrame();
  }

  function startAutoSlide() {
    clearAutoTimer();
    if (initializationRef.current || items.length < 2) return;
    autoTimerRef.current = window.setInterval(() => {
      if (dragRef.current.active || dragRef.current.releasing || motionRef.current) return;
      const current = activeIndexRef.current;
      const next = infiniteEnabled
        ? current + 1
        : current >= items.length - 1 ? 0 : current + 1;
      scheduleProgrammaticScroll(next, !infiniteEnabled && next === 0 ? "auto" : "smooth");
    }, 6000);
  }

  function pauseAutoSlide() {
    clearAutoTimer();
    if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
  }

  function resumeAutoSlide() {
    pauseAutoSlide();
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      if (!dragRef.current.active) startAutoSlide();
    }, 8000);
  }

  function navigateCard(direction: -1 | 1) {
    // Reuse the same motion owner as drag/auto slide; rapid clicks must not
    // interrupt expansion or enqueue extra active-card changes.
    if (items.length < 2 || initializationRef.current || dragRef.current.active
      || dragRef.current.releasing || motionRef.current
      || performance.now() < transitionUntilRef.current) return;
    const current = activeIndexRef.current;
    const next = Math.max(0, Math.min(current + direction, renderedItems.length - 1));
    if (next === current) return;
    resumeAutoSlide();
    scheduleProgrammaticScroll(next);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || items.length === 0) return;

    initializationRef.current = true;
    clearAutoTimer();
    clearProgrammaticScroll();
    transitionUntilRef.current = 0;
    dragRef.current = { active: false, pointerId: -1, lastX: 0, lastDirection: 0, distanceSinceCommit: 0, releasing: false };
    viewport.classList.add("is-repositioning");
    activeIndexRef.current = initialIndex;
    setActiveIndex(initialIndex);
    let alignmentFrame: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      scrollToIndex(initialIndex);
      alignmentFrame = window.requestAnimationFrame(() => {
        scrollToIndex(initialIndex);
        viewport.classList.remove("is-repositioning");
      });
    });
    const settleTimer = window.setTimeout(() => {
      initializationRef.current = false;
      if (!dragRef.current.active && resumeTimerRef.current === null) startAutoSlide();
    }, 620);
    const onResize = () => {
      clearProgrammaticScroll();
      transitionUntilRef.current = 0;
      dragRef.current.distanceSinceCommit = 0;
      viewport.classList.add("is-repositioning");
      scrollToIndex(activeIndexRef.current);
      viewport.classList.remove("is-repositioning");
      if (dragRef.current.active) requestMotionFrame();
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(frame);
      if (alignmentFrame !== null) window.cancelAnimationFrame(alignmentFrame);
      window.clearTimeout(settleTimer);
      viewport.classList.remove("is-repositioning");
      clearAutoTimer();
      if (resumeTimerRef.current !== null) window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
      clearProgrammaticScroll();
      initializationRef.current = true;
    };
  }, [items.length]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || dragRef.current.active || (event.pointerType === "mouse" && event.button !== 0)) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (dragRef.current.releasing && dragRef.current.distanceSinceCommit !== 0) {
      const now = performance.now();
      beginOffsetMotion(now, Math.max(180, transitionUntilRef.current - now));
    }
    dragRef.current = { active: true, pointerId: event.pointerId, lastX: event.clientX, lastDirection: 0, distanceSinceCommit: 0, releasing: false };
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture?.(event.pointerId);
    pauseAutoSlide();
    requestMotionFrame();
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || event.pointerId !== dragRef.current.pointerId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    const delta = event.clientX - dragRef.current.lastX;
    dragRef.current.lastX = event.clientX;
    const direction = Math.sign(delta);
    if (direction !== 0 && dragRef.current.lastDirection !== 0 && direction !== dragRef.current.lastDirection) {
      dragRef.current.distanceSinceCommit = 0;
    }
    if (direction !== 0) dragRef.current.lastDirection = direction;
    dragRef.current.distanceSinceCommit += delta;
    const threshold = getCarouselWidths().activeWidth * 0.16;
    if (Math.abs(dragRef.current.distanceSinceCommit) >= threshold) {
      const direction = dragRef.current.distanceSinceCommit < 0 ? 1 : -1;
      const next = Math.max(0, Math.min(activeIndexRef.current + direction, renderedItems.length - 1));
      if (next !== activeIndexRef.current) {
        changeActiveCard(next, performance.now());
        dragRef.current.distanceSinceCommit += direction * threshold;
      } else {
        dragRef.current.distanceSinceCommit = 0;
      }
    }
    requestMotionFrame();
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || event.pointerId !== dragRef.current.pointerId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current.active = false;
    dragRef.current.releasing = true;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    requestMotionFrame();
    resumeAutoSlide();
  }

  const logicalActiveIndex = getLogicalIndex(activeIndex);
  const indicatorWindowStart = getCarouselIndicatorWindowStart(logicalActiveIndex, items.length, indicatorWindowStartRef.current);
  const indicators = getCarouselIndicators(logicalActiveIndex, items.length, indicatorWindowStart);

  useEffect(() => {
    // Persist only the committed pagination window, never clone positions.
    indicatorWindowStartRef.current = indicatorWindowStart;
  }, [indicatorWindowStart]);

  return (
    <>
      <div
        ref={viewportRef}
        className="core-members-viewport -mx-5 flex cursor-grab select-none items-start gap-0 overflow-x-auto px-[28vw] pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-[38vw]"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onDragStart={(event) => event.preventDefault()}
        aria-label="Struktur kelas"
      >
        {renderedItems.map(({ role, member, copy, renderKey }, index) => {
          const active = index === activeIndex;
          const distance = index - activeIndex;
          const absoluteDistance = Math.abs(distance);
          const translateMagnitude = Math.min(absoluteDistance, 3) * 4;
          const translateX = -Math.sign(distance) * translateMagnitude;
          const visibilityClass = active
            ? "opacity-100 brightness-100"
            : absoluteDistance === 1
              ? "opacity-[0.94] brightness-[0.85]"
              : absoluteDistance === 2
                ? "pointer-events-none opacity-0 brightness-[0.75] lg:pointer-events-auto lg:opacity-[0.88]"
                : "pointer-events-none opacity-0 brightness-[0.65]";
          const panelWidthClass = active
            ? "w-[50vw] min-w-[170px] max-w-[220px] md:w-[28vw] md:min-w-[260px] md:max-w-[340px]"
            : absoluteDistance === 1
              ? "w-[28vw] min-w-[100px] max-w-[128px] md:w-[16vw] md:min-w-[156px] md:max-w-[194px]"
              : "w-[21vw] min-w-[78px] max-w-[98px] md:w-[12vw] md:min-w-[118px] md:max-w-[146px]";
          return (
            <article
              key={renderKey}
              data-active={active}
              ref={(element) => { itemRefs.current[index] = element; }}
              className={`core-member-panel relative flex-none transition-[width,min-width,max-width,transform,opacity,filter] duration-[280ms] ease-[cubic-bezier(0.33,1,0.68,1)] ${visibilityClass} ${panelWidthClass}`}
              style={{
                transform: `translate3d(${translateX}px, 0, 0)`,
                zIndex: Math.max(30 - absoluteDistance, 1),
              }}
              aria-hidden={infiniteEnabled && copy !== 1 ? true : undefined}
            >
              <div className={`core-member-frame relative mb-4 h-[clamp(240px,64vw,350px)] overflow-hidden bg-surface-muted md:h-[clamp(275px,35vw,450px)] ${active ? "shadow-[0_18px_36px_-24px_rgba(15,23,42,0.38)]" : "shadow-[0_8px_18px_-18px_rgba(15,23,42,0.18)]"}`}>
                <div className="core-member-frame-inner absolute left-1/2 top-1/2 h-[112%]">
                  {member.foto_url ? (
                    <Image
                      src={member.foto_url}
                      alt={member.nama}
                      fill
                      draggable={false}
                      sizes="(max-width: 374px) 290px, (max-width: 767px) 365px, (max-width: 1023px) 440px, 525px"
                      className="object-cover object-center"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      <User size={active ? 34 : 26} strokeWidth={1.4} />
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <div aria-live="polite" aria-atomic="true">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-600">{items[logicalActiveIndex]?.role}</p>
          <p className="mt-1 text-base font-semibold text-gray-900">{items[logicalActiveIndex]?.member.nama}</p>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2" aria-label="Navigasi struktur kelas">
          <button
            type="button"
            onClick={() => navigateCard(-1)}
            disabled={items.length < 2 || (!infiniteEnabled && logicalActiveIndex === 0)}
            className="flex h-11 w-11 items-center justify-center text-neutral-400 transition-colors duration-200 hover:text-neutral-600 focus-visible:outline focus-visible:outline-1 focus-visible:outline-neutral-400 disabled:cursor-default disabled:opacity-30"
            aria-label="Foto struktur sebelumnya"
          >
            <ChevronLeft size={18} strokeWidth={1.4} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2" aria-hidden="true">
            {indicators.map((indicator, position) => (
              <span
                key={position}
                className={`h-2 w-2 rounded-full transition-[background-color,opacity] duration-200 ${indicator.active ? "bg-brand-500" : "bg-neutral-900/15"} ${indicator.faded ? "opacity-40" : "opacity-100"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigateCard(1)}
            disabled={items.length < 2 || (!infiniteEnabled && logicalActiveIndex === items.length - 1)}
            className="flex h-11 w-11 items-center justify-center text-neutral-400 transition-colors duration-200 hover:text-neutral-600 focus-visible:outline focus-visible:outline-1 focus-visible:outline-neutral-400 disabled:cursor-default disabled:opacity-30"
            aria-label="Foto struktur berikutnya"
          >
            <ChevronRight size={18} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[11px] font-light tabular-nums tracking-[0.12em] text-neutral-400" aria-label={`Foto ${items.length ? logicalActiveIndex + 1 : 0} dari ${items.length}`}>
          {items.length ? logicalActiveIndex + 1 : 0}/{items.length}
        </p>
      </div>
    </>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="border-l-2 border-brand-500 pl-4 text-sm text-gray-500">{children}</p>;
}

function SectionHeading({ kicker, title, href, linkLabel }: { kicker: string; title?: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-5">
      <div>
        <p className={`section-kicker ${title ? "mb-3" : ""}`}>{kicker}</p>
        {title && <h2 className="font-display text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">{title}</h2>}
      </div>
      <Link href={href} className="text-link hidden shrink-0 sm:inline-flex">
        {linkLabel} <ArrowUpRight size={14} />
      </Link>
      <Link href={href} className="text-link shrink-0 sm:hidden" aria-label={linkLabel}>
        <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}

function GalleryGrid({ slots, variant, className = "" }: { slots: GallerySlot[]; variant: GalleryVariant; className?: string }) {
  return (
    <div className={`${GALLERY_LAYOUTS[variant].gridClassName} ${className}`} data-gallery-variant={variant}>
      {slots.map((slot, index) => (
        slot.photo ? (
          <HomepageGalleryItem
            key={slot.id}
            photo={slot.photo}
            kind={slot.kind}
            className={slot.className}
          />
        ) : (
          <GalleryPlaceholder
            key={slot.id}
            index={index + 1}
            className={slot.className}
          />
        )
      ))}
    </div>
  );
}

function HomepageGalleryItem({ photo, kind, className }: { photo: GaleriFoto; kind: GallerySlotKind; className: string }) {
  return (
    <figure className={`group relative overflow-hidden rounded-md bg-surface-muted ring-1 ring-inset ring-neutral-900/[0.08] ${className}`}>
      <Image
        src={photo.thumbnail_url ?? photo.foto_url}
        alt={photo.judul || photo.deskripsi || "Foto galeri XI TP2"}
        fill
        sizes={kind === "portrait" ? "(max-width: 768px) 72vw, 25vw" : "(max-width: 768px) 100vw, 55vw"}
        style={{ objectPosition: getGalleryObjectPosition(photo) }}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025] motion-reduce:transition-none"
      />
      {(photo.judul || photo.deskripsi) && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-14 text-white opacity-0 transition-opacity group-hover:opacity-100">
          {photo.judul && <p className="line-clamp-2 text-xs font-medium">{photo.judul}</p>}
          {photo.deskripsi && <p className={`${photo.judul ? "mt-1" : ""} line-clamp-3 text-[11px] font-light leading-relaxed text-white/75`}>{photo.deskripsi}</p>}
        </figcaption>
      )}
    </figure>
  );
}

function GalleryPlaceholder({ index, className }: { index: number; className: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-md border border-neutral-900/[0.08] bg-neutral-50 text-neutral-900/25 ${className}`}
      aria-hidden="true"
    >
      <span className="absolute left-3 top-3 text-[9px] tracking-[0.22em]">{String(index).padStart(2, "0")}</span>
      <span className="absolute right-3 top-3 text-sm font-light">+</span>
      <span className="absolute bottom-4 left-3 text-[8px] tracking-[0.3em]">NEXT MOMENT</span>
      <span className="absolute bottom-3 right-3 h-px w-8 bg-neutral-900/10" />
    </div>
  );
}

function GalleryEmptyState() {
  return (
    <div className="relative flex min-h-72 items-end overflow-hidden border border-neutral-900/[0.08] bg-neutral-50 p-6 sm:p-8">
      <span className="absolute right-6 top-5 text-lg font-light text-neutral-900/20" aria-hidden="true">+</span>
      <span className="absolute left-0 top-1/3 h-px w-16 bg-neutral-900/[0.08]" aria-hidden="true" />
      <div>
        <p className="font-display text-2xl text-neutral-900">Belum ada cerita.</p>
        <p className="mt-2 text-sm font-light text-neutral-500">Momen kelas akan tersimpan di sini.</p>
      </div>
    </div>
  );
}

function PersonItem({ name, role, imageUrl, featured = false }: { name: string; role: string | null; imageUrl: string | null; featured?: boolean }) {
  return (
    <article>
      <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-md bg-surface-muted">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} fill sizes="(max-width: 768px) 50vw, 20vw" className="object-cover object-center" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <User size={featured ? 34 : 28} strokeWidth={1.4} aria-hidden="true" />
          </div>
        )}
      </div>
      <h3 className="text-sm font-semibold leading-snug text-gray-900">{name}</h3>
      {role && <p className="mt-1 text-xs text-gray-500">{role}</p>}
    </article>
  );
}
