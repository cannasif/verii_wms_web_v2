export function canEnableUnknownPlateResolve(
  serverCanResolve: boolean,
  busy: boolean,
): boolean {
  return serverCanResolve && !busy;
}
