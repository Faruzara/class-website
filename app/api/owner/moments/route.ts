import { listMoments, momentFailure, momentJson, ownerMomentSummary, requireMomentOwner } from '@/lib/moments-server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireMomentOwner();
    const rows = await listMoments(true);
    return momentJson({ items: rows.map(ownerMomentSummary), serverNow: new Date().toISOString() });
  } catch (error) { return momentFailure(error); }
}
