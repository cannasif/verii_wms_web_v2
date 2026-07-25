import { type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { cn } from '@/lib/utils';
import { normalizeLanguage, setAppLanguage } from '@/lib/i18n';

const languages = [
  { code: 'tr', flag: '🇹🇷' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'de', flag: '🇩🇪' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'ar', flag: '🇸🇦' },
  { code: 'es', flag: '🇪🇸' },
  { code: 'it', flag: '🇮🇹' },
] as const;

interface LanguageSwitcherProps {
  variant?: 'default' | 'pill';
}

export function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps): ReactElement {
  const { i18n, t } = useTranslation('common');
  const normalizedLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const currentLanguage = languages.find((language) => language.code === normalizedLanguage) ?? languages[0];
  const currentName = t(`languageNames.${normalizedLanguage}` as never);
  const options: AppDropdownOption[] = languages.map((language) => ({
    value: language.code,
    label: `${language.flag} ${t(`languageNames.${language.code}` as never)}`,
  }));

  return (
    <AppDropdown
      value={normalizedLanguage}
      onValueChange={(value) => void setAppLanguage(value)}
      options={options}
      ariaLabel={currentName}
      hideChevron={variant === 'pill'}
      renderValue={() => variant === 'pill' ? (
        <span className="flex items-center justify-center"><Languages className="size-5" /></span>
      ) : (
        <span className="flex items-center gap-2"><Languages className="size-4 shrink-0" /><span>{currentLanguage.flag}</span><span className="hidden sm:inline">{currentName}</span></span>
      )}
      className={cn(
        'h-10 w-[140px] bg-[var(--wms-app-panel)] shadow-lg',
        variant === 'pill' && 'h-11 w-11 justify-center rounded-full border-[var(--wms-brand-ring)] p-0 text-[var(--wms-brand-primary)] shadow-[0_0_14px_var(--wms-brand-shadow)]',
      )}
      contentClassName={variant === 'pill' ? 'border-[var(--wms-brand-ring)] shadow-[0_0_24px_var(--wms-brand-shadow)]' : undefined}
    />
  );
}
