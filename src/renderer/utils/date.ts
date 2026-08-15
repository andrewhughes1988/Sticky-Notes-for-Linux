export function formatFriendlyDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    const monthStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${monthStr} at ${timeStr}`;
  }
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}
