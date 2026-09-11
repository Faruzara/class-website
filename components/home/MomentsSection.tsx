"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import RevealOnScroll from "./RevealOnScroll";
import { getMomentPreviewLayers, type MomentPreview } from "./moments-preview";
import { formatMomentTimestamp } from "@/lib/moment-time";

type MomentsSectionProps = {
  items?: readonly MomentPreview[];
  onOpen?: (momentId: string) => void;
};

const LAYER_CLASSES = [
  "moments-home-card-front z-30",
  "moments-home-card-left z-10",
  "moments-home-card-right z-20",
];

export default function MomentsSection({ items = [], onOpen }: MomentsSectionProps) {
  const layers = getMomentPreviewLayers(items);
  const sectionRef = useRef<HTMLDivElement>(null);
  const vfRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (layers.length > 0) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (prefersReduced || isTouch) return;

    const section = sectionRef.current;
    if (!section) return;

    const onMove = (event: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      const rx = (event.clientX - rect.left) / rect.width - 0.5;
      const ry = (event.clientY - rect.top) / rect.height - 0.5;
      const mx = rx * 14;
      const my = ry * 10;

      if (vfRef.current) {
        vfRef.current.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`;
      }
      if (edgeRef.current) {
        edgeRef.current.style.transform = `translate3d(${mx * 0.42}px, ${my * 0.42}px, 0)`;
      }
    };

    const onLeave = () => {
      if (vfRef.current) vfRef.current.style.transform = "translate(-50%, -50%)";
      if (edgeRef.current) edgeRef.current.style.transform = "translate3d(0, 0, 0)";
    };

    section.addEventListener("mousemove", onMove, { passive: true });
    section.addEventListener("mouseleave", onLeave);
    return () => {
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
    };
  }, [layers.length]);

  return (
    <RevealOnScroll>
      <section aria-labelledby="moments-heading" className="moments-home-section relative isolate overflow-hidden border-t border-neutral-900/[0.08] bg-white">
        <div className="moments-home-marquee" aria-hidden="true">
          <div className="moments-home-marquee-track">
            <span>PRECISION&nbsp; • &nbsp;PROCESS&nbsp; • &nbsp;PRACTICE&nbsp; • &nbsp;PROGRESS&nbsp; • &nbsp;</span>
            <span>PRECISION&nbsp; • &nbsp;PROCESS&nbsp; • &nbsp;PRACTICE&nbsp; • &nbsp;PROGRESS&nbsp; • &nbsp;</span>
          </div>
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <h2 id="moments-heading" className="section-kicker mb-8">Moments</h2>
          {layers.length > 0 ? (
            <div className="pb-3 pt-6">
              <div className="relative flex h-[min(108vw,430px)] w-full items-center justify-center [container-type:inline-size]">
              <button
                type="button"
                aria-label="Buka Moments"
                data-preview-count={layers.length}
                className="moments-home-stack group relative block flex-none cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[14px] focus-visible:outline-brand-400"
                onClick={() => onOpen?.(layers[0].id)}
              >
                <span aria-hidden="true" className="pointer-events-none absolute -left-8 top-3 hidden text-2xl font-light text-brand-400/50 sm:block">+</span>
                <span aria-hidden="true" className="pointer-events-none absolute -bottom-2 -left-12 hidden grid-cols-3 gap-2 sm:grid">
                  {Array.from({ length: 9 }, (_, index) => <i key={index} className="h-[3px] w-[3px] rounded-full bg-brand-400/30" />)}
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute -right-8 bottom-0 hidden text-xl font-light text-neutral-900/20 sm:block">+</span>
                {/* One entry point; the low-resolution previews stay obscured. */}
                {layers.map((item, index) => (
                  <span
                    key={item.id}
                    aria-hidden="true"
                    data-moment-layer={index}
                    className={`moments-home-card absolute inset-0 block overflow-hidden rounded-2xl border border-neutral-900/10 bg-white p-2 shadow-[0_14px_35px_rgba(17,24,39,0.12)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${LAYER_CLASSES[index]}`}
                  >
                    <span className="relative block h-[calc(100%-4.25rem)] overflow-hidden rounded-xl bg-neutral-900 shadow-sm">
                      {item.previewSrc && <Image
                        src={item.previewSrc}
                        alt=""
                        width={144}
                        height={192}
                        unoptimized
                        draggable={false}
                        className="absolute inset-0 h-full w-full scale-[1.04] select-none object-cover opacity-75 blur-[4px]"
                        onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
                      />}
                      {index === 0 && <div className="moments-preview-hud" aria-hidden="true">
                        <span className="moments-preview-grid" />
                        <span className="moments-preview-corner moments-preview-corner-tl" />
                        <span className="moments-preview-corner moments-preview-corner-tr" />
                        <span className="moments-preview-corner moments-preview-corner-bl" />
                        <span className="moments-preview-corner moments-preview-corner-br" />
                        <span className="moments-preview-rec"><i />REC</span>
                        <span className="moments-preview-crosshair"><i /><i /><i /><i /></span>
                        <span className="moments-preview-exposure"><i /><i /><i className="is-active" /><i /><i /></span>
                        <span className="moments-preview-focus-label">AF · MF</span>
                      </div>}
                      <span className="absolute inset-0 bg-black/10" />
                    </span>
                    <span className="flex h-[4.25rem] items-center justify-between gap-3 px-2 pt-1.5">
                      <span><span className="block font-mono text-[9px] uppercase text-neutral-400">Moment</span><span className="mt-1 block text-xs font-medium text-neutral-800">Tap untuk melihat</span></span>
                      <time className="shrink-0 text-right font-mono text-[9px] text-neutral-400" dateTime={item.capturedAt ?? item.createdAt}>{formatMomentTimestamp(item.capturedAt ?? item.createdAt)}</time>
                    </span>
                  </span>
                ))}
              </button>
              </div>
            </div>
          ) : (
            <div ref={sectionRef} className="relative pb-3 pt-6" data-moments-empty>
              <p className="sr-only">Belum ada momen baru.</p>
              {/* Reserve the same stage as the populated stack to prevent shift. */}
              <div className="relative h-[min(108vw,430px)] w-full" aria-hidden="true">
                <div ref={edgeRef} className="pointer-events-none absolute inset-3 select-none transition-transform duration-150 ease-out will-change-transform sm:inset-5">
                  <span className="absolute left-0 top-0 h-6 w-6 border-l border-t border-neutral-900/15 sm:h-8 sm:w-8" />
                  <span className="absolute right-0 top-0 h-6 w-6 border-r border-t border-neutral-900/15 sm:h-8 sm:w-8" />
                  <span className="absolute bottom-0 left-0 h-6 w-6 border-b border-l border-neutral-900/15 sm:h-8 sm:w-8" />
                  <span className="absolute bottom-0 right-0 h-6 w-6 border-b border-r border-neutral-900/15 sm:h-8 sm:w-8" />

                  <div className="absolute inset-x-8 top-1 flex items-center justify-between gap-3 font-mono text-[9px] leading-none tracking-[0.16em] text-neutral-900/25 sm:inset-x-12 sm:text-[10px]">
                    <span>STANDBY</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="h-1 w-1 rounded-full bg-brand-500/50" />
                      00:00:00
                    </span>
                  </div>

                  <div ref={vfRef} className="absolute left-1/2 top-1/2 h-14 w-16 -translate-x-1/2 -translate-y-1/2 text-neutral-900/15 transition-transform duration-150 ease-out will-change-transform sm:h-16 sm:w-20">
                    <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-current" />
                    <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-current" />
                    <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-current" />
                    <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-current" />
                    <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/60" />
                  </div>
                </div>
              </div>
              <p className="moments-empty-caption absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tracking-[0.2em] text-neutral-900/[0.28]">
                SOMETHING WILL HAPPEN HERE.
              </p>
            </div>
          )}
        </div>
      </section>
    </RevealOnScroll>
  );
}
