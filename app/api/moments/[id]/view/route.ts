import { isMomentId } from '@/lib/moments';
import { momentViewerId } from '@/lib/moment-viewer-server';
import { checkMomentOrigin, MomentError, momentFailure, momentJson, momentsStore } from '@/lib/moments-server';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    checkMomentOrigin(request);
    const viewerId = momentViewerId(request);
    if (!isMomentId(id)) throw new MomentError('Moment tidak tersedia.', 404);
    const { data, error } = await momentsStore.rpc('mark_moment_viewed', { p_moment_id: id.toLowerCase(), p_viewer_id: viewerId });
    if (error) throw error;
    // Gone/expired is terminal too: no point retaining an acknowledgement retry.
    return momentJson({ recorded: Boolean(data) });
  } catch (error) { return momentFailure(error); }
}
