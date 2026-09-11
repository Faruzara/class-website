"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import RevealOnScroll from "./RevealOnScroll";
import { getHeroStoryFrame } from "./hero-scroll";

const ABOUT_VALUES = [
  {
    title: "Discipline",
    description: "Learning with responsibility and consistency every day.",
  },
  {
    title: "Collaboration",
    description: "Supporting, respecting, and growing with one another.",
  },
  {
    title: "Growth",
    description: "Continuously improving our skills and facing new challenges.",
  },
] as const;

function getRisingFogMask(amount: number) {
  const progress = Math.min(1, Math.max(0, amount));
  const boundary = 100 - progress * 90;
  const transparentUntil = Math.min(100, Math.max(0, boundary - 18));
  const featherCenter = Math.min(100, Math.max(0, boundary));
  const solidFrom = Math.min(100, Math.max(0, boundary + 24));
  return `linear-gradient(to bottom, transparent 0%, transparent ${transparentUntil}%, rgba(0, 0, 0, 0.18) ${featherCenter}%, black ${solidFrom}%, black 100%)`;
}

export default function HomepageHero({ fallbackHero, fallbackAbout, objectFit = "cover", objectPosition = "50% 50%", showTitle = true, seamlessHandoff = false }: { fallbackHero: string; fallbackAbout: string; objectFit?: "cover" | "contain"; objectPosition?: string; showTitle?: boolean; seamlessHandoff?: boolean }) {
  const storyRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const aboutContentRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const bottomFogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = aboutRef.current;
      if (!element) return;
      // The actual sticky height stays accurate with mobile browser toolbars.
      const viewportHeight = stickyRef.current?.offsetHeight ?? window.innerHeight;
      const aboutTop = element.getBoundingClientRect().top;
      const storyTop = storyRef.current?.getBoundingClientRect().top ?? 0;
      const handoffDistance = seamlessHandoff ? viewportHeight * 0.12 : 0;
      if (seamlessHandoff && stickyRef.current) {
        const handoffProgress = Math.min(1, Math.max(0, -storyTop / Math.max(handoffDistance, 1)));
        stickyRef.current.style.opacity = String(handoffProgress);
      }
      // The real distance from Hero start to About includes the visual runway,
      // so resizing mobile browser chrome cannot shorten the transition.
      // During a seamless handoff, reserve its first 12svh exclusively for the
      // crossfade. Fog and About motion begin only after both photos are aligned.
      const scrollDistance = Math.max(aboutTop - storyTop - handoffDistance, viewportHeight);
      const visual = getHeroStoryFrame(aboutTop, scrollDistance);
      const risingFogMask = getRisingFogMask(visual.blurOpacity);
      if (blurRef.current) {
        blurRef.current.style.opacity = String(visual.blurOpacity);
        blurRef.current.style.webkitMaskImage = risingFogMask;
        blurRef.current.style.maskImage = risingFogMask;
      }
      if (bottomFogRef.current) bottomFogRef.current.style.opacity = String(visual.blurOpacity * 0.42);
      if (overlayRef.current) {
        overlayRef.current.style.opacity = String(visual.whiteOpacity);
        overlayRef.current.style.webkitMaskImage = risingFogMask;
        overlayRef.current.style.maskImage = risingFogMask;
      }
      if (textRef.current) {
        textRef.current.style.opacity = String(visual.titleOpacity);
      }
      if (aboutContentRef.current) {
        aboutContentRef.current.style.opacity = String(visual.aboutOpacity);
        aboutContentRef.current.style.transform = `translate3d(0, ${visual.aboutY}px, 0)`;
      }
      if (hintRef.current) hintRef.current.style.opacity = String(visual.hintOpacity);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pageshow", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const syncMotion = () => {
      stop();
      if (reducedMotion.matches) {
        if (blurRef.current) blurRef.current.style.opacity = "0";
        if (bottomFogRef.current) bottomFogRef.current.style.opacity = "0";
        if (stickyRef.current) stickyRef.current.style.opacity = "1";
        if (overlayRef.current) overlayRef.current.style.opacity = "0";
        if (textRef.current) {
          textRef.current.style.opacity = "1";
        }
        if (aboutContentRef.current) {
          aboutContentRef.current.style.opacity = "1";
          aboutContentRef.current.style.transform = "none";
        }
        if (hintRef.current) hintRef.current.style.opacity = "1";
        return;
      }
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      window.addEventListener("pageshow", onScroll, { passive: true });
    };
    syncMotion();
    reducedMotion.addEventListener("change", syncMotion);
    return () => {
      stop();
      reducedMotion.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
      <div ref={storyRef} className={`hero-story relative isolate ${seamlessHandoff ? "bg-transparent" : "bg-white"}`}>
        <div className="pointer-events-none absolute inset-0 z-0">
        <div ref={stickyRef} className={`hero-story-backdrop pointer-events-none sticky top-0 h-[100svh] overflow-hidden bg-white md:h-screen ${seamlessHandoff ? "opacity-0 motion-reduce:opacity-100" : ""}`}>
          <div className="absolute inset-0">
            <div className="absolute inset-0">
              <div className="absolute inset-0">
                <Image src={fallbackHero} alt="Siswa XI Teknik Pemesinan 2 di bengkel praktik" fill priority sizes="100vw" style={{ objectFit, objectPosition }} />
                {/* Same photograph and crop, lower resolution and a fixed blur.
                    Only this layer's opacity changes during scrolling. */}
                <div ref={blurRef} aria-hidden="true" className="hero-fog-photo pointer-events-none absolute inset-0 opacity-0 motion-reduce:hidden">
                  <Image src={fallbackHero} alt="" fill loading="eager" sizes="40vw" quality={45} className="blur-[14px]" style={{ objectFit, objectPosition }} />
                  <span className="absolute inset-0 bg-white/15" />
                </div>
              </div>
            </div>
            <div className="absolute inset-0 bg-black/20" />
          </div>
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 z-10 bg-white opacity-0"
          />
          <div ref={bottomFogRef} className="hero-bottom-fog pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[18%] opacity-0 motion-reduce:hidden" />
          <div className="hero-noise pointer-events-none absolute inset-0 z-30" aria-hidden="true" />
        </div>
        </div>
        <section data-navbar-tone="dark" aria-label="XI Teknik Pemesinan 2" className="hero-story-title pointer-events-none sticky top-0 z-10 h-[100svh] motion-reduce:relative md:h-screen">
          {showTitle ? <div ref={textRef} className="absolute inset-0 z-20">
            <div className="pointer-events-none absolute left-5 top-24 max-w-xs md:left-10 md:top-28 lg:left-16">
              <p className="text-[11px] font-normal uppercase tracking-[0.38em] text-white/40">SMKN Jambu</p>
              <p className="mt-3 text-sm font-light leading-[1.8] tracking-[0.05em] text-white/70">Precision. Discipline. Growth.</p>
            </div>
            <div className="relative flex h-full items-center justify-center px-5 pt-[12vh]">
              <h1 aria-label="XI Teknik Pemesinan 2" className="hero-title-font hero-title-enter mt-[13vh] max-w-full text-center text-brand-50">
                <span aria-hidden="true" className="block whitespace-nowrap">
                  XI TEK<span className="hero-title-outline">NI</span>K
                </span>
                <span aria-hidden="true" className="mt-2 block whitespace-nowrap md:mt-3">
                  PE<span className="hero-title-outline">ME</span>SINAN 2
                </span>
              </h1>
            </div>
          </div> : null}
          {showTitle ? <div ref={hintRef} className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex flex-col items-center">
            <div className="h-8 w-px bg-white/40" aria-hidden="true" />
            <span className="mt-3 text-[10px] font-normal uppercase tracking-[0.35em] text-white/65">Scroll to explore</span>
          </div> : null}
        </section>

        <div data-navbar-tone="dark" aria-hidden="true" className="hero-story-runway h-[50svh] motion-reduce:hidden md:h-[50vh]" />

        <section ref={aboutRef} aria-labelledby="hero-about-heading" className="hero-story-about relative z-10 flex min-h-[100svh] items-center overflow-hidden md:min-h-screen">
          <div className="technical-grid pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="technical-grid-marker technical-grid-marker-one" />
            <span className="technical-grid-marker technical-grid-marker-two" />
            <span className="technical-grid-marker technical-grid-marker-three" />
            <span className="technical-grid-marker technical-grid-marker-four" />
            <span className="technical-grid-marker technical-grid-marker-five" />
            <span className="technical-grid-marker technical-grid-marker-six" />
            <span className="technical-grid-marker technical-grid-marker-seven" />
          </div>
          <div ref={aboutContentRef} className="hero-story-copy relative z-10 mx-auto w-full max-w-7xl translate-y-[22px] px-5 py-20 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100 lg:px-8 md:py-28">
            <div className="grid gap-14 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16 lg:gap-24">
              <div className="md:pt-1">
                <h2 id="hero-about-heading" className="section-kicker mb-6">About Us</h2>
                <p className="max-w-[34rem] font-display text-3xl font-light leading-[1.25] tracking-[-0.02em] text-gray-900 sm:text-4xl">
                  {fallbackAbout}
                </p>
                <div className="mt-7 flex flex-wrap gap-2" aria-label="Nilai kelas">
                  {["Belajar", "Berkarya", "Bertumbuh"].map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-neutral-900/[0.10] bg-neutral-50/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 transition-colors duration-200 hover:border-neutral-900/[0.16] hover:text-neutral-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-200">
                {ABOUT_VALUES.map((value, index) => (
                  <RevealOnScroll key={value.title} className={`border-b border-neutral-200 py-6 md:py-7 ${index === 0 ? "delay-100" : index === 1 ? "delay-200" : "delay-300"}`}>
                    <article>
                      <p className="mb-3 text-xs font-medium tracking-[0.18em] text-brand-600">{String(index + 1).padStart(2, "0")}</p>
                      <h3 className="mb-2 text-lg font-medium tracking-[-0.01em] text-neutral-900">{value.title}</h3>
                      <p className="max-w-md text-sm font-light leading-7 text-neutral-500">{value.description}</p>
                    </article>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
  );
}
