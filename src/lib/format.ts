/** Compact number formatting, Douyin style: 1234 -> `1234`, 12345 -> `1.2万`. */
export function formatCount(value: number): string {
  if (value < 10_000) return String(value);
  if (value < 100_000_000) {
    const wan = value / 10_000;
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')}万`;
  }
  const yi = value / 100_000_000;
  return `${yi.toFixed(1).replace(/\.0$/, '')}亿`;
}

/** `8` -> `00:08`, used on the feed progress bar and profile grid. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
