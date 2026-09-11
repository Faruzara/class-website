"use client";
import { useCallback, useEffect, useState } from 'react';
import { readMomentResponse, type MomentListing, type MomentSummary } from '@/lib/moments';
import { flushMomentViews, isMomentViewStorageKey, pendingMomentViews } from '@/lib/moment-viewer-client';

export function useMoments(endpoint: string, enabled = true, viewerId?: string) {
  const [items, setItems] = useState<MomentSummary[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running = false;
    let next: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let serverClock: { time: number; received: number } | null = null;
    async function load() {
      if (running || disposed) return;
      running = true;
      clearTimeout(next);
      // Remove locally expired previews before awaiting a slow/offline refresh.
      // This never grants access: every response is still filtered by DB now().
      if (serverClock) {
        const estimatedNow = serverClock.time + performance.now() - serverClock.received;
        setItems(current => current.filter(item => item.cleanupPending || Date.parse(item.expiresAt) > estimatedNow));
      }
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      let nextDelay = 60000;
      try {
        if (viewerId) await flushMomentViews(viewerId);
        if (disposed) return;
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal, ...(viewerId ? { headers: { 'x-moment-viewer-id': viewerId } } : {}) });
        const result = await readMomentResponse<MomentListing>(response);
        if (disposed) return;
        serverClock = { time: Date.parse(result.serverNow), received: performance.now() };
        const pending = viewerId ? new Set(pendingMomentViews(viewerId)) : new Set<string>();
        setItems(result.items.filter(item => !pending.has(item.id))); setError('');
        // Wake at the earliest expiry (or once/minute). The server remains the
        // authority; client timers only request a fresh database-filtered list.
        const remaining = result.items.filter(item => !item.cleanupPending).map(item => Date.parse(item.expiresAt) - Date.parse(result.serverNow));
        if (remaining.length) nextDelay = Math.max(500, Math.min(60000, ...remaining));
      } catch (err) {
        if (!disposed) { setItems([]); setError(err instanceof Error ? err.message : 'Moments gagal dimuat.'); }
      } finally {
        clearTimeout(timeout); running = false;
        if (!disposed) { setLoading(false); next = setTimeout(load, nextDelay); }
      }
    }
    function visible() { if (!document.hidden) void load(); }
    function storage(event: StorageEvent) { if (viewerId && isMomentViewStorageKey(event.key)) void load(); }
    setLoading(true);
    void load();
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    if (viewerId) window.addEventListener('storage', storage);
    return () => { disposed = true; controller?.abort(); clearTimeout(next); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); window.removeEventListener('storage', storage); };
  }, [endpoint, enabled, revision, viewerId]);
  return { items, loading, error, refresh };
}
