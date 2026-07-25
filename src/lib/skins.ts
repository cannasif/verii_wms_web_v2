export const WMS_SKIN_STORAGE_KEY = 'vite-ui-wms-skin';

export const wmsSkinIds = ['terminal', 'premium'] as const;

export type WmsSkin = (typeof wmsSkinIds)[number];

export const DEFAULT_WMS_SKIN: WmsSkin = 'terminal';

/** Terminal skin has no class: default look stays untouched. */
export const WMS_SKIN_CLASS_MAP: Record<WmsSkin, string | null> = {
  terminal: null,
  premium: 'skin-premium',
};

const skinIdSet = new Set<string>(wmsSkinIds);

export function isWmsSkin(value: string | null | undefined): value is WmsSkin {
  return Boolean(value && skinIdSet.has(value));
}

export function readStoredWmsSkin(storageKey = WMS_SKIN_STORAGE_KEY): WmsSkin {
  const stored = localStorage.getItem(storageKey);
  return isWmsSkin(stored) ? stored : DEFAULT_WMS_SKIN;
}
