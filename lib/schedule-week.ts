export type ScheduleWeek = 1 | 2;

export function getAutomaticScheduleWeek(now = new Date()): ScheduleWeek {
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
  return weekNumber % 2 === 1 ? 1 : 2;
}

export function getActiveScheduleWeek(offset: number | null | undefined, now = new Date()): ScheduleWeek {
  const automaticWeek = getAutomaticScheduleWeek(now);
  return offset === 1 ? (automaticWeek === 1 ? 2 : 1) : automaticWeek;
}

export function offsetForScheduleWeek(week: ScheduleWeek, now = new Date()): 0 | 1 {
  return week === getAutomaticScheduleWeek(now) ? 0 : 1;
}
