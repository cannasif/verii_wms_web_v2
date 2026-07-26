export const WMS_BACKGROUND_MOTION_VARIANTS = [
  'rack-scanner',
  'conveyor-flow',
  'forklift-route',
] as const;

export type WmsBackgroundMotionVariant = (typeof WMS_BACKGROUND_MOTION_VARIANTS)[number];

export const DEFAULT_WMS_BACKGROUND_MOTION: WmsBackgroundMotionVariant = 'rack-scanner';

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
];

export function isWmsBackgroundMotionVariant(value: unknown): value is WmsBackgroundMotionVariant {
  return typeof value === 'string'
    && WMS_BACKGROUND_MOTION_VARIANTS.includes(value as WmsBackgroundMotionVariant);
}
