"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const progress = clamp((value - edge0) / (edge1 - edge0 || 0.000001), 0, 1);
  return progress * progress * (3 - 2 * progress);
};

export interface ScrollExpandProps {
  src: string;
  alt?: string;
  title?: ReactNode;
  titleLabel?: string;
  scrollHint?: string;
  startWidth?: number;
  startHeight?: number;
  startRadius?: number;
  endRadius?: number;
  mediaZoom?: number;
  scrollDistance?: number;
  holdDistance?: number;
  smoothing?: number;
  overlayScrim?: number;
  useWindowScroll?: boolean;
  enabled?: boolean;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function ScrollExpand({
  src,
  alt = "",
  title,
  titleLabel,
  scrollHint = "",
  startWidth = 42,
  startHeight = 58,
  startRadius = 24,
  endRadius = 0,
  mediaZoom = 1.35,
  scrollDistance = 1.2,
  holdDistance = 0.35,
  smoothing = 0.1,
  overlayScrim = 0.45,
  useWindowScroll = true,
  enabled = true,
  objectFit = "cover",
  objectPosition = "50% 50%",
  children,
  className = "",
  style,
}: ScrollExpandProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const configRef = useRef({
    startWidth,
    startHeight,
    startRadius,
    endRadius,
    mediaZoom,
    scrollDistance,
    holdDistance,
    smoothing,
    overlayScrim,
    useWindowScroll,
    enabled,
  });

  configRef.current = {
    startWidth,
    startHeight,
    startRadius,
    endRadius,
    mediaZoom,
    scrollDistance,
    holdDistance,
    smoothing,
    overlayScrim,
    useWindowScroll,
    enabled,
  };

  const applyProgress = useCallback((progress: number) => {
    const frame = frameRef.current;
    const media = mediaRef.current;
    if (!frame || !media) return;

    const config = configRef.current;
    const eased = smoothstep(0, 1, progress);
    const width = config.startWidth + (100 - config.startWidth) * eased;
    const height = config.startHeight + (100 - config.startHeight) * eased;
    const insetX = Math.max(0, (100 - width) / 2);
    const insetY = Math.max(0, (100 - height) / 2);
    const radius = config.startRadius + (config.endRadius - config.startRadius) * eased;

    frame.style.clipPath = `inset(${insetY}% ${insetX}% ${insetY}% ${insetX}% round ${radius}px)`;
    media.style.transform = `scale(${config.mediaZoom + (1 - config.mediaZoom) * eased})`;

    if (scrimRef.current) {
      scrimRef.current.style.opacity = String(config.overlayScrim * eased);
    }
    if (titleRef.current) {
      const exit = smoothstep(0.4, 0.88, progress);
      titleRef.current.style.opacity = String(1 - exit);
      titleRef.current.style.transform = `translate3d(0, ${-28 * exit}px, 0) scale(${1 + 0.06 * exit})`;
    }
    if (hintRef.current) {
      const exit = smoothstep(0, 0.12, progress);
      hintRef.current.style.opacity = String(1 - exit);
      hintRef.current.style.transform = `translate3d(0, ${8 * exit}px, 0)`;
    }
    if (overlayRef.current) {
      const enter = smoothstep(0.68, 1, progress);
      overlayRef.current.style.opacity = String(enter);
      overlayRef.current.style.transform = `translate3d(0, ${18 * (1 - enter)}px, 0)`;
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!root || !track || !stage) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let current = 0;
    let target = 0;
    let stageHeight = 0;
    let running = false;

    const measure = () => {
      const config = configRef.current;
      stageHeight = config.useWindowScroll ? window.innerHeight : root.clientHeight;
      if (stageHeight <= 0) return;
      stage.style.height = `${stageHeight}px`;
      track.style.height = reducedMotion
        ? `${stageHeight}px`
        : `${stageHeight * (1 + Math.max(0, config.scrollDistance) + Math.max(0, config.holdDistance))}px`;
    };

    const readProgress = () => {
      const config = configRef.current;
      if (!config.enabled || reducedMotion) return 1;
      const distance = stageHeight * Math.max(0.01, config.scrollDistance);
      return config.useWindowScroll
        ? clamp(-track.getBoundingClientRect().top / distance, 0, 1)
        : clamp(root.scrollTop / distance, 0, 1);
    };

    const tick = () => {
      const config = configRef.current;
      const strength = config.smoothing <= 0
        ? 1
        : 1 - Math.exp(-1 / (60 * config.smoothing));
      current += (target - current) * strength;
      if (Math.abs(target - current) < 0.0004) {
        current = target;
        running = false;
      }
      applyProgress(current);
      animationFrame = running ? window.requestAnimationFrame(tick) : 0;
    };

    const kick = () => {
      if (running) return;
      running = true;
      if (!animationFrame) animationFrame = window.requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = readProgress();
      if (configRef.current.smoothing <= 0 || reducedMotion) {
        current = target;
        applyProgress(current);
        return;
      }
      kick();
    };

    const onResize = () => {
      measure();
      target = readProgress();
      current = target;
      applyProgress(current);
    };

    measure();
    target = readProgress();
    current = target;
    applyProgress(current);

    const scroller: Window | HTMLDivElement = useWindowScroll ? window : root;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(root);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
    };
  }, [applyProgress, useWindowScroll]);

  return (
    <div
      ref={rootRef}
      data-navbar-tone="dark"
      className={`scroll-expand relative z-10 w-full ${useWindowScroll ? "" : "h-full overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"} ${className}`.trim()}
      style={style}
    >
      <div ref={trackRef} className="relative min-h-[255svh] w-full motion-reduce:min-h-[100svh] md:min-h-[255vh] md:motion-reduce:min-h-screen">
        <div ref={stageRef} className="sticky top-0 h-[100svh] w-full overflow-hidden bg-neutral-950 md:h-screen">
          <div
            ref={frameRef}
            className="absolute inset-0 [clip-path:inset(21%_29%_21%_29%_round_24px)] [will-change:clip-path]"
          >
            <Image
              ref={mediaRef}
              src={src}
              alt={alt}
              fill
              priority
              draggable={false}
              sizes="100vw"
              className="origin-center select-none [will-change:transform]"
              style={{ objectFit, objectPosition }}
            />
            <div
              ref={scrimRef}
              className="pointer-events-none absolute inset-0 bg-black opacity-0"
            />
            {children ? (
              <div
                ref={overlayRef}
                className="absolute inset-0 flex flex-col items-center justify-center p-[6%] text-center text-white opacity-0 [will-change:opacity,transform]"
              >
                {children}
              </div>
            ) : null}
          </div>

          {title ? (
            <div
              ref={titleRef}
              aria-label={titleLabel}
              className="pointer-events-none absolute inset-0 flex items-center justify-center px-[5%] text-center text-white [will-change:opacity,transform]"
            >
              {title}
            </div>
          ) : null}

          {scrollHint ? (
            <div
              ref={hintRef}
              className="pointer-events-none absolute inset-x-0 bottom-8 flex flex-col items-center text-center [will-change:opacity,transform]"
            >
              <div className="h-8 w-px bg-white/40" aria-hidden="true" />
              <span className="mt-3 text-[10px] uppercase tracking-[0.35em] text-white/65">{scrollHint}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
