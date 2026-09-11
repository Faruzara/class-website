export type MomentPreview = {
  id: string;
  // Supply an already obscured, low-resolution thumbnail, never the private original.
  previewSrc?: string;
  capturedAt?: string | null;
  createdAt?: string;
};

export function getMomentPreviewLayers(items: readonly MomentPreview[]): MomentPreview[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 3);
}
