import { isMomentId, readMomentResponse } from './moments';

export const MOMENT_VIEWER_STORAGE_KEY = 'xi-tp2:moment-viewer';
const OUTBOX_PREFIX = 'xi-tp2:moment-view-outbox:';
const pendingRequests = new Map<string, Promise<void>>();

export function getMomentViewerId() {
  const stored = window.localStorage.getItem(MOMENT_VIEWER_STORAGE_KEY);
  if (isMomentId(stored)) return stored.toLowerCase();
  let id: string;
  if (typeof window.crypto.randomUUID === 'function') id = window.crypto.randomUUID();
  else {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Do not silently create a different identity on every refresh if storage is blocked.
  window.localStorage.setItem(MOMENT_VIEWER_STORAGE_KEY, id);
  return id;
}

export function pendingMomentViews(viewerId: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(OUTBOX_PREFIX + viewerId) ?? '[]');
    return Array.isArray(value) ? value.filter(isMomentId) : [];
  } catch { return []; }
}

function storePending(viewerId: string, ids: string[]) {
  window.localStorage.setItem(OUTBOX_PREFIX + viewerId, JSON.stringify(Array.from(new Set(ids))));
}

// Called only after successful decode + display, never by queue/original requests.
// Durable outbox + keepalive protects close/refresh while the acknowledgement is in flight.
export function acknowledgeMomentView(viewerId: string, momentId: string) {
  try { storePending(viewerId, [...pendingMomentViews(viewerId), momentId]); } catch { /* Still attempt the server acknowledgement if browser quota changes. */ }
  const key = `${viewerId}:${momentId}`;
  const running = pendingRequests.get(key);
  if (running) return running;
  const operation = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/moments/${momentId}/view`, {
        method: 'POST', headers: { 'x-moment-viewer-id': viewerId },
        cache: 'no-store', keepalive: true, signal: controller.signal,
      });
      await readMomentResponse<{ recorded: boolean }>(response);
      storePending(viewerId, pendingMomentViews(viewerId).filter(id => id !== momentId));
    } catch { /* Retain for the next focus, reopen or browser refresh. */ }
    finally { clearTimeout(timeout); pendingRequests.delete(key); }
  })();
  pendingRequests.set(key, operation);
  return operation;
}

export async function flushMomentViews(viewerId: string) {
  await Promise.all(pendingMomentViews(viewerId).map(id => acknowledgeMomentView(viewerId, id)));
}

export function isMomentViewStorageKey(key: string | null) {
  return key === null || key === MOMENT_VIEWER_STORAGE_KEY || key.startsWith(OUTBOX_PREFIX);
}
