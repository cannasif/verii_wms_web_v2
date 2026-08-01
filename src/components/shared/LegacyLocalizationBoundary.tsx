import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '@/lib/i18n';
import { localizeLegacyUiText } from '@/lib/legacy-ui-localization';

type FlatResource = Map<string, string>;

const SOURCE_LANGUAGES = ['tr', 'en'] as const;
const SKIPPED_ELEMENTS = new Set(['INPUT', 'TEXTAREA', 'OPTION', 'SCRIPT', 'STYLE', 'CODE', 'PRE']);

function flattenResource(
  value: unknown,
  prefix = '',
  output: FlatResource = new Map(),
  seen: Set<object> = new Set(),
): FlatResource {
  if (typeof value === 'string') {
    if (prefix) output.set(prefix, value);
    return output;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return output;
  if (seen.has(value)) return output;
  seen.add(value);

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flattenResource(child, prefix ? `${prefix}.${key}` : key, output, seen);
  }

  return output;
}

function shouldSkip(textNode: Text): boolean {
  const parent = textNode.parentElement;
  return !parent
    || SKIPPED_ELEMENTS.has(parent.tagName)
    || parent.isContentEditable
    || Boolean(parent.closest('[data-no-auto-localize="true"]'));
}

/**
 * Drop reverse edges of 2-cycles (A→B and B→A). Incomplete FR/AR/ES/IT bundles
 * often fall back to EN for TR sources while leftover TR values remain for EN
 * sources, which previously made the MutationObserver flip text forever.
 */
function breakTranslationCycles(translated: Map<string, string>): void {
  for (const [source, target] of [...translated.entries()]) {
    if (!translated.has(source)) continue;
    if (translated.get(target) === source) {
      translated.delete(target);
    }
  }
}

function buildStaticTextMap(
  i18n: ReturnType<typeof useTranslation>['i18n'],
  language: string,
): Map<string, string> {
  const translated = new Map<string, string>();
  const namespaces = new Set<string>();

  for (const sourceLanguage of SOURCE_LANGUAGES) {
    const resources = (i18n.store.data[sourceLanguage] ?? {}) as Record<string, unknown>;
    Object.keys(resources).forEach((namespace) => namespaces.add(namespace));
  }

  for (const namespace of namespaces) {
    const targetTranslator = i18n.getFixedT(language, namespace);

    for (const sourceLanguage of SOURCE_LANGUAGES) {
      const sourceBundle = i18n.getResourceBundle(sourceLanguage, namespace) as unknown;
      if (!sourceBundle) continue;

      for (const [key, sourceText] of flattenResource(sourceBundle)) {
        const normalizedSource = sourceText.trim();
        if (normalizedSource.length < 2 || translated.has(normalizedSource)) continue;

        const targetText = targetTranslator(key, { defaultValue: '' }).trim();
        if (targetText && targetText !== key && targetText !== normalizedSource) {
          translated.set(normalizedSource, targetText);
        }
      }
    }
  }

  breakTranslationCycles(translated);
  return translated;
}

function resolveLocalizedText(
  trimmed: string,
  translations: Map<string, string>,
  language: string,
): string | null {
  const fromMap = translations.get(trimmed);
  if (fromMap && fromMap !== trimmed) return fromMap;

  const fromLegacy = localizeLegacyUiText(trimmed, language);
  if (fromLegacy && fromLegacy !== trimmed) return fromLegacy;

  return null;
}

function localizeTextNode(
  textNode: Text,
  translations: Map<string, string>,
  language: string,
  appliedTexts: WeakMap<Text, string>,
): void {
  if (shouldSkip(textNode)) return;

  const current = textNode.data;
  const trimmed = current.trim();
  if (!trimmed) return;

  // Stop observer ping-pong: we already wrote this exact localized value.
  if (appliedTexts.get(textNode) === trimmed) return;

  const next = resolveLocalizedText(trimmed, translations, language);
  if (!next || next === trimmed) return;

  // Refuse reverse edge application if the map somehow still contains a 2-cycle.
  if (translations.get(next) === trimmed) return;

  const start = current.indexOf(trimmed);
  const updated = `${current.slice(0, start)}${next}${current.slice(start + trimmed.length)}`;
  appliedTexts.set(textNode, next);
  textNode.data = updated;
}

function walkTextNodes(
  root: Node,
  translations: Map<string, string>,
  language: string,
  appliedTexts: WeakMap<Text, string>,
): void {
  if (root.nodeType === Node.TEXT_NODE) {
    localizeTextNode(root as Text, translations, language, appliedTexts);
    return;
  }

  if (!(root instanceof Element) || root.matches('[data-no-auto-localize="true"]')) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    localizeTextNode(current as Text, translations, language, appliedTexts);
    current = walker.nextNode();
  }
}

/**
 * Temporary migration boundary for legacy pages that still render static
 * Turkish/English labels directly. It uses the same module resources as i18next
 * and deliberately ignores inputs and operation data marked as non-localizable.
 */
export function LegacyLocalizationBoundary({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    // Turkish is the source language for legacy labels — nothing to rewrite.
    if (language === 'tr') return undefined;

    const appliedTexts = new WeakMap<Text, string>();
    let translations = buildStaticTextMap(i18n, language);
    let applying = false;

    const runWalk = (node: Node) => {
      applying = true;
      try {
        walkTextNodes(node, translations, language, appliedTexts);
      } finally {
        applying = false;
      }
    };

    runWalk(root);

    const rebuild = () => {
      translations = buildStaticTextMap(i18n, language);
      runWalk(root);
    };

    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      applying = true;
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') {
            localizeTextNode(mutation.target as Text, translations, language, appliedTexts);
            continue;
          }
          mutation.addedNodes.forEach((node) => {
            walkTextNodes(node, translations, language, appliedTexts);
          });
        }
      } finally {
        applying = false;
      }
    });

    observer.observe(root, { childList: true, characterData: true, subtree: true });
    i18n.store.on('added', rebuild);

    return () => {
      observer.disconnect();
      i18n.store.off('added', rebuild);
    };
  }, [i18n, language]);

  return (
    <div ref={rootRef} className="contents" data-legacy-localization-boundary>
      {children}
    </div>
  );
}
