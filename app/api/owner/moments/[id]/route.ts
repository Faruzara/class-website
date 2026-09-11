import { isMomentId } from '@/lib/moments';
import { deleteMoment } from '@/lib/moments-publish';
import { checkMomentOrigin, MomentError, momentFailure, momentJson, requireMomentOwner } from '@/lib/moments-server';
import { logActivity } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    checkMomentOrigin(request);
    const owner = await requireMomentOwner();
    if (!isMomentId(id)) throw new MomentError('ID Moment tidak valid.', 400);
    const removed = await deleteMoment(id.toLowerCase());
    await logActivity({ actor_role: 'owner', actor_label: owner.label, action: 'moment_deleted', detail: removed.id });
    return momentJson(removed);
  } catch (error) { return momentFailure(error); }
}
