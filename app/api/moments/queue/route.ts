import { listUnviewedMoments, momentViewerId } from '@/lib/moment-viewer-server';
import { momentFailure, momentJson } from '@/lib/moments-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    // A fresh snapshot only when opening. No original URLs or management fields.
    const rows = await listUnviewedMoments(momentViewerId(request));
    return momentJson({ items: rows.map(row => ({ id: row.id, createdAt: row.created_at, capturedAt: row.captured_at ?? null, expiresAt: row.expires_at })), serverNow: new Date().toISOString() });
  } catch (error) { return momentFailure(error); }
}
