import type { GaleriFoto } from "@/types";
import type { GalleryOrientation } from "@/lib/gallery-focus";

export type GalleryVariant = "A" | "B" | "C";
export type GallerySlotKind = GalleryOrientation;
export type GallerySlot = { id: string; kind: GallerySlotKind; photo: GaleriFoto | null; className: string };
export type GalleryPools = { portraits: GaleriFoto[]; landscapes: GaleriFoto[] };
export type GallerySession = { variant: GalleryVariant; seed: number };
type GalleryLayout = { gridClassName: string; slots: Omit<GallerySlot, "photo">[] };

export const GALLERY_LAYOUTS: Record<GalleryVariant, GalleryLayout> = {
  // Original Variant A classes and mobile placement are intentionally unchanged.
  A: {
    gridClassName: "grid grid-cols-2 gap-2 md:aspect-[16/9] md:[grid-template-columns:repeat(16,minmax(0,1fr))] md:[grid-template-rows:3fr_2fr_3fr] md:gap-3",
    slots: [
      { id: "portrait-1", kind: "portrait", className: "col-start-1 row-start-1 aspect-[3/4] w-full md:aspect-auto md:w-auto md:justify-self-stretch md:[grid-column:1/5] md:[grid-row:1/3]" },
      { id: "landscape-1", kind: "landscape", className: "col-span-2 col-start-1 row-start-2 aspect-[16/10] md:aspect-auto md:[grid-column:5/17] md:[grid-row:1/2]" },
      { id: "landscape-2", kind: "landscape", className: "col-start-1 row-start-3 aspect-[16/10] md:aspect-auto md:[grid-column:5/9] md:[grid-row:2/3]" },
      { id: "landscape-3", kind: "landscape", className: "col-start-2 row-start-3 aspect-[16/10] md:aspect-auto md:[grid-column:9/13] md:[grid-row:2/3]" },
      { id: "landscape-4", kind: "landscape", className: "col-span-2 col-start-1 row-start-4 aspect-[16/10] md:aspect-auto md:[grid-column:1/13] md:[grid-row:3/4]" },
      { id: "portrait-2", kind: "portrait", className: "col-start-2 row-start-1 aspect-[3/4] w-full md:aspect-auto md:w-auto md:justify-self-stretch md:[grid-column:13/17] md:[grid-row:2/4]" },
    ],
  },
  B: {
    // The narrower bottom-left span keeps P3 portrait alongside landscape L3.
    gridClassName: "grid grid-cols-12 aspect-[10/21] gap-2 [grid-template-rows:minmax(0,3fr)_minmax(0,7fr)_minmax(0,6fr)_minmax(0,5fr)] md:aspect-square md:[grid-template-columns:repeat(16,minmax(0,1fr))] md:[grid-template-rows:22fr_24fr_30fr_24fr] md:gap-3",
    slots: [
      { id: "landscape-1", kind: "landscape", className: "[grid-column:7/13] [grid-row:1/2] md:[grid-column:1/14] md:[grid-row:1/3]" },
      { id: "portrait-1", kind: "portrait", className: "[grid-column:1/7] [grid-row:1/3] md:[grid-column:14/17] md:[grid-row:1/2]" },
      { id: "portrait-2", kind: "portrait", className: "[grid-column:7/13] [grid-row:2/3] md:[grid-column:14/17] md:[grid-row:2/3]" },
      { id: "portrait-3", kind: "portrait", className: "[grid-column:1/5] [grid-row:4/5] md:[grid-column:1/5] md:[grid-row:3/4]" },
      { id: "landscape-2", kind: "landscape", className: "[grid-column:1/13] [grid-row:3/4] md:[grid-column:5/17] md:[grid-row:3/4]" },
      { id: "landscape-3", kind: "landscape", className: "[grid-column:5/13] [grid-row:4/5] md:[grid-column:1/17] md:[grid-row:4/5]" },
    ],
  },
  C: {
    gridClassName: "grid grid-cols-2 gap-2 md:aspect-[10/11] md:[grid-template-columns:repeat(16,minmax(0,1fr))] md:[grid-template-rows:22fr_34fr_10fr_34fr] md:gap-3",
    slots: [
      { id: "portrait-1", kind: "portrait", className: "col-start-1 row-start-1 aspect-[3/4] w-full md:aspect-auto md:w-auto md:[grid-column:1/7] md:[grid-row:1/3]" },
      { id: "landscape-1", kind: "landscape", className: "col-span-2 col-start-1 row-start-2 aspect-[16/10] md:aspect-auto md:[grid-column:7/17] md:[grid-row:1/2]" },
      { id: "portrait-2", kind: "portrait", className: "col-start-2 row-start-1 aspect-[3/4] w-full md:aspect-auto md:w-auto md:[grid-column:7/12] md:[grid-row:2/3]" },
      { id: "portrait-3", kind: "portrait", className: "col-start-1 row-start-3 aspect-[3/4] w-full md:aspect-auto md:w-auto md:[grid-column:12/17] md:[grid-row:2/4]" },
      { id: "landscape-2", kind: "landscape", className: "col-span-2 col-start-1 row-start-4 aspect-[16/10] md:aspect-auto md:[grid-column:1/12] md:[grid-row:3/5]" },
      { id: "portrait-4", kind: "portrait", className: "col-start-2 row-start-3 aspect-[3/4] w-full md:aspect-auto md:w-auto md:[grid-column:12/17] md:[grid-row:4/5]" },
    ],
  },
};

// Called only from the mount effect, never during server rendering or resize.
export function createGallerySession(variantRandom: number, photoRandom: number): GallerySession {
  const variants: GalleryVariant[] = ["A", "B", "C"];
  return { variant: variants[Math.min(2, Math.max(0, Math.floor(variantRandom * 3)))], seed: Math.floor(photoRandom * 0xffffffff) };
}

// The existing seeded shuffle: pool order stays stable throughout a page visit.
function seededShuffle<T>(items: T[], initialSeed: number): T[] {
  const shuffled = [...items];
  let seed = initialSeed >>> 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = seed % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function prepareGalleryPools(classified: { photo: GaleriFoto; orientation: GalleryOrientation }[], seed: number): GalleryPools {
  const unique = Array.from(new Map(classified.map((item) => [item.photo.id, item])).values());
  return {
    portraits: seededShuffle(unique.filter((item) => item.orientation === "portrait").map((item) => item.photo), seed ^ 0x9e3779b9).slice(0, 4),
    landscapes: seededShuffle(unique.filter((item) => item.orientation === "landscape").map((item) => item.photo), seed ^ 0x85ebca6b).slice(0, 4),
  };
}

export function fillGallerySlots(variant: GalleryVariant, pools: GalleryPools): GallerySlot[] {
  let portraitIndex = 0;
  let landscapeIndex = 0;
  return GALLERY_LAYOUTS[variant].slots.map((slot) => ({
    ...slot,
    photo: slot.kind === "portrait" ? pools.portraits[portraitIndex++] ?? null : pools.landscapes[landscapeIndex++] ?? null,
  }));
}
