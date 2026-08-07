import { describe, expect, it } from "vitest";
import ar from "./localization/ar.json";
import de from "./localization/de.json";
import en from "./localization/en.json";
import es from "./localization/es.json";
import fr from "./localization/fr.json";
import itLocale from "./localization/it.json";
import tr from "./localization/tr.json";

const resources = { ar, de, en, es, fr, it: itLocale, tr } as const;

function flatten(value: unknown, path = ""): Map<string, string> {
  const result = new Map<string, string>();

  if (typeof value === "string") {
    result.set(path, value);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flatten(item, `${path}[${index}]`).forEach((text, key) =>
        result.set(key, text),
      );
    });
    return result;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      flatten(item, path ? `${path}.${key}` : key).forEach((text, childKey) =>
        result.set(childKey, text),
      );
    });
  }

  return result;
}

describe("settings guidance localization", () => {
  const source = flatten(tr);

  it.each(Object.entries(resources))(
    "%s kaynağı Türkçe kaynakla aynı kapsamı taşır",
    (_language, resource) => {
      const localized = flatten(resource);

      expect([...localized.keys()].sort()).toEqual([...source.keys()].sort());
      expect([...localized.values()].every((value) => value.trim().length > 0)).toBe(
        true,
      );
    },
  );

  it.each(Object.entries(resources))(
    "%s kaynağı interpolasyon alanlarını korur",
    (_language, resource) => {
      const localized = flatten(resource);

      source.forEach((sourceText, key) => {
        const expectedTokens = sourceText.match(/\{\{\w+\}\}/g) ?? [];
        const localizedText = localized.get(key) ?? "";

        expectedTokens.forEach((token) => expect(localizedText).toContain(token));
      });
    },
  );
});
