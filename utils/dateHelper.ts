/**
 * Date utilities for Playwright car rental tests.
 */

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Returns a date string like "Mon, 15 Jul 2025" that matches
 * typical Booking.com date input display formats.
 */
export function formatBookingDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns time string like "11:00".
 */
export function formatBookingTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Tomorrow's date at 11:00 */
export function tomorrowAt11(): Date {
  const d = addDays(new Date(), 1);
  d.setHours(11, 0, 0, 0);
  return d;
}
