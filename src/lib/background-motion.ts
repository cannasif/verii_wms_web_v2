export const WMS_BACKGROUND_MOTION_VARIANTS = [
  'rack-scanner',
  'conveyor-flow',
  'forklift-route',
  'pick-to-light',
  'agv-shuttle',
  'barcode-scan',
] as const;

export type WmsBackgroundMotionVariant = (typeof WMS_BACKGROUND_MOTION_VARIANTS)[number];

export const DEFAULT_WMS_BACKGROUND_MOTION: WmsBackgroundMotionVariant = 'rack-scanner';

/** Older saved values remapped to current variants. */
const BACKGROUND_MOTION_LEGACY_ALIASES: Record<string, WmsBackgroundMotionVariant> = {
  'dock-inbound': 'agv-shuttle',
};

export const wmsBackgroundMotionOptions: ReadonlyArray<{
  id: WmsBackgroundMotionVariant;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    id: 'rack-scanner',
    labelKey: 'profile.backgroundMotionRackScanner',
    descriptionKey: 'profile.backgroundMotionRackScannerHint',
  },
  {
    id: 'conveyor-flow',
    labelKey: 'profile.backgroundMotionConveyor',
    descriptionKey: 'profile.backgroundMotionConveyorHint',
  },
  {
    id: 'forklift-route',
    labelKey: 'profile.backgroundMotionForklift',
    descriptionKey: 'profile.backgroundMotionForkliftHint',
  },
  {
    id: 'pick-to-light',
    labelKey: 'profile.backgroundMotionPickToLight',
    descriptionKey: 'profile.backgroundMotionPickToLightHint',
  },
  {
    id: 'agv-shuttle',
    labelKey: 'profile.backgroundMotionAgvShuttle',
    descriptionKey: 'profile.backgroundMotionAgvShuttleHint',
  },
  {
    id: 'barcode-scan',
    labelKey: 'profile.backgroundMotionBarcodeScan',
    descriptionKey: 'profile.backgroundMotionBarcodeScanHint',
  },
];

export function isWmsBackgroundMotionVariant(value: string | null | undefined): value is WmsBackgroundMotionVariant {
  return Boolean(value && (WMS_BACKGROUND_MOTION_VARIANTS as readonly string[]).includes(value));
}

export function normalizeBackgroundMotionVariant(value: unknown): WmsBackgroundMotionVariant | null {
  if (typeof value !== 'string') return null;
  if (isWmsBackgroundMotionVariant(value)) return value;
  return BACKGROUND_MOTION_LEGACY_ALIASES[value] ?? null;
}
