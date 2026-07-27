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
      matchTriggerWidth={variant !== 'pill'}
      contentAlign={variant === 'pill' ? 'end' : 'start'}
      renderValue={() => variant === 'pill' ? (
        <span className="flex items-center justify-center"><Languages className="size-5" /></span>
      ) : (
        <span className="flex items-center gap-2"><Languages className="size-4 shrink-0" /><span>{currentLanguage.flag}</span><span className="hidden sm:inline">{currentName}</span></span>
      )}
      className={cn(
        'h-10 w-[140px] bg-[var(--wms-app-panel)] shadow-lg',
        variant === 'pill' && 'h-10 w-10 shrink-0 justify-center rounded-full border border-sky-400/20 bg-[#0b1228]/80 p-0 text-cyan-300/80 shadow-[0_0_14px_rgba(56,132,246,0.20)] transition-all duration-300 hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-300 hover:shadow-[0_0_20px_rgba(56,132,246,0.40)]',
      )}
      contentClassName={variant === 'pill' ? 'border-sky-400/20 !bg-[#0b1733] !text-white shadow-[0_0_24px_rgba(56,132,246,0.18)]' : undefined}
    />
  );
}
