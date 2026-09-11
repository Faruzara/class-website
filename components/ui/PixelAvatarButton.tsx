"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { gsap } from "gsap";
import styles from "./PixelAvatarButton.module.css";

type PixelAvatarButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick"> & {
  src: string;
  alt?: string;
  gridSize?: number;
  pixelColor?: string;
  animationStepDuration?: number;
  onTransition: (rect: DOMRect, source: HTMLButtonElement) => void;
};

const PixelAvatarButton = forwardRef<HTMLButtonElement, PixelAvatarButtonProps>(function PixelAvatarButton(
  {
    src,
    alt = "",
    gridSize = 8,
    pixelColor = "#ffffff",
    animationStepDuration = 0.4,
    onTransition,
    className = "",
    style,
    disabled,
    ...buttonProps
  },
  forwardedRef,
) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLSpanElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [animating, setAnimating] = useState(false);
  const safeGridSize = Math.max(2, Math.min(12, Math.round(gridSize)));

  useImperativeHandle(forwardedRef, () => buttonRef.current as HTMLButtonElement, []);
  useEffect(() => () => {
    timelineRef.current?.kill();
  }, []);

  function handleClick() {
    const button = buttonRef.current;
    if (!button || animating || disabled) return;

    const rect = button.getBoundingClientRect();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onTransition(rect, button);
      return;
    }

    const pixels = gridRef.current?.querySelectorAll<HTMLElement>("[data-pixel]");
    if (!pixels?.length) {
      onTransition(rect, button);
      return;
    }

    setAnimating(true);
    timelineRef.current?.kill();
    gsap.set(pixels, { opacity: 0 });

    const phaseDuration = Math.max(0.1, animationStepDuration) / 2;
    const stagger = phaseDuration / pixels.length;
    timelineRef.current = gsap
      .timeline({ onComplete: () => setAnimating(false) })
      .to(pixels, { opacity: 1, duration: 0, stagger: { each: stagger, from: "random" } })
      .call(() => onTransition(rect, button))
      .to(pixels, { opacity: 0, duration: 0, stagger: { each: stagger, from: "random" } });
  }

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      type="button"
      className={`${styles.button} ${className}`.trim()}
      style={{ ...style, "--pixel-color": pixelColor } as CSSProperties}
      disabled={disabled}
      aria-busy={animating || undefined}
      onClick={handleClick}
    >
      <Image src={src} alt={alt} fill sizes="48px" priority unoptimized className={styles.image} />
      <span
        ref={gridRef}
        aria-hidden="true"
        className={styles.grid}
        style={{
          gridTemplateColumns: `repeat(${safeGridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${safeGridSize}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: safeGridSize * safeGridSize }, (_, index) => (
          <span key={index} data-pixel className={styles.pixel} />
        ))}
      </span>
    </button>
  );
});

export default PixelAvatarButton;
