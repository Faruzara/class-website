export type ScheduleWeek = 1 | 2;

function getJakartaCalendarDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function getAutomaticScheduleWeek(now = new Date()): ScheduleWeek {
  const jakarta = getJakartaCalendarDate(now);
  const currentDate = Date.UTC(jakarta.year, jakarta.month - 1, jakarta.day);
  const yearStart = Date.UTC(jakarta.year, 0, 1);
  const dayOfYear = Math.floor((currentDate - yearStart) / 86400000);
  const startDay = new Date(yearStart).getUTCDay();
  const weekNumber = Math.ceil((dayOfYear + startDay + 1) / 7);
  return weekNumber % 2 === 1 ? 1 : 2;
}

export function getActiveScheduleWeek(offset: number | null | undefined, now = new Date()): ScheduleWeek {
  const automaticWeek = getAutomaticScheduleWeek(now);
  return offset === 1 ? (automaticWeek === 1 ? 2 : 1) : automaticWeek;
}

export function offsetForScheduleWeek(week: ScheduleWeek, now = new Date()): 0 | 1 {
  return week === getAutomaticScheduleWeek(now) ? 0 : 1;
}
