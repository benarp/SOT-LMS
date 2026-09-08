/**
 * Week due dates.
 *
 * `weeks.due_date` is a timestamptz that stands for a calendar day, not a
 * moment. It is also not stored consistently: weeks 1-24 of 2026-2027 sit at
 * 00:00Z and weeks 25-32 at 23:00Z, because they were written by different
 * tools. Both land on the correct day in UTC, so UTC is the reference frame
 * for reading one — never the viewer's local time, which pulls a 00:00Z date
 * back to the previous day for anyone west of Greenwich and made every due
 * date in the app read a day early in California.
 *
 * Lateness is a different question from display: work is late once the school
 * day is over where the school is, not once a UTC instant has passed.
 */

/** Where the school is. Lateness is judged against this clock. */
export const SCHOOL_TIME_ZONE = 'America/Los_Angeles'

const YMD = 'en-CA' // formats as YYYY-MM-DD

/** The calendar day a week is due, as YYYY-MM-DD. */
export function dueDay(due: string | Date): string {
  return new Intl.DateTimeFormat(YMD, { timeZone: 'UTC' }).format(new Date(due))
}

/** Today where the school is, as YYYY-MM-DD. */
export function schoolToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat(YMD, { timeZone: SCHOOL_TIME_ZONE }).format(now)
}

/**
 * True once the due day has fully passed in the school's timezone, so work
 * turned in during the class it's due at doesn't count as late.
 */
export function isPastDue(due: string | Date, now: Date = new Date()): boolean {
  return schoolToday(now) > dueDay(due)
}

/** Formats a due date in UTC, so it reads as the day it stands for. */
export function formatDueDate(
  due: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' },
): string {
  return new Date(due).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}
