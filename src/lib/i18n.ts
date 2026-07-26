import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { applyDocumentTextDirection } from './text-direction';

const i18n = i18next.createInstance();

type ResourceModule = { default: Record<string, unknown> };

const sharedModules = import.meta.glob('../locales/**/*.json');
const sharedComponentModules = import.meta.glob('../components/shared/localization/*.json');
const featureModules = import.meta.glob('../features/**/localization/*.json');

type LoaderMap = Record<string, Record<string, () => Promise<ResourceModule>>>;
const loaders: LoaderMap = {};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function deepMergeResource(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };

  for (const key of Object.keys(overlay)) {
    const over = overlay[key];
    const prev = out[key];
    if (isPlainObject(over) && isPlainObject(prev)) {
      out[key] = deepMergeResource(prev, over);
    } else {
      out[key] = over;
    }
  }

  return out;
}

for (const [path, loader] of Object.entries(sharedModules)) {
  const match = path.match(/\.\.\/locales\/([a-z-]+)\/(.+)\.json$/);
  if (!match) continue;

  const lang = match[1];
  const ns = match[2];
  if (!loaders[lang]) loaders[lang] = {};
  loaders[lang][ns] = loader as () => Promise<ResourceModule>;
}

for (const [path, loader] of Object.entries(sharedComponentModules)) {
  const match = path.match(/\.\.\/components\/shared\/localization\/([a-z-]+)\.json$/);
  if (!match) continue;

  const lang = match[1];
  if (!loaders[lang]) loaders[lang] = {};
  loaders[lang].shared = loader as () => Promise<ResourceModule>;
}

for (const [path, loader] of Object.entries(featureModules)) {
  const match = path.match(/\.\.\/features\/([^/]+)\/localization\/([a-z-]+)\.json$/);
  if (!match) continue;

  const ns = match[1];
  const lang = match[2];
  if (!loaders[lang]) loaders[lang] = {};

  const featureLoader = loader as () => Promise<ResourceModule>;
  const existing = loaders[lang][ns];
  if (existing) {
    const sharedLoader = existing;
    loaders[lang][ns] = async () => {
      const [sharedMod, featureMod] = await Promise.all([sharedLoader(), featureLoader()]);
      return {
        default: deepMergeResource(
          sharedMod.default as Record<string, unknown>,
          featureMod.default as Record<string, unknown>,
        ),
      };
    };
  } else {
    loaders[lang][ns] = featureLoader;
  }
}

const DEFAULT_LANGUAGE = 'tr';
const FALLBACK_LANGUAGE = 'en';
const DEFAULT_NAMESPACE = 'translation';
const COMMON_NAMESPACE = 'common';
const SHARED_NAMESPACE = 'shared';
const STORAGE_KEY_LEGACY = 'i18nextLng';
const STORAGE_KEY_WMS = 'wms-app-language';
const fallbackLng = FALLBACK_LANGUAGE;
const supportedLngs = ['tr', 'en', 'de', 'fr', 'ar', 'es', 'it'] as const;
const supportedLanguageSet = new Set<string>(supportedLngs);
const PRELOADED_NAMESPACES = [DEFAULT_NAMESPACE, COMMON_NAMESPACE, SHARED_NAMESPACE] as const;
const loadedBundlesByLanguage: Record<string, Record<string, Record<string, unknown>>> = {};

type SupportedLanguage = (typeof supportedLngs)[number];

const LOCALE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  tr: 'tr-TR',
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
  ar: 'ar',
  es: 'es-ES',
  it: 'it-IT',
};

const toCamelCase = (value: string): string =>
  value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

function resolveMissingKey(key: string, defaultValue?: string): string {
  if (typeof defaultValue === 'string' && defaultValue.length > 0) {
    return defaultValue;
  }
  return key;
}

function withNamespaceCompatibility(
  ns: string,
  bundle: Record<string, unknown>,
): Record<string, unknown> {
  const camelNs = toCamelCase(ns);
  const nsScopedBundle =
    typeof bundle[ns] === 'object' && bundle[ns] !== null
      ? (bundle[ns] as Record<string, unknown>)
      : bundle;
  const camelScopedBundle =
    typeof bundle[camelNs] === 'object' && bundle[camelNs] !== null
      ? (bundle[camelNs] as Record<string, unknown>)
      : nsScopedBundle;

  return {
    ...nsScopedBundle,
    ...bundle,
    [ns]: nsScopedBundle,
    [camelNs]: camelScopedBundle,
  };
}

export function normalizeLanguage(language: string | null | undefined): SupportedLanguage {
  if (!language) {
    return DEFAULT_LANGUAGE;
  }

  const lower = language.toLowerCase();
  const mapped = lower === 'sa' ? 'ar' : lower;
  if (supportedLanguageSet.has(mapped)) {
    return mapped as SupportedLanguage;
  }

  const base = mapped.split('-')[0];
  if (supportedLanguageSet.has(base)) {
    return base as SupportedLanguage;
  }

  return DEFAULT_LANGUAGE;
}

export const SUPPORTED_LANGUAGES = [...supportedLngs];

export function getLocaleForFormatting(language: string | null | undefined): string {
  return LOCALE_BY_LANGUAGE[normalizeLanguage(language)];
}

export function getLanguageForHttpHeader(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  }
  return normalizeLanguage(readPersistedLanguage() ?? i18n.resolvedLanguage ?? i18n.language);
}

function syncDocumentLanguage(language: SupportedLanguage): void {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = language;
  applyDocumentTextDirection(language);
}

function persistLanguage(language: SupportedLanguage): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_WMS, language);
  window.localStorage.setItem(STORAGE_KEY_LEGACY, language);
  syncDocumentLanguage(language);
}

function readPersistedLanguage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY_WMS) ?? window.localStorage.getItem(STORAGE_KEY_LEGACY);
}

function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const persisted = readPersistedLanguage();
  const normalizedPersisted = normalizeLanguage(persisted);

  if (persisted && normalizedPersisted !== persisted) {
    persistLanguage(normalizedPersisted);
  }

  if (persisted) {
    return normalizedPersisted;
  }

  return DEFAULT_LANGUAGE;
}

const initialLng = getInitialLanguage();
syncDocumentLanguage(initialLng);
persistLanguage(initialLng);
const resolvedInitialLng = supportedLanguageSet.has(initialLng) ? initialLng : DEFAULT_LANGUAGE;

function rebuildLanguageResources(lang: string): void {
  const bundlesForLanguage = loadedBundlesByLanguage[lang] ?? {};
  const scopedBundleByNs: Record<string, Record<string, unknown>> = {};

  for (const [ns, bundle] of Object.entries(bundlesForLanguage)) {
    const scoped =
      typeof bundle[ns] === 'object' && bundle[ns] !== null
        ? (bundle[ns] as Record<string, unknown>)
        : bundle;
    scopedBundleByNs[ns] = scoped;
  }

  for (const [ns, bundle] of Object.entries(bundlesForLanguage)) {
    const compatibilityBundle = withNamespaceCompatibility(ns, bundle);

    for (const [otherNs, scopedBundle] of Object.entries(scopedBundleByNs)) {
      if (otherNs === ns) continue;
      compatibilityBundle[otherNs] = scopedBundle;
      compatibilityBundle[toCamelCase(otherNs)] = scopedBundle;
    }

    i18n.addResourceBundle(lang, ns, compatibilityBundle, true, true);
  }
}

async function loadNamespace(lang: string, ns: string): Promise<void> {
  const target = normalizeLanguage(lang);
  const langLoaders = loaders[target] || {};
  const loader = langLoaders[ns];
  if (!loader) {
    return;
  }

  if (!loadedBundlesByLanguage[target]) {
    loadedBundlesByLanguage[target] = {};
  }

  if (loadedBundlesByLanguage[target][ns]) {
    return;
  }

  const mod = await loader();
  loadedBundlesByLanguage[target][ns] = mod.default;
  rebuildLanguageResources(target);
}

export async function ensureNamespaces(
  namespaces: readonly string[] | string[],
  language?: string,
): Promise<void> {
  const target = normalizeLanguage(language ?? i18n.resolvedLanguage ?? i18n.language ?? fallbackLng);
  const uniqueNamespaces = [...new Set(namespaces.map((ns) => ns.trim()).filter(Boolean))];

  for (const ns of uniqueNamespaces) {
    await loadNamespace(target, ns);
  }

  if (target !== fallbackLng) {
    for (const ns of uniqueNamespaces) {
      await loadNamespace(fallbackLng, ns);
    }
  }
}

export async function loadLanguage(language: string): Promise<void> {
  await ensureNamespaces(PRELOADED_NAMESPACES, language);
}

const initPromise = (async () => {
  const fileNamespaces = Object.keys(loaders[fallbackLng] || {});
  const defaultNS = fileNamespaces.includes(COMMON_NAMESPACE) ? COMMON_NAMESPACE : (fileNamespaces[0] ?? DEFAULT_NAMESPACE);
  const ns = fileNamespaces.length > 0 ? fileNamespaces : [COMMON_NAMESPACE, DEFAULT_NAMESPACE];

  await i18n.use(initReactI18next).init({
    resources: {},
    lng: resolvedInitialLng,
    fallbackLng,
    supportedLngs,
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    ns,
    defaultNS,
    fallbackNS: [COMMON_NAMESPACE, DEFAULT_NAMESPACE],
    initImmediate: false,
    interpolation: { escapeValue: false },
    parseMissingKeyHandler: (key, defaultValue) => {
      if (import.meta.env.DEV && (defaultValue === undefined || defaultValue === '')) {
        console.warn(`[i18n] missing key: ${key} (lng=${i18n.language}, ns=${defaultNS})`);
      }
      return resolveMissingKey(key, defaultValue as string | undefined);
    },
    returnEmptyString: false,
    detection: {
      order: [],
      caches: [],
    },
  });

  await ensureNamespaces(PRELOADED_NAMESPACES, fallbackLng);
  if (resolvedInitialLng !== fallbackLng) {
    await ensureNamespaces(PRELOADED_NAMESPACES, resolvedInitialLng);
  }

  if (i18n.language !== resolvedInitialLng || i18n.resolvedLanguage !== resolvedInitialLng) {
    await i18n.changeLanguage(resolvedInitialLng);
  }
})();

i18n.on('languageChanged', async (language) => {
  persistLanguage(normalizeLanguage(language));

  await ensureNamespaces(PRELOADED_NAMESPACES, language);
});

export async function ensureI18nReady(): Promise<void> {
  await initPromise;
}

export async function setAppLanguage(language: string): Promise<void> {
  const normalizedLanguage = normalizeLanguage(language);

  persistLanguage(normalizedLanguage);

  await loadLanguage(normalizedLanguage);

  if (i18n.language !== normalizedLanguage || i18n.resolvedLanguage !== normalizedLanguage) {
    await i18n.changeLanguage(normalizedLanguage);
  }

  persistLanguage(normalizedLanguage);
}

export { COMMON_NAMESPACE, DEFAULT_NAMESPACE, PRELOADED_NAMESPACES, SHARED_NAMESPACE };
export default i18n;
