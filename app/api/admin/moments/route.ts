import { isMomentId } from '@/lib/moments';
import { readMomentForm } from '@/lib/moments-form';
import { parseMomentCaptureTime } from '@/lib/moment-time';
import { validateMomentImages } from '@/lib/moments-image';
import { publishMoment } from '@/lib/moments-publish';
import { checkMomentOrigin, listMoments, MomentError, momentFailure, momentJson, momentSummary, requireMomentEditor } from '@/lib/moments-server';
import { logActivity } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireMomentEditor();
    const rows = await listMoments(false, 24);
    return momentJson({ items: rows.map(momentSummary), serverNow: new Date().toISOString() });
  } catch (error) { return momentFailure(error); }
}

export async function POST(request: Request) {
  const receivedAt = Date.now();
  try {
    checkMomentOrigin(request);
    const session = await requireMomentEditor();
    const form = await readMomentForm(request);
    const id = form.get('id');
    if (!isMomentId(id)) throw new MomentError('ID Moment tidak valid.', 400);
    const captureValue = form.get('captured_at');
    const capturedAt = parseMomentCaptureTime(captureValue, receivedAt);
    if (captureValue !== null && !capturedAt) throw new MomentError('Waktu foto tidak valid. Pastikan jam perangkat otomatis dan coba lagi.', 400);
    const images = await validateMomentImages(form.get('image'), form.get('preview')).catch((error: Error) => { throw new MomentError(error.message, 400); });
    // Recheck revocation/Temp expiry after reading the body, before any writes.
    const current = await requireMomentEditor();
    if (current.role !== session.role || current.slot_id !== session.slot_id || current.temp_key_id !== session.temp_key_id) throw new MomentError('Session berubah. Buka ulang kamera.', 401);
    const published = await publishMoment(id.toLowerCase(), images, current, capturedAt);
    await logActivity({ actor_role: current.role, actor_label: current.label, action: 'moment_published', detail: published.id });
    return momentJson(published);
  } catch (error) { return momentFailure(error); }
}
