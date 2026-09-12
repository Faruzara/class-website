"use client";
import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import MomentCameraDialog from './MomentCameraDialog';
import { useMoments } from '@/components/home/useMoments';
import { readMomentResponse } from '@/lib/moments';
import { formatMomentTimestamp } from '@/lib/moment-time';

export default function MomentDashboardActions({ canManage = false, showActive = false }: { canManage?: boolean; showActive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const deleteRef = useRef(false);
  const displayActive = showActive || (canManage && manage);
  const { items, loading, error, refresh } = useMoments('/api/admin/moments', displayActive);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function remove(id: string) {
    if (!canManage || deleteRef.current || !window.confirm('Hapus Moment ini beserta fotonya?')) return;
    deleteRef.current = true; setDeleting(id); setDeleteError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`/api/owner/moments/${id}`, { method: 'DELETE', signal: controller.signal });
      await readMomentResponse<{ id: string }>(response);
      setNotice('Moment dihapus');
    } catch (err) { setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus Moment. Coba lagi.'); }
    finally { clearTimeout(timeout); deleteRef.current = false; setDeleting(null); refresh(); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="btn-secondary flex items-center gap-2 text-sm"><Camera size={16} />Ambil Moment</button>
    {canManage && <button type="button" onClick={() => setManage(value => !value)} aria-expanded={manage} className="btn-secondary text-sm">Moments Aktif</button>}
    {notice && <p role="status" className="self-center text-xs text-gray-500">{notice}</p>}
    {open && <MomentCameraDialog onClose={() => setOpen(false)} onPublished={() => { setNotice('Moment terkirim'); refresh(); }} />}
    {displayActive && <div className="basis-full min-w-0 rounded-xl border border-surface-border bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-gray-700">Moments Aktif</h3>
      {(error || deleteError) && <p role="alert" className="mb-3 text-xs leading-relaxed text-brand-600">{deleteError || error}</p>}
      {loading ? <p className="text-xs text-gray-500">Memuat Moments…</p> : !error && items.length === 0 ? <p className="text-xs text-gray-500">Belum ada Moment aktif.</p> : null}
      <div className="divide-y divide-surface-border">
        {items.map(item => <div key={item.id} className="flex min-w-0 items-center gap-3 py-3">
          {item.previewSrc && <img src={item.previewSrc} alt="Preview samar Moment" width={36} height={48} className="h-12 w-9 shrink-0 rounded object-cover" />}
          <div className="min-w-0 flex-1 text-xs leading-relaxed text-gray-500">
            <p>{item.cleanupPending ? 'Sisa upload / penghapusan — perlu dibersihkan' : 'Aktif selama 24 jam'}</p>
            <p>{item.capturedAt ? 'Dipotret' : 'Dipublikasikan'}: {formatMomentTimestamp(item.capturedAt ?? item.createdAt)} WIB</p>
            {!item.cleanupPending && <p>Berakhir: {new Date(item.expiresAt).toLocaleString('id-ID')}</p>}
          </div>
          {canManage && <button type="button" onClick={() => void remove(item.id)} disabled={!!deleting} aria-label={item.cleanupPending ? 'Bersihkan sisa Moment' : 'Hapus Moment'} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-400 hover:text-brand-600 disabled:opacity-40">
            {deleting === item.id ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Trash2 size={16} />}
          </button>}
        </div>)}
      </div>
    </div>}
  </>;
}
