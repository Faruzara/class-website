import 'server-only';
import type { AdminSession } from '@/types';
import { validateMomentImages } from './moments-image';
import { MomentError, MOMENT_BUCKET, momentCreator, momentsStore, removeMomentFiles, type MomentRow } from './moments-server';

export async function publishMoment(id: string, files: Awaited<ReturnType<typeof validateMomentImages>>, session: AdminSession, capturedAt: string | null = null) {
  const paths = { image_path: `moments/${id}/original.jpg`, preview_path: `moments/${id}/preview.jpg` };
  const creator = momentCreator(session);
  // Reserving the UUID in PostgreSQL prevents parallel/duplicate requests uploading
  // or publishing twice. No upsert; a repeat cannot replace another photograph.
  const { error: reserveError } = await momentsStore.from('moments').insert({
    id, ...paths, width: files.width, height: files.height, orientation: files.orientation, captured_at: capturedAt,
    created_by_role: session.role, created_by_label: session.label, created_by_ref: creator,
  });
  if (reserveError) {
    if (reserveError.code !== '23505') throw reserveError;
    const { data, error } = await momentsStore.from('moments').select('status,created_by_ref').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data?.status === 'published' && data.created_by_ref === creator) return { id };
    throw new MomentError('Moment ini sedang diproses atau tidak dapat dikirim ulang.', 409);
  }

  try {
    const bucket = momentsStore.storage.from(MOMENT_BUCKET);
    const original = await bucket.upload(paths.image_path, files.imageBytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
    if (original.error) throw original.error;
    const preview = await bucket.upload(paths.preview_path, files.previewBytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
    if (preview.error) throw preview.error;
    const published = await momentsStore.from('moments').update({ status: 'published' }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
    if (published.error) throw published.error;
    if (!published.data) throw new MomentError('Moment tidak dapat diterbitkan. Coba lagi.');
    return { id };
  } catch (error) {
    // Resolve an ambiguous publish response before removing anything. A committed
    // publish whose HTTP response was lost must never lose its image to cleanup.
    const current = await momentsStore.from('moments').select('*').eq('id', id).maybeSingle();
    if (!current.error && current.data?.status === 'published') return { id };
    if (!current.error && current.data?.status === 'pending') {
      const failed = await momentsStore.from('moments').update({ status: 'failed' }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
      if (!failed.error && failed.data) {
        try { await removeMomentFiles(paths); } catch { /* Owner gets a retryable cleanup record. */ }
      }
    }
    // Retain failed/interrupted records even if cleanup succeeded: an upstream
    // timed-out upload may finish late. Owner can explicitly retry both removals.
    throw error;
  }
}

export async function deleteMoment(id: string) {
  const found = await momentsStore.from('moments').select('*').eq('id', id).maybeSingle();
  if (found.error) throw found.error;
  if (!found.data) return { id }; // Idempotent retry after a lost success response.
  const row = found.data as MomentRow;
  // Don't race a still-running upload. Database time decides stale pending rows.
  if (row.status === 'pending') {
    const stale = await momentsStore.rpc('list_moments', { p_manage: true }).eq('id', id).maybeSingle();
    if (stale.error) throw stale.error;
    if (!stale.data) throw new MomentError('Moment masih diunggah. Tunggu sebentar sebelum menghapus.', 409);
  }
  const hidden = await momentsStore.from('moments').update({ status: 'deleting' }).eq('id', id);
  if (hidden.error) throw hidden.error;
  try { await removeMomentFiles(row); }
  catch { throw new MomentError('Moment sudah disembunyikan, tetapi file belum selesai dihapus. Coba hapus lagi.'); }
  const removed = await momentsStore.from('moments').delete().eq('id', id).eq('status', 'deleting');
  if (removed.error) throw new MomentError('File sudah dihapus, tetapi data belum dibersihkan. Coba hapus lagi.');
  return { id };
}
