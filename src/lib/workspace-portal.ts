export const WORKSPACE_PORTAL_ROOT_ID = 'wms-workspace-portal-root';

export function getWorkspacePortalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(WORKSPACE_PORTAL_ROOT_ID);
}
