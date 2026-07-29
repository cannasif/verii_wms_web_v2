export function isDefinitiveSessionRefreshStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}
