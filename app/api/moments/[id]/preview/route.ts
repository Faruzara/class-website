import { isMomentId, MOMENT_PREVIEW_EDGE, MOMENT_PREVIEW_MAX_BYTES } from '@/lib/moments';
import { jpegDimensions } from '@/lib/moments-image';
import { MOMENT_BUCKET, MomentError, momentFailure, momentsStore } from '@/lib/moments-server';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isMomentId(id)) throw new MomentError('Moment tidak tersedia.', 404);
    const active = await momentsStore.rpc('list_moments', { p_manage: false }).eq('id', id.toLowerCase()).maybeSingle();
    if (active.error) throw active.error;
    if (!active.data) throw new MomentError('Moment tidak tersedia.', 404);
    // Deterministic PREVIEW-only path: no user URL/path or original fallback.
    const image = await momentsStore.storage.from(MOMENT_BUCKET).download(`moments/${id.toLowerCase()}/preview.jpg`);
    if (image.error || !image.data) throw new MomentError('Preview tidak tersedia.', 404);
    if (image.data.size > MOMENT_PREVIEW_MAX_BYTES) throw new MomentError('Preview tidak valid.');
    const bytes = await image.data.arrayBuffer();
    const size = jpegDimensions(new Uint8Array(bytes));
    if (!size || Math.max(size.width, size.height) > MOMENT_PREVIEW_EDGE) throw new MomentError('Preview tidak valid.');
    // Recheck after download so slow storage cannot serve an expired/deleted item.
    const stillActive = await momentsStore.rpc('list_moments', { p_manage: false }).eq('id', id.toLowerCase()).maybeSingle();
    if (stillActive.error) throw stillActive.error;
    if (!stillActive.data) throw new MomentError('Moment tidak tersedia.', 404);
    return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return momentFailure(error); }
}
