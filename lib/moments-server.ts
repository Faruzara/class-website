import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getEditorSession, getOwnerSession } from '@/lib/auth';
import type { AdminSession } from '@/types';
import type { MomentSummary, OwnerMomentSummary } from './moments';

// Same server/service-role pattern as lib/supabase, scoped timeout for Moments
// only: it must not change timing/behavior of existing auth, editors, or uploads.
export const momentsStore = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: async (input, init) => {
    const controller = new AbortController();
    const relay = () => controller.abort();
    init?.signal?.addEventListener('abort', relay, { once: true });
    if (init?.signal?.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal, cache: 'no-store' });
      // Keep the deadline alive through body download, not just response headers.
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
    finally { clearTimeout(timeout); init?.signal?.removeEventListener('abort', relay); }
  } },
});
export const MOMENT_BUCKET = 'moments';
export type MomentRow = {
  id: string; image_path: string; preview_path: string;
  status: 'pending' | 'published' | 'failed' | 'deleting';
  created_at: string; captured_at?: string | null; expires_at: string; created_by_ref: string;
  created_by_role: 'owner' | 'admin' | 'temp_admin'; created_by_label: string;
};
export class MomentError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
export function momentFailure(error: unknown) {
  console.error('[moments]', error instanceof Error ? error.message : error);
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const migration = ['42P01', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code);
  const missingCaptureTime = migration && error && typeof error === 'object' && 'message' in error && String(error.message).includes('captured_at');
  const missingViews = migration && error && typeof error === 'object' && 'message' in error && /moment_views|list_unviewed_moments|mark_moment_viewed/.test(String(error.message));
  return NextResponse.json({ success: false, error: missingCaptureTime ? 'Jalankan supabase-migration-moments-captured-at.sql untuk menyimpan waktu foto.' : missingViews ? 'Jalankan supabase-migration-moments-views.sql untuk mengaktifkan viewer Moments.' : migration ? 'Moments belum siap. Jalankan supabase-migration-moments.sql terlebih dahulu.' : error instanceof MomentError ? error.message : 'Layanan Moments belum tersedia. Coba lagi.' }, { status: migration ? 503 : error instanceof MomentError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
export function momentJson<T>(data: T) {
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}
async function authDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new MomentError('Pemeriksaan session terlalu lama. Coba lagi.', 503)), 15000);
    })]);
  } finally { clearTimeout(timer!); }
}
export async function requireMomentEditor() {
  const session = (await authDeadline(getOwnerSession())) ?? (await authDeadline(getEditorSession('moments')));
  if (!session || !['owner', 'admin', 'temp_admin'].includes(session.role)) throw new MomentError('Session tidak valid atau sudah berakhir.', 401);
  return session;
}
export async function requireMomentOwner() {
  const session = await authDeadline(getOwnerSession());
  if (!session || session.role !== 'owner') throw new MomentError('Hanya Owner yang dapat mengelola penghapusan Moment.', 403);
  return session;
}
export function checkMomentOrigin(request: Request) {
  // Custom cookie auth: same-origin writes, including multipart requests.
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new MomentError('Request lintas situs ditolak.', 403);
}
export function momentCreator(session: AdminSession) {
  return session.role === 'owner' ? 'owner' : `${session.role}:${session.slot_id ?? session.temp_key_id}`;
}
export function momentSummary(row: MomentRow): MomentSummary {
  return { id: row.id, createdAt: row.created_at, capturedAt: row.captured_at ?? null, expiresAt: row.expires_at,
    ...(row.status === 'published' ? { previewSrc: `/api/moments/${row.id}/preview` } : { cleanupPending: true }) };
}
export function ownerMomentSummary(row: MomentRow): OwnerMomentSummary {
  return {
    ...momentSummary(row),
    status: row.status,
    creatorRole: row.created_by_role,
    creatorLabel: row.created_by_label,
  };
}
export async function listMoments(manage = false) {
  // Database now(), never browser time. Service-role-only RPC, no original URL DTO.
  let query = momentsStore.rpc('list_moments', { p_manage: manage });
  if (!manage) query = query.limit(3);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MomentRow[];
}
export async function removeMomentFiles(row: Pick<MomentRow, 'image_path' | 'preview_path'>) {
  const { error } = await momentsStore.storage.from(MOMENT_BUCKET).remove([row.image_path, row.preview_path]);
  if (error) throw error;
}
