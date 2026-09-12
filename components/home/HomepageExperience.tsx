"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import RevealOnScroll from "./RevealOnScroll";
import { getHeroStoryFrame } from "./hero-scroll";
import HeroShuffleTitle from "./HeroShuffleTitle";

const ABOUT_VALUES = [
  { title: "Discipline", description: "Learning with responsibility and consistency every day." },
  { title: "Collaboration", description: "Supporting, respecting, and growing with one another." },
  { title: "Growth", description: "Continuously improving our skills and facing new challenges." },
] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function smoothstep(start: number, end: number, value: number) {
  const progress = clamp((value - start) / (end - start || 0.000001));
  return progress * progress * (3 - 2 * progress);
}

function getRisingVeilMask(amount: number) {
  const boundary = 100 - clamp(amount) * 90;
  const transparentUntil = Math.min(100, Math.max(0, boundary - 18));
  const featherCenter = Math.min(100, Math.max(0, boundary));
  const solidFrom = Math.min(100, Math.max(0, boundary + 24));
  return `linear-gradient(to bottom, transparent 0%, transparent ${transparentUntil}%, rgba(0, 0, 0, 0.18) ${featherCenter}%, black ${solidFrom}%, black 100%)`;
}

export default function HomepageExperience({
  heroImage,
  aboutText,
  objectFit = "cover",
  objectPosition = "50% 50%",
}: {
  heroImage: string;
  aboutText: string;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const introCopyRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const aboutContentRef = useRef<HTMLDivElement>(null);
  const splashRef = useRef<HTMLDivElement>(null);
  const splashFinishedRef = useRef(false);
  const splashHideTimerRef = useRef<number | null>(null);
  const splashMinimumTimerRef = useRef<number | null>(null);
  const splashStartedRef = useRef<number | null>(null);
  const splashPageColorsRef = useRef<{ html: string; body: string } | null>(null);
  const splashFrameRef = useRef<number[]>([]);

  const restoreSplashPageColors = useCallback(() => {
    const previous = splashPageColorsRef.current;
    if (!previous) return;
    document.documentElement.style.backgroundColor = previous.html;
    document.body.style.backgroundColor = previous.body;
    splashPageColorsRef.current = null;
  }, []);

  const finishSplash = useCallback(() => {
    if (splashFinishedRef.current) return;
    splashFinishedRef.current = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumDuration = reducedMotion ? 100 : 750;
    const elapsed = splashStartedRef.current === null
      ? 0
      : performance.now() - splashStartedRef.current;

    const beginExit = () => {
      const firstFrame = window.requestAnimationFrame(() => {
        const secondFrame = window.requestAnimationFrame(() => {
          const splash = splashRef.current;
          if (!splash) return;
          splash.style.opacity = "0";
          splash.style.pointerEvents = "none";
          splashHideTimerRef.current = window.setTimeout(() => {
            if (splashRef.current) splashRef.current.style.display = "none";
            restoreSplashPageColors();
          }, 500);
        });
        splashFrameRef.current.push(secondFrame);
      });
      splashFrameRef.current.push(firstFrame);
    };

    const remaining = Math.max(0, minimumDuration - elapsed);
    if (remaining > 0) {
      splashMinimumTimerRef.current = window.setTimeout(beginExit, remaining);
    } else {
      beginExit();
    }
  }, [restoreSplashPageColors]);

  const handleHeroReady = useCallback(() => {
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(finishSplash, finishSplash);
  }, [finishSplash]);

  useEffect(() => {
    splashFinishedRef.current = false;
    splashPageColorsRef.current = {
      html: document.documentElement.style.backgroundColor,
      body: document.body.style.backgroundColor,
    };
    document.documentElement.style.backgroundColor = "#121212";
    document.body.style.backgroundColor = "#121212";
    splashStartedRef.current = performance.now();
    if (mediaRef.current?.complete) handleHeroReady();
    const fallbackTimer = window.setTimeout(finishSplash, 2000);
    return () => {
      window.clearTimeout(fallbackTimer);
      if (splashHideTimerRef.current !== null) window.clearTimeout(splashHideTimerRef.current);
      if (splashMinimumTimerRef.current !== null) window.clearTimeout(splashMinimumTimerRef.current);
      splashFrameRef.current.forEach((frame) => window.cancelAnimationFrame(frame));
      splashFrameRef.current = [];
      restoreSplashPageColors();
    };
  }, [finishSplash, handleHeroReady, restoreSplashPageColors]);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let currentExpansion = 0;
    let targetExpansion = 0;
    let running = false;

    const applyFrame = (expansion: number) => {
      const viewportHeight = stage.offsetHeight || window.innerHeight;
      const rootTop = root.getBoundingClientRect().top;
      const aboutTop = aboutRef.current?.getBoundingClientRect().top ?? viewportHeight;
      const visual = getHeroStoryFrame(aboutTop, viewportHeight);
      const easedExpansion = smoothstep(0, 1, expansion);

      if (frameRef.current) {
        const width = 42 + 58 * easedExpansion;
        const height = 58 + 42 * easedExpansion;
        const insetX = (100 - width) / 2;
        const insetY = (100 - height) / 2;
        const radius = 24 * (1 - easedExpansion);
        frameRef.current.style.clipPath = `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`;
      }

      if (mediaRef.current) {
        mediaRef.current.style.transform = `scale(${1.35 - 0.35 * easedExpansion})`;
        mediaRef.current.style.filter = visual.blurOpacity > 0.001
          ? `blur(${2 * visual.blurOpacity}px)`
          : "none";
      }
      if (scrimRef.current) scrimRef.current.style.opacity = String(0.2 * easedExpansion);

      if (titleRef.current) {
        const exit = smoothstep(0.4, 0.88, expansion);
        titleRef.current.style.opacity = String(1 - exit);
        titleRef.current.style.transform = `translate3d(0, ${-28 * exit}px, 0) scale(${1 + 0.06 * exit})`;
      }
      if (hintRef.current) {
        const exit = smoothstep(0, 0.12, expansion);
        hintRef.current.style.opacity = String(1 - exit);
        hintRef.current.style.transform = `translate3d(0, ${8 * exit}px, 0)`;
      }
      if (introCopyRef.current) {
        const enter = smoothstep(0.68, 1, expansion);
        const leave = smoothstep(0, 0.24, visual.progress);
        introCopyRef.current.style.opacity = String(enter * (1 - leave));
        introCopyRef.current.style.transform = `translate3d(0, ${18 * (1 - enter) - 12 * leave}px, 0)`;
      }

      const veilMask = getRisingVeilMask(visual.blurOpacity);
      if (veilRef.current) {
        veilRef.current.style.opacity = String(visual.whiteOpacity);
        veilRef.current.style.webkitMaskImage = veilMask;
        veilRef.current.style.maskImage = veilMask;
      }
      if (aboutContentRef.current) {
        aboutContentRef.current.style.opacity = String(visual.aboutOpacity);
        aboutContentRef.current.style.transform = `translate3d(0, ${visual.aboutY}px, 0)`;
      }

      targetExpansion = clamp(-rootTop / Math.max(viewportHeight * 1.2, 1));
    };

    const tick = () => {
      const strength = 1 - Math.exp(-1 / 6);
      currentExpansion += (targetExpansion - currentExpansion) * strength;
      if (Math.abs(targetExpansion - currentExpansion) < 0.0004) {
        currentExpansion = targetExpansion;
        running = false;
      }
      applyFrame(currentExpansion);
      animationFrame = running ? window.requestAnimationFrame(tick) : 0;
    };

    const kick = () => {
      const viewportHeight = stage.offsetHeight || window.innerHeight;
      targetExpansion = clamp(-root.getBoundingClientRect().top / Math.max(viewportHeight * 1.2, 1));
      if (reducedMotion.matches) {
        currentExpansion = 1;
        applyFrame(1);
        return;
      }
      if (running) return;
      running = true;
      animationFrame = window.requestAnimationFrame(tick);
    };

    const syncMotion = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      running = false;
      if (reducedMotion.matches) {
        currentExpansion = 1;
        targetExpansion = 1;
        applyFrame(1);
        if (mediaRef.current) mediaRef.current.style.filter = "none";
        if (veilRef.current) veilRef.current.style.opacity = "0";
        if (titleRef.current) titleRef.current.style.opacity = "1";
        if (introCopyRef.current) introCopyRef.current.style.opacity = "0";
        if (aboutContentRef.current) {
          aboutContentRef.current.style.opacity = "1";
          aboutContentRef.current.style.transform = "none";
        }
        return;
      }
      const viewportHeight = stage.offsetHeight || window.innerHeight;
      targetExpansion = clamp(-root.getBoundingClientRect().top / Math.max(viewportHeight * 1.2, 1));
      currentExpansion = targetExpansion;
      applyFrame(currentExpansion);
    };

    syncMotion();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick, { passive: true });
    window.addEventListener("pageshow", kick, { passive: true });
    reducedMotion.addEventListener("change", syncMotion);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      window.removeEventListener("pageshow", kick);
      reducedMotion.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <div ref={rootRef} className="hero-experience relative overflow-x-clip bg-white">
      <div
        ref={splashRef}
        className="fixed -inset-[2px] z-[999] flex min-h-[calc(100svh+4px)] items-center justify-center bg-[#121212] opacity-100 transition-opacity duration-500"
        aria-label="Memuat halaman"
      >
        <div className="hero-splash-loader flex flex-col items-center text-white">
          <div className="hero-splash-bars" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
          </div>
          <div className="mt-4 flex w-full justify-center overflow-hidden">
            <p className="hero-splash-label whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white">
              LOADING<span className="hero-splash-cursor">_</span>
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-0">
        <div ref={stageRef} className="hero-story-backdrop pointer-events-none sticky top-0 h-[100svh] overflow-hidden bg-[#121212] md:h-screen">
          <div
            ref={frameRef}
            className="hero-expand-frame absolute inset-0 overflow-hidden [clip-path:inset(21%_29%_21%_29%_round_24px)] [will-change:clip-path]"
          >
            <Image
              ref={mediaRef}
              src={heroImage}
              alt="Siswa XI Teknik Pemesinan 2 di bengkel praktik"
              fill
              priority
              sizes="100vw"
              draggable={false}
              onLoad={handleHeroReady}
              className="origin-center select-none [will-change:filter,transform]"
              style={{ objectFit, objectPosition }}
            />
            <div ref={scrimRef} className="absolute inset-0 bg-black opacity-0" />
            <div ref={introCopyRef} className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center text-white opacity-0">
              <h2 className="text-[clamp(2.25rem,7vw,5.5rem)] font-bold uppercase leading-none tracking-[-0.03em]">SMKN Jambu</h2>
              <p className="mt-5 text-sm font-light leading-[1.8] tracking-[0.12em] text-white/75 sm:text-base md:text-lg">Precision. Discipline. Growth.</p>
            </div>
            <div ref={veilRef} className="absolute inset-0 z-20 bg-white opacity-0" />
          </div>
          <div className="hero-noise pointer-events-none absolute inset-0 z-30" aria-hidden="true" />
        </div>
      </div>

      <section data-navbar-tone="dark" aria-label="XI Teknik Pemesinan 2" className="relative z-10 h-[255svh] motion-reduce:h-[100svh] md:h-[255vh] md:motion-reduce:h-screen">
        <div className="sticky top-0 h-[100svh] md:h-screen">
          <div ref={titleRef} className="absolute inset-0 z-20 flex items-center justify-center px-5 text-center text-white [will-change:opacity,transform]">
            <HeroShuffleTitle />
          </div>
          <div ref={hintRef} className="absolute inset-x-0 bottom-8 z-20 flex flex-col items-center [will-change:opacity,transform]">
            <div className="h-8 w-px bg-white/40" aria-hidden="true" />
            <span className="mt-3 text-[10px] uppercase tracking-[0.35em] text-white/65">Scroll to explore</span>
          </div>
        </div>
      </section>

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
        <div ref={aboutContentRef} className="relative z-10 mx-auto w-full max-w-7xl translate-y-[22px] px-5 py-20 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100 md:py-28 lg:px-8">
          <div className="grid gap-14 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16 lg:gap-24">
            <div className="md:pt-1">
              <h2 id="hero-about-heading" className="section-kicker mb-6">About Us</h2>
              <p className="max-w-[34rem] font-display text-3xl font-light leading-[1.25] tracking-[-0.02em] text-gray-900 sm:text-4xl">{aboutText}</p>
              <div className="mt-7 flex flex-wrap gap-2" aria-label="Nilai kelas">
                {["Belajar", "Berkarya", "Bertumbuh"].map((label) => (
                  <span key={label} className="rounded-full border border-neutral-900/[0.10] bg-neutral-50/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 transition-colors duration-200 hover:border-neutral-900/[0.16] hover:text-neutral-700">{label}</span>
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
