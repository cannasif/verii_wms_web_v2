export const WORKSPACE_PORTAL_ROOT_ID = 'wms-workspace-portal-root';
export const SHELL_PORTAL_ROOT_ID = 'wms-shell-portal-root';

export function getWorkspacePortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(WORKSPACE_PORTAL_ROOT_ID);
}

export function getShellPortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(SHELL_PORTAL_ROOT_ID);
}
