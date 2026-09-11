import { isMomentId, MOMENT_MAX_BYTES, MOMENT_MAX_EDGE } from '@/lib/moments';
import { jpegDimensions } from '@/lib/moments-image';
import { momentViewerId, requireUnviewedMoment } from '@/lib/moment-viewer-server';
import { MOMENT_BUCKET, MomentError, momentFailure, momentsStore } from '@/lib/moments-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    const viewerId = momentViewerId(request);
    if (!isMomentId(routeParams.id)) throw new MomentError('Moment tidak tersedia.', 404);
    const id = routeParams.id.toLowerCase();
    await requireUnviewedMoment(id, viewerId);
    const image = await momentsStore.storage.from(MOMENT_BUCKET).download(`moments/${id}/original.jpg`);
    if (image.error || !image.data) throw new MomentError('Foto belum dapat dimuat. Coba lagi.', 503);
    if (image.data.size > MOMENT_MAX_BYTES) throw new MomentError('Foto tidak valid.', 502);
    const bytes = await image.data.arrayBuffer();
    const size = jpegDimensions(new Uint8Array(bytes));
    if (!size || Math.max(size.width, size.height) > MOMENT_MAX_EDGE) throw new MomentError('Foto tidak valid.', 502);
    // A slow download must not bypass deletion, expiry or another tab's view.
    await requireUnviewedMoment(id, viewerId);
    return new Response(bytes, { headers: {
      'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff', 'Vary': 'X-Moment-Viewer-Id',
    } });
  } catch (error) { return momentFailure(error); }
}
