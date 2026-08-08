import { describe, expect, it } from 'vitest';
import ar from './localization/ar.json';
import de from './localization/de.json';
import en from './localization/en.json';
import es from './localization/es.json';
import fr from './localization/fr.json';
import itLocale from './localization/it.json';
import tr from './localization/tr.json';

const resources = { ar, de, en, es, fr, it: itLocale, tr } as const;

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, item]) => keys(item, prefix ? `${prefix}.${key}` : key));
}

describe('warehouse assistant localization', () => {
  const sourceKeys = keys(tr).sort();

  it.each(Object.entries(resources))('%s has complete non-empty localized guidance', (_language, resource) => {
    expect(keys(resource).sort()).toEqual(sourceKeys);
    const serialized = JSON.stringify(resource);
    expect(serialized).not.toContain('""');
  });
});
