"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const LINES = [
  { text: "XI TEKNIK", outline: new Set([6, 7]) },
  { text: "PEMESINAN 2", outline: new Set([2, 3]) },
] as const;

export default function HeroShuffleTitle() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    let intervalId: number | null = null;
    let observer: IntersectionObserver | null = null;
    let timeline: gsap.core.Timeline | null = null;
    let hasEntered = false;

    const strips = Array.from(title.querySelectorAll<HTMLElement>("[data-shuffle-strip]"));

    const measure = () => {
      strips.forEach((strip) => {
        const cell = strip.firstElementChild as HTMLElement | null;
        const wrapper = strip.parentElement;
        if (!cell || !wrapper) return;
        wrapper.style.width = `${cell.getBoundingClientRect().width}px`;
      });
    };

    const play = () => {
      if (document.hidden || timeline?.isActive()) return;
      measure();
      const odd = strips.filter((_, index) => index % 2 === 1);
      const even = strips.filter((_, index) => index % 2 === 0);
      gsap.set(strips, { xPercent: -66.6667, force3D: true });
      timeline = gsap.timeline();
      timeline.to(odd, { xPercent: 0, duration: 0.35, stagger: 0.03, ease: "power3.out", force3D: true }, 0);
      timeline.to(even, { xPercent: 0, duration: 0.35, stagger: 0.03, ease: "power3.out", force3D: true }, 0.28);
    };

    const start = () => {
      if (intervalId !== null) return;
      play();
      intervalId = window.setInterval(play, 7000);
    };

    const stop = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else if (hasEntered) start();
    };

    const prepare = async () => {
      if ("fonts" in document) await document.fonts.ready;
      measure();
      observer = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        hasEntered = true;
        start();
        observer?.disconnect();
      }, { threshold: 0.1 });
      observer.observe(title);
    };

    void prepare();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      stop();
      observer?.disconnect();
      timeline?.kill();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <h1 ref={titleRef} aria-label="XI Teknik Pemesinan 2" className="hero-title-font max-w-full text-center text-brand-50">
      {LINES.map((line, lineIndex) => (
        <span key={line.text} aria-hidden="true" className={`${lineIndex ? "mt-2 md:mt-3" : ""} block whitespace-nowrap`}>
          {Array.from(line.text).map((character, index) => character === " " ? (
            <span key={`${lineIndex}-${index}`} className="inline-block w-[0.28em]" />
          ) : (
            <span key={`${lineIndex}-${index}`} className={`inline-block overflow-hidden align-baseline ${line.outline.has(index) ? "hero-title-outline" : ""}`}>
              <span data-shuffle-strip className="flex w-max will-change-transform">
                <span className="block shrink-0">{character}</span>
                <span className="block shrink-0">{character}</span>
                <span className="block shrink-0">{character}</span>
              </span>
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
