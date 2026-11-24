export function formatFriendlyDate(
  timestamp: number,
  nowDate: Date = new Date(),
  locale?: string
): string {
  const date = new Date(timestamp);
  const localDay = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const dayDifference = Math.round((localDay(date) - localDay(nowDate)) / 86_400_000);
  if (dayDifference === 0 || dayDifference === -1) {
    const day = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      dayDifference,
      'day'
    );
    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
      date
    );
    return `${day}, ${time}`;
  }
  return new Intl.DateTimeFormat(locale, {
    ...(date.getFullYear() !== nowDate.getFullYear() ? { year: 'numeric' } : {}),
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
