export type GalleryOrientation = "portrait" | "landscape";
export type GalleryFocus = { object_position_x: number; object_position_y: number };
type FocusInput = { object_position_x?: unknown; object_position_y?: unknown };
type Size = { width: number; height: number };

export const DEFAULT_GALLERY_FOCUS: GalleryFocus = { object_position_x: 50, object_position_y: 50 };

export function getGalleryOrientation(width: number, height: number): GalleryOrientation {
  return height > width ? "portrait" : "landscape";
}

export function parseGalleryFocus(input: FocusInput): GalleryFocus | null {
  const x = input.object_position_x === undefined ? 50 : input.object_position_x;
  const y = input.object_position_y === undefined ? 50 : input.object_position_y;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)
    || x < 0 || x > 100 || y < 0 || y > 100) return null;
  return { object_position_x: Math.round(x * 100) / 100, object_position_y: Math.round(y * 100) / 100 };
}

export function getGalleryObjectPosition(input: FocusInput): string {
  const focus = parseGalleryFocus(input) ?? DEFAULT_GALLERY_FOCUS;
  return `${focus.object_position_x}% ${focus.object_position_y}%`;
}

// CSS object-position offsets the cover image by (frame - rendered size) * percentage.
// Only an overflowing axis can move; resizing/changing preview never changes the saved focus.
export function dragGalleryFocus(focus: GalleryFocus, image: Size, frame: Size, delta: { x: number; y: number }): GalleryFocus {
  if (image.width <= 0 || image.height <= 0 || frame.width <= 0 || frame.height <= 0) return focus;
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const overflowX = Math.max(0, image.width * scale - frame.width);
  const overflowY = Math.max(0, image.height * scale - frame.height);
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return {
    object_position_x: overflowX > 0.5 ? clamp(focus.object_position_x - delta.x / overflowX * 100) : focus.object_position_x,
    object_position_y: overflowY > 0.5 ? clamp(focus.object_position_y - delta.y / overflowY * 100) : focus.object_position_y,
  };
}
