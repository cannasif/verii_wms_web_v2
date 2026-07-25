import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureNamespaces, normalizeLanguage } from '@/lib/i18n';

export function useModuleTranslation(namespace: string) {
  const translation = useTranslation(namespace);
  const language = normalizeLanguage(translation.i18n.resolvedLanguage ?? translation.i18n.language);
  const [moduleReady, setModuleReady] = useState(() =>
    translation.i18n.hasResourceBundle(language, namespace),
  );

  useEffect(() => {
    let active = true;
    setModuleReady(translation.i18n.hasResourceBundle(language, namespace));
    void ensureNamespaces([namespace], language).then(() => {
      if (active) setModuleReady(true);
    });
    return () => { active = false; };
  }, [language, namespace, translation.i18n]);

  return { ...translation, moduleReady };
}
