import type { ReactNode } from 'react';
import { formatMomentTimestamp } from '@/lib/moment-time';

type Props = {
  children: ReactNode;
  timestamp?: string | null;
  layer?: number;
  className?: string;
  photoBackground?: string;
  decorative?: boolean;
};

// One frame for both the homepage photograph and dashboard's live camera.
// Geometry/printed details are shared; camera behavior and photo privacy aren't.
export default function MomentCardFrame({ children, timestamp, layer = 0, className = '', photoBackground = 'bg-surface-muted', decorative }: Props) {
  const validTimestamp = timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined;
  return (
    <span data-moment-layer={layer} aria-hidden={decorative ? 'true' : undefined} className={`moments-card pointer-events-none absolute inset-0 block ${className}`}>
      <span className="moments-card-shadow" />
      <span className={`moments-card-photo absolute block overflow-hidden ${photoBackground}`}>{children}</span>
      <span className="moments-card-print" aria-hidden="true">
        <span className="moments-card-top-plus">+</span>
        <span className="moments-card-top-dot" />
        <span className="moments-card-side-dots"><i /><i /><i /></span>
        <span className="moments-card-side-plus">+</span>
        <span className="moments-card-mark"><span><span /></span></span>
        <span className="moments-card-label">MOMEN KELAS XI TP2</span>
        <span className="moments-card-rule" />
        <time className="moments-card-timestamp" dateTime={validTimestamp}>{formatMomentTimestamp(timestamp)}</time>
        <span className="moments-card-bottom-dots"><i /><i /><i /></span>
      </span>
    </span>
  );
}
