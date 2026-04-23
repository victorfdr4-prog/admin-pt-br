/**
 * Returns today's date as "YYYY-MM-DD" in the user's LOCAL timezone.
 * Never use new Date().toISOString() for this — that returns UTC.
 */
export function getTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Safely parse a "YYYY-MM-DD" string into a local-timezone Date at noon.
 * Using new Date("2026-04-20") parses as UTC midnight → shifts day in GMT-3.
 * Adding 'T12:00:00' pins to local noon, which is always the same calendar day.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Format a "YYYY-MM-DD" string for display in pt-BR (e.g. "segunda-feira, 20 de abril").
 */
export function formatPostDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return parseLocalDate(dateStr).toLocaleDateString('pt-BR', options ?? {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}
