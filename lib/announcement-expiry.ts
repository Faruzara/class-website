export const PIN_DURATION_OPTIONS = [
  { hours: 24, label: "1 hari" },
  { hours: 72, label: "3 hari" },
  { hours: 168, label: "7 hari" },
  { hours: 336, label: "14 hari" },
  { hours: 720, label: "30 hari" },
] as const;

export const DEFAULT_PIN_DURATION_HOURS = 168;

export function normalizePinDuration(value: unknown): number {
  const hours = Number(value);
  return PIN_DURATION_OPTIONS.some((option) => option.hours === hours) ? hours : DEFAULT_PIN_DURATION_HOURS;
}

export function createPinnedUntil(isPinned: boolean, duration: unknown, now = Date.now()): string | null {
  return isPinned ? new Date(now + normalizePinDuration(duration) * 60 * 60 * 1000).toISOString() : null;
}

export function remainingPinDuration(pinnedUntil?: string | null, now = Date.now()): number {
  if (!pinnedUntil) return DEFAULT_PIN_DURATION_HOURS;
  const remainingHours = Math.max(1, Math.ceil((new Date(pinnedUntil).getTime() - now) / (60 * 60 * 1000)));
  return PIN_DURATION_OPTIONS.reduce((nearest, option) => Math.abs(option.hours - remainingHours) < Math.abs(nearest - remainingHours) ? option.hours : nearest, DEFAULT_PIN_DURATION_HOURS);
}

export function isAnnouncementVisible(item: { is_pinned: boolean; pinned_until?: string | null; created_at: string }, now = Date.now()): boolean {
  if (item.is_pinned) return item.pinned_until ? new Date(item.pinned_until).getTime() > now : true;
  return new Date(item.created_at).getTime() + 24 * 60 * 60 * 1000 > now;
}
