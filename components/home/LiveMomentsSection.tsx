"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import MomentsSection from './MomentsSection';
import { useMoments } from './useMoments';
import { flushMomentViews, getMomentViewerId, pendingMomentViews } from '@/lib/moment-viewer-client';
import { readMomentResponse, type MomentListing } from '@/lib/moments';

const MomentViewer = dynamic(() => import('@/components/moments/MomentViewer'), { ssr: false });

export default function LiveMomentsSection() {
  const [viewerId, setViewerId] = useState('');
  const [queue, setQueue] = useState<MomentListing | null>(null);
  const [error, setError] = useState('');
  const opening = useRef(false);
  const mounted = useRef(false);
  const { items, refresh } = useMoments('/api/moments', Boolean(viewerId) && !queue, viewerId || undefined);
  useEffect(() => {
    mounted.current = true;
    try { setViewerId(getMomentViewerId()); }
    catch { setError('Penyimpanan browser diperlukan untuk membuka Moments sekali-lihat.'); }
    return () => { mounted.current = false; };
  }, []);
  const close = useCallback(() => { setQueue(null); refresh(); }, [refresh]);
  async function open() {
    if (!viewerId || opening.current || queue) return;
    opening.current = true; setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      await flushMomentViews(viewerId);
      const response = await fetch('/api/moments/queue', { cache: 'no-store', headers: { 'x-moment-viewer-id': viewerId }, signal: controller.signal });
      const result = await readMomentResponse<MomentListing>(response);
      if (!mounted.current) return;
      const pending = new Set(pendingMomentViews(viewerId));
      const remaining = result.items.filter(item => !pending.has(item.id));
      if (remaining.length) setQueue({ ...result, items: remaining });
      else refresh();
    } catch { if (mounted.current) setError('Moments belum dapat dibuka. Silakan coba lagi.'); }
    finally { clearTimeout(timeout); opening.current = false; }
  }
  return <>
    <MomentsSection items={items} onOpen={open} />
    {error && <p role="status" className="mx-auto -mt-10 mb-8 max-w-7xl px-5 text-center text-xs text-neutral-500 lg:px-8">{error}</p>}
    {queue && <MomentViewer viewerId={viewerId} snapshot={queue} onClose={close} />}
  </>;
}
