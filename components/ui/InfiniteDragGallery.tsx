"use client";

import { createContext, memo, useContext, useEffect, useRef, type ReactNode } from "react";
import { animate, cubicBezier, motion, useMotionValue, wrap } from "motion/react";
import { cva } from "class-variance-authority";
import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";

type GridVariant = "default" | "masonry" | "polaroid";

const GridVariantContext = createContext<GridVariant | undefined>(undefined);

const itemVariants = {
  initial: { opacity: 0, scale: 0.3 },
  animate: () => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: Math.random() + 0.25,
      duration: 1.1,
      ease: cubicBezier(0.18, 0.71, 0.11, 1),
    },
  }),
};

export function DraggableContainer({
  children,
  className,
  variant,
  onDragStart,
  onDragEnd,
}: {
  children: ReactNode;
  className?: string;
  variant?: GridVariant;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const wheelAnimationRef = useRef<{ stop: () => void } | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = canvas.getBoundingClientRect().width;
    let height = canvas.getBoundingClientRect().height;
    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    });
    resizeObserver.observe(canvas);

    const wrapAxis = (value: number, size: number, axis: typeof x) => {
      if (size <= 0) return;
      const wrapped = wrap(-(size / 2), 0, value);
      if (Math.abs(wrapped - value) > 0.5) axis.jump(wrapped);
    };

    const stopX = x.on("change", (value) => wrapAxis(value, width, x));
    const stopY = y.on("change", (value) => wrapAxis(value, height, y));
    return () => {
      resizeObserver.disconnect();
      stopX();
      stopY();
    };
  }, [x, y]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (isDraggingRef.current) return;
      event.preventDefault();
      wheelAnimationRef.current?.stop();

      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const axis = horizontal ? x : y;
      const delta = horizontal ? event.deltaX : event.deltaY;
      wheelAnimationRef.current = animate(axis, axis.get() - delta * 2.7, {
        type: "tween",
        duration: 0.65,
        ease: cubicBezier(0.18, 0.71, 0.11, 1),
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      wheelAnimationRef.current?.stop();
    };
  }, [x, y]);

  const leaveGallery = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const edge = direction < 0 ? rect.top : rect.bottom;
    window.scrollTo({
      top: window.scrollY + edge + (direction < 0 ? -96 : 16),
      behavior: "smooth",
    });
  };

  return (
    <GridVariantContext.Provider value={variant}>
      <div ref={viewportRef} className="relative h-dvh min-h-[520px] w-full overflow-hidden bg-transparent">
        <motion.div
          ref={canvasRef}
          className={clsx(
            "grid h-fit w-fit touch-none cursor-grab grid-cols-[repeat(2,1fr)] bg-transparent active:cursor-grabbing will-change-transform",
            className,
          )}
          drag
          dragMomentum
          dragTransition={{
            timeConstant: 200,
            power: 0.28,
            restDelta: 0,
            bounceStiffness: 0,
          }}
          onDragStart={() => {
            isDraggingRef.current = true;
            wheelAnimationRef.current?.stop();
            onDragStart?.();
          }}
          onDragEnd={() => {
            isDraggingRef.current = false;
            onDragEnd?.();
          }}
          style={{ x, y }}
        >
          {children}
        </motion.div>

        <div className="pointer-events-none absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 md:hidden">
          <button
            type="button"
            className="pointer-events-auto grid size-9 place-items-center rounded-full border border-gray-200 bg-white/90 text-gray-700 shadow-md backdrop-blur-sm"
            onClick={() => leaveGallery(-1)}
            aria-label="Keluar ke bagian atas galeri"
            title="Ke atas"
          >
            <ChevronUp size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pointer-events-auto grid size-9 place-items-center rounded-full border border-gray-200 bg-white/90 text-gray-700 shadow-md backdrop-blur-sm"
            onClick={() => leaveGallery(1)}
            aria-label="Keluar ke bagian bawah galeri"
            title="Ke bawah"
          >
            <ChevronDown size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </GridVariantContext.Provider>
  );
}

const gridItemStyles = cva(
  "h-full w-full overflow-hidden will-change-transform hover:cursor-pointer",
  {
    variants: {
      variant: {
        default: "rounded-sm",
        masonry: "even:mt-[60%] rounded-sm",
        polaroid:
          "even:mt-[60%] even:rotate-3 odd:-rotate-2 border-[10px] border-b-[28px] border-white shadow-xl transition-transform duration-300 ease-out hover:rotate-0",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function GridItem({ children, className }: { children: ReactNode; className?: string }) {
  const variant = useContext(GridVariantContext);
  return (
    <motion.div
      className={clsx(gridItemStyles({ variant }), className)}
      variants={itemVariants}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  );
}

const gridBodyStyles = cva("grid h-fit w-fit grid-cols-[repeat(6,1fr)]", {
  variants: {
    variant: {
      default: "gap-14 p-7 md:gap-28 md:p-14",
      masonry: "gap-x-14 px-7 md:gap-x-28 md:px-14",
      polaroid: "gap-x-14 px-7 md:gap-x-28 md:px-14",
    },
  },
  defaultVariants: { variant: "default" },
});

export const GridBody = memo(function GridBody({ children, className }: { children: ReactNode; className?: string }) {
  const variant = useContext(GridVariantContext);
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={clsx(gridBodyStyles({ variant }), className)}>
          {children}
        </div>
      ))}
    </>
  );
});
