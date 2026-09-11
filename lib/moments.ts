// Safe shared types/constants. No credentials or original paths in browser DTOs.
export const MOMENT_MAX_EDGE = 1920;
export const MOMENT_MAX_BYTES = 4 * 1024 * 1024;
export const MOMENT_PREVIEW_SHORT_EDGE = 144;
export const MOMENT_PREVIEW_EDGE = 384;
export const MOMENT_PREVIEW_MAX_BYTES = 96 * 1024;
export function momentPreviewSize(width: number, height: number) {
  const scale = Math.min(MOMENT_PREVIEW_SHORT_EDGE / Math.min(width, height), MOMENT_PREVIEW_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export type MomentOrientation = 'portrait' | 'landscape' | 'square';
export type MomentSummary = {
  id: string;
  previewSrc?: string;
  createdAt: string;
  capturedAt?: string | null;
  expiresAt: string;
  cleanupPending?: boolean;
};
export type MomentListing = { items: MomentSummary[]; serverNow: string };
export type OwnerMomentSummary = MomentSummary & {
  status: 'published' | 'pending' | 'failed' | 'deleting';
  creatorRole: 'owner' | 'admin' | 'temp_admin';
  creatorLabel: string;
};
export type OwnerMomentListing = { items: OwnerMomentSummary[]; serverNow: string };
export const isMomentId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function momentOrientation(width: number, height: number): MomentOrientation {
  return width > height ? 'landscape' : height > width ? 'portrait' : 'square';
}

export async function readMomentResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: { success?: boolean; data?: T; error?: string };
  try { body = JSON.parse(text); } catch { throw new Error('Server tidak memberi respons yang valid. Coba lagi.'); }
  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error || 'Permintaan Moment gagal. Coba lagi.');
  }
  return body.data;
}
