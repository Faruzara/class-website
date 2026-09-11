import 'server-only';
import { isMomentId } from './moments';
import { MomentError, momentsStore, type MomentRow } from './moments-server';

export function momentViewerId(request: Request) {
  const id = request.headers.get('x-moment-viewer-id');
  if (!isMomentId(id)) throw new MomentError('Identitas browser Moments tidak valid.', 400);
  return id.toLowerCase();
}

export async function listUnviewedMoments(viewerId: string, limit: number | null = null) {
  const { data, error } = await momentsStore.rpc('list_unviewed_moments', { p_viewer_id: viewerId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as MomentRow[];
}

export async function requireUnviewedMoment(id: string, viewerId: string) {
  const { data, error } = await momentsStore.rpc('list_unviewed_moments', { p_viewer_id: viewerId, p_limit: null }).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new MomentError('Moment sudah dilihat atau tidak tersedia.', 404);
  return data as MomentRow;
}
