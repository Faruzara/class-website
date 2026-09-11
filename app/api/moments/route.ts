import { momentFailure, momentJson, momentSummary } from '@/lib/moments-server';
import { listUnviewedMoments, momentViewerId } from '@/lib/moment-viewer-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const rows = await listUnviewedMoments(momentViewerId(request), 3);
    return momentJson({ items: rows.map(momentSummary), serverNow: new Date().toISOString() });
  } catch (error) { return momentFailure(error); }
}
