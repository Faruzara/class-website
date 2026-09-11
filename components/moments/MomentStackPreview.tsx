import type { MomentSummary } from '@/lib/moments';
import MomentCardFrame from './MomentCardFrame';

export default function MomentStackPreview({ item }: { item: MomentSummary }) {
  return (
    <MomentCardFrame timestamp={item.capturedAt ?? item.createdAt} decorative>
      {/* Same lightweight obscured preview treatment as the homepage. Never
          request an original or acknowledge a view for a card in the back. */}
      <img
        src={item.previewSrc ?? `/api/moments/${item.id}/preview`}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full scale-[1.04] select-none object-cover object-center opacity-80 blur-[4px]"
        onError={event => { event.currentTarget.style.visibility = 'hidden'; }}
      />
      <span className="absolute inset-0 bg-surface-base/25" />
    </MomentCardFrame>
  );
}
