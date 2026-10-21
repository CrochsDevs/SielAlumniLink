export function tracerQuarterStatus(response, now = new Date()) {
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const quarter = Math.floor(local.getUTCMonth() / 3) + 1;
  const start = Date.UTC(year, (quarter - 1) * 3, 1) - 8 * 60 * 60 * 1000;
  const end = Date.UTC(year, quarter * 3, 1) - 8 * 60 * 60 * 1000;
  const saved = new Date(response?.updatedAt || response?.respondedAt || 0).getTime();
  return {
    quarter: `${year} Q${quarter}`,
    updateRequired: !(saved >= start && saved < end && saved <= now.getTime()),
    nextUpdateAt: new Date(end).toISOString(),
  };
}
