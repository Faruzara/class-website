import type { MomentSummary } from '@/lib/moments';

// These are also the animation's start/end poses: never a separate slide track.
export const MOMENT_DECK_POSES = [
  { transform: 'translate3d(0, 0, 0) rotateZ(0deg) scale(1)', zIndex: 30 },
  { transform: 'translate3d(-9%, -3%, -20px) rotateZ(-7deg) scale(0.97)', zIndex: 20 },
  { transform: 'translate3d(10%, -6%, -40px) rotateZ(9deg) scale(0.94)', zIndex: 10 },
] as const;

export function getMomentDeck(queue: readonly MomentSummary[], index: number, departingIndex: number | undefined, now: number) {
  const previous = departingIndex !== undefined && departingIndex < index ? queue[departingIndex] : undefined;
  const candidates = previous ? [previous, ...queue.slice(index)] : queue.slice(index);
  return candidates.filter(item => Date.parse(item.expiresAt) > now).slice(0, MOMENT_DECK_POSES.length);
}
