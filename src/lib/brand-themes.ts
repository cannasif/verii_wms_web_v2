export const BRAND_THEME_STORAGE_KEY = 'vite-ui-wms-brand-theme';
export const USE_CUSTOM_BRAND_THEMES_STORAGE_KEY = 'vite-ui-wms-use-custom-brand-themes';

export const BRAND_THEME_CLASS_PREFIX = 'theme-';

export type BrandThemeAppearance = 'light' | 'dark';

export const brandThemeIds = [
  'v3rii',
  'warehouseBlue',
  'industrialSteel',
  'safetyGreen',
  'forkliftAmber',
  'graphite',
  'executive',
  'burgundy',
  'cleanLight',
  'highContrast',
  'flatNavy',
  'flatSlate',
  'flatWhite',
] as const;

export type BrandTheme = (typeof brandThemeIds)[number];

export type BrandThemeDefinition = {
  id: BrandTheme;
  label: string;
  description: string;
  className: string;
  appearance: BrandThemeAppearance;
  swatches: readonly [string, string, string];
};

export const brandThemes: readonly BrandThemeDefinition[] = [
  {
    id: 'v3rii',
    label: 'V3RII WMS',
    description: 'Mevcut cyan/turuncu depo operasyon kimliği',
    className: 'theme-v3rii',
    appearance: 'dark',
    swatches: ['#00b8d4', '#0ea5e9', '#ff8f5c'],
  },
  {
    id: 'warehouseBlue',
    label: 'Depo Mavisi',
    description: 'Yoğun operasyon ekranları için güvenli mavi ton',
    className: 'theme-warehouse-blue',
    appearance: 'light',
    swatches: ['#eff6ff', '#2563eb', '#06b6d4'],
  },
  {
    id: 'industrialSteel',
    label: 'Endüstriyel Çelik',
    description: 'Fabrika, stok ve transfer süreçleri için metalik yapı',
    className: 'theme-industrial-steel',
    appearance: 'dark',
    swatches: ['#0f172a', '#475569', '#38bdf8'],
  },
  {
    id: 'safetyGreen',
    label: 'Güvenli Yeşil',
    description: 'Onay, tamamlama ve saha kontrol süreçleri için sakin tema',
    className: 'theme-safety-green',
    appearance: 'dark',
    swatches: ['#065f46', '#10b981', '#2dd4bf'],
  },
  {
    id: 'forkliftAmber',
    label: 'Forklift Amber',
    description: 'Saha uyarıları ve sevkiyat operasyonları için sıcak aksan',
    className: 'theme-forklift-amber',
    appearance: 'light',
    swatches: ['#fffbeb', '#f59e0b', '#f97316'],
  },
  {
    id: 'graphite',
    label: 'Grafit Operasyon',
    description: 'Az dikkat dağıtan, sade ve kurumsal görünüm',
    className: 'theme-graphite',
    appearance: 'light',
    swatches: ['#f8fafc', '#475569', '#94a3b8'],
  },
  {
    id: 'executive',
    label: 'Premium Koyu',
    description: 'Yönetim, rapor ve dashboard ekranları için güçlü koyu tema',
    className: 'theme-executive',
    appearance: 'dark',
    swatches: ['#111827', '#6d28d9', '#f59e0b'],
  },
  {
    id: 'burgundy',
    label: 'Bordo Kurumsal',
    description: 'ERP ve yönetim ekranları için ağır, kurumsal kırmızı ton',
    className: 'theme-burgundy',
    appearance: 'light',
    swatches: ['#fef2f2', '#b91c1c', '#f97316'],
  },
  {
    id: 'cleanLight',
    label: 'Sade Açık',
    description: 'Gündüz kullanım ve yoğun veri girişi için yumuşak arayüz',
    className: 'theme-clean-light',
    appearance: 'light',
    swatches: ['#f8fafc', '#2563eb', '#14b8a6'],
  },
  {
    id: 'highContrast',
    label: 'Yüksek Kontrast',
    description: 'Belirgin odak, net sınır ve erişilebilir saha kullanımı',
    className: 'theme-high-contrast',
    appearance: 'dark',
    swatches: ['#020617', '#f8fafc', '#facc15'],
  },
  {
    id: 'flatNavy',
    label: 'Düz Lacivert',
    description: 'Gradientsiz, net ve kurumsal lacivert görünüm',
    className: 'theme-flat-navy',
    appearance: 'light',
    swatches: ['#1e3a8a', '#1e3a8a', '#1e3a8a'],
  },
  {
    id: 'flatSlate',
    label: 'Düz Grafit',
    description: 'Gradientsiz, sakin ve operasyon odaklı yönetim paneli',
    className: 'theme-flat-slate',
    appearance: 'light',
    swatches: ['#334155', '#334155', '#334155'],
  },
  {
    id: 'flatWhite',
    label: 'Düz Açık',
    description: 'Gradientsiz, aydınlık ve tablo odaklı çalışma modu',
    className: 'theme-flat-white',
    appearance: 'light',
    swatches: ['#f8fafc', '#2563eb', '#e2e8f0'],
  },
] as const;

const brandThemeIdSet = new Set<string>(brandThemeIds);

/** Picker order: lights (left col) then used when zipping with darks (right col). */
const customBrandThemePickerLightIds: readonly BrandTheme[] = [
  'cleanLight',
  'warehouseBlue',
  'forkliftAmber',
  'graphite',
  'burgundy',
];

const customBrandThemePickerDarkIds: readonly BrandTheme[] = [
  'v3rii',
  'industrialSteel',
  'safetyGreen',
  'executive',
  'highContrast',
];

export function isBrandTheme(value: string | null | undefined): value is BrandTheme {
  return Boolean(value && brandThemeIdSet.has(value));
}

export function getBrandThemeClass(theme: BrandTheme): string {
  return brandThemes.find((item) => item.id === theme)?.className ?? brandThemes[0].className;
}

export function getBrandThemeAppearance(theme: BrandTheme): BrandThemeAppearance {
  return brandThemes.find((item) => item.id === theme)?.appearance ?? 'dark';
}

/** Custom-theme picker: light column left, dark column right (zipped for a 2-col grid). */
export function getCustomBrandThemePickerItems(): BrandThemeDefinition[] {
  const byId = new Map(brandThemes.map((item) => [item.id, item]));
  const lightThemes = customBrandThemePickerLightIds
    .map((id) => byId.get(id))
    .filter((item): item is BrandThemeDefinition => Boolean(item));
  const darkThemes = customBrandThemePickerDarkIds
    .map((id) => byId.get(id))
    .filter((item): item is BrandThemeDefinition => Boolean(item));
  const rowCount = Math.max(lightThemes.length, darkThemes.length);
  const items: BrandThemeDefinition[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const lightTheme = lightThemes[index];
    const darkTheme = darkThemes[index];
    if (lightTheme) items.push(lightTheme);
    if (darkTheme) items.push(darkTheme);
  }

  return items;
}

export function readUseCustomBrandThemes(storageKey = USE_CUSTOM_BRAND_THEMES_STORAGE_KEY): boolean {
  return localStorage.getItem(storageKey) === 'true';
}
