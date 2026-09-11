const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta', hourCycle: 'h23',
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit',
});

// Consistent WIB output across browser/server timezones, never render-time Date.now().
export function formatMomentTimestamp(timestamp?: string | null): string {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return '--:-- / --.--.--';
  const parts = formatter.formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '--';
  return `${part('hour')}:${part('minute')} / ${part('day')}.${part('month')}.${part('year')}`;
}

// Display metadata only; expiry remains controlled by the existing DB clock.
export function parseMomentCaptureTime(value: unknown, receivedAt: number): string | null {
  if (value === null) return null; // Older clients have no exact shutter timestamp.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value || Math.abs(time - receivedAt) > 5 * 60 * 1000) return null;
  return value;
}
