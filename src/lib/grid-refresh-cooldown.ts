export const GRID_REFRESH_COOLDOWN_MS = 30_000;

export function remainingRefreshCooldownSeconds(
  availableAt: number | null,
  nowMs: number,
): number {
  if (availableAt == null) return 0;
  return Math.max(0, Math.ceil((availableAt - nowMs) / 1000));
}

export function isRefreshOnCooldown(availableAt: number | null, nowMs: number): boolean {
  return remainingRefreshCooldownSeconds(availableAt, nowMs) > 0;
}

export function nextRefreshAvailableAt(nowMs: number): number {
  return nowMs + GRID_REFRESH_COOLDOWN_MS;
}
