import { type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MonitorCog, Palette, ScanLine, ShieldCheck, Sparkles, TerminalSquare, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import Building03Icon from '@hugeicons/core-free-icons/Building03Icon';
import LanguageCircleIcon from '@hugeicons/core-free-icons/LanguageCircleIcon';
import Logout02Icon from '@hugeicons/core-free-icons/Logout02Icon';
import Mail02Icon from '@hugeicons/core-free-icons/Mail02Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Sun02Icon from '@hugeicons/core-free-icons/Sun02Icon';
import UserCircleIcon from '@hugeicons/core-free-icons/UserCircleIcon';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { AppDropdown, type AppDropdownOption } from '@/components/shared/AppDropdown';
import { OpsCircuitToggle } from '@/components/shared/OpsCircuitToggle';
import { OpsLightSwitch } from '@/components/shared/OpsLightSwitch';
import { useTheme } from '@/components/theme-provider';
import { brandThemes } from '@/lib/brand-themes';
import { useAuthStore } from '@/stores/auth-store';
import { useUserDetail } from '../hooks/useUserDetail';
import { getFullProfileImageUrl } from '../utils/profile-image';
import { cn } from '@/lib/utils';
import { normalizeLanguage, setAppLanguage } from '@/lib/i18n';
import { localizeLegacyUiText } from '@/lib/legacy-ui-localization';
import { WarehouseMotionScene } from '@/components/shared/WarehouseAmbientBackground';
import { useMotionEnvironment } from '@/hooks/use-motion-environment';
import {
  wmsBackgroundMotionOptions,
  type WmsBackgroundMotionVariant,
} from '@/lib/background-motion';
import { userDetailApi } from '../api/user-detail-api';
import { USER_DETAIL_QUERY_KEYS } from '../utils/query-keys';
import type { UpdateUserAppearanceDto, UserDetailDto } from '../types/user-detail';

type SupportedLanguage = {
  code: string;
  name: string;
  flagEmoji: string;
  flagLabel: string;
};

const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  { code: 'tr', name: 'Türkçe', flagEmoji: '🇹🇷', flagLabel: 'TR' },
  { code: 'en', name: 'English', flagEmoji: '🇬🇧', flagLabel: 'EN' },
  { code: 'de', name: 'Deutsch', flagEmoji: '🇩🇪', flagLabel: 'DE' },
  { code: 'fr', name: 'Français', flagEmoji: '🇫🇷', flagLabel: 'FR' },
  { code: 'ar', name: 'العربية', flagEmoji: '🇸🇦', flagLabel: 'AR' },
  { code: 'es', name: 'Español', flagEmoji: '🇪🇸', flagLabel: 'ES' },
  { code: 'it', name: 'Italiano', flagEmoji: '🇮🇹', flagLabel: 'IT' },
];

const settingsRowBaseClass = cn(
  'wms-ops-profile-modal__row',
  'flex min-h-[4.5rem] w-full items-center justify-between gap-3 border px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4',
  'border-slate-200/70 bg-white/90 dark:border-white/[0.06] dark:bg-white/[0.03]',
);

const settingsProfileRowClass = cn(
  settingsRowBaseClass,
  'wms-ops-profile-modal__row--link group cursor-pointer text-left transition-[border-color,box-shadow,transform] duration-300',
  'hover:border-[var(--wms-brand-ring)] hover:bg-[var(--wms-brand-soft)] hover:shadow-[0_0_20px_var(--wms-brand-shadow)]',
);

const settingsIconClass =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm sm:h-12 sm:w-12';

const settingsHugeiconSize = 22;
const settingsHugeiconStroke = 1.75;

export interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenProfileDetails: () => void;
}

export function UserProfileModal({
  open,
  onOpenChange,
  onOpenProfileDetails,
}: UserProfileModalProps): ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    resolvedTheme,
    brandTheme,
    useCustomBrandThemes,
    skin,
    backgroundMotionEnabled,
    backgroundMotionVariant,
    setTheme,
    setBrandTheme,
    setUseCustomBrandThemes,
    setSkin,
    setBackgroundMotionPreferences,
  } = useTheme();
  const { user, logout } = useAuthStore();
  const { data: userDetail } = useUserDetail();
  const queryClient = useQueryClient();
  const { prefersReducedMotion } = useMotionEnvironment();
  const appearanceMutation = useMutation({
    mutationFn: async (request: UpdateUserAppearanceDto): Promise<UserDetailDto> => {
      const response = await userDetailApi.updateAppearance(request);
      if (!response.success || !response.data) {
        throw new Error(response.message || t('profile.backgroundMotionSaveError'));
      }
      return response.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        [USER_DETAIL_QUERY_KEYS.CURRENT, updated.userId],
        updated,
      );
    },
  });

  const displayName = user?.name || user?.email || t('dashboard.user');
  const displayInitial = displayName.charAt(0).toUpperCase();
  const imageUrl = getFullProfileImageUrl(userDetail?.profilePictureUrl);
  const isDark = resolvedTheme === 'dark';
  const currentLanguage =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === normalizeLanguage(i18n.resolvedLanguage ?? i18n.language))
    ?? SUPPORTED_LANGUAGES[0];
  const activeLanguage = currentLanguage.code;
  const languageOptions: AppDropdownOption[] = SUPPORTED_LANGUAGES.map((language) => ({
    value: language.code,
    label: `${language.flagEmoji} ${language.flagLabel} · ${language.name}`,
  }));

  const handleLanguageChange = (value: string): void => {
    void setAppLanguage(value);
  };

  const handleLogout = (): void => {
    logout();
    onOpenChange(false);
    navigate('/auth/login');
  };

  const updateBackgroundMotion = (
    enabled: boolean,
    variant: WmsBackgroundMotionVariant,
  ): void => {
    if (appearanceMutation.isPending) return;

    const previousEnabled = backgroundMotionEnabled;
    const previousVariant = backgroundMotionVariant;
    setBackgroundMotionPreferences(enabled, variant);

    appearanceMutation.mutate(
      {
        backgroundMotionEnabled: enabled,
        backgroundMotionVariant: variant,
      },
      {
        onError: (error) => {
          setBackgroundMotionPreferences(previousEnabled, previousVariant);
          toast.error(
            error instanceof Error
              ? error.message
              : t('profile.backgroundMotionSaveError'),
          );
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        portalRoot="body"
        tone="plain"
        className={cn(
          'wms-ops-profile-modal gap-0 overflow-hidden border border-slate-200/80 bg-white p-0 text-slate-900',
          'shadow-[0_28px_70px_rgba(15,23,42,0.14)] dark:border-white/[0.08] dark:bg-[#09090f] dark:text-white dark:shadow-[0_28px_90px_rgba(0,0,0,0.62)]',
          'grid w-[min(95vw,1100px)] max-w-[min(95vw,1100px)] grid-cols-1',
          '!h-[min(760px,calc(100dvh-2rem))] !max-h-[calc(100dvh-2rem)] !overflow-hidden [scrollbar-gutter:auto]',
          'sm:w-full sm:max-w-4xl',
          'md:grid-cols-[320px_minmax(0,1fr)]',
          'lg:!max-w-[1100px] lg:grid-cols-[380px_minmax(0,1fr)]',
        )}
        aria-describedby="user-profile-description"
      >
        <DialogTitle className="sr-only">{t('sidebar.settings')}</DialogTitle>

        <aside
          id="user-profile-description"
          aria-label={t('profile.title')}
          className={cn(
            'wms-ops-profile-modal__aside relative flex flex-col items-center justify-center gap-5 border-b border-slate-200/70 px-6 py-8 sm:gap-6 sm:px-8 sm:py-9',
            'bg-linear-to-b from-slate-50 to-white dark:border-white/[0.06] dark:from-[#0c0c14] dark:to-[#09090f]',
            'md:h-full md:min-h-0 md:shrink-0 md:border-b-0 md:border-r md:overflow-y-auto md:py-10',
            'md:w-[320px] lg:w-[380px]',
          )}
        >
          <div className="group relative shrink-0 cursor-pointer px-1 pb-2 pt-1">
            <div className="relative origin-center transition-transform duration-500 ease-out rotate-[2deg] group-hover:rotate-0 motion-reduce:rotate-0 motion-reduce:transition-none">
              <div className="rounded-[1.5rem] bg-white/95 p-1.5 shadow-md ring-1 ring-inset ring-slate-200/70 md:rounded-[2rem] md:p-2 dark:bg-zinc-900/50 dark:shadow-[0_12px_36px_rgba(9,9,11,0.42),0_0_36px_-8px_rgba(56,189,248,0.22)] dark:ring-white/[0.07]">
                <div className="relative h-20 w-20 overflow-hidden rounded-[1.25rem] md:h-40 md:w-40 md:rounded-[1.5rem]">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[image:var(--wms-brand-gradient)]">
                      <span className="text-3xl font-bold tracking-tight text-white md:text-6xl">{displayInitial}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500 ring-[3px] ring-white md:h-9 md:w-9 dark:ring-[#09090f]">
                <ShieldCheck className="h-4 w-4 text-white md:h-[18px] md:w-[18px]" strokeWidth={2.25} aria-hidden />
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2.5 text-center sm:gap-3">
            <p className="max-w-full px-1 text-lg font-bold tracking-tight text-slate-900 md:text-2xl lg:text-3xl dark:text-white">
              {displayName}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[image:var(--wms-brand-gradient)] px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_0_12px_var(--wms-brand-shadow)]">
              <HugeiconsIcon icon={Building03Icon} size={13} strokeWidth={2} aria-hidden />
              {t('profile.organizationBadge')}
            </span>
          </div>

          <div className="wms-ops-profile-modal__mail flex w-full max-w-[min(280px,100%)] items-center gap-3 border border-slate-200/70 bg-slate-50/90 px-4 py-3 shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
            <HugeiconsIcon
              icon={Mail02Icon}
              size={20}
              strokeWidth={1.75}
              className="shrink-0 text-[var(--wms-brand-primary)]"
              aria-hidden
            />
            <span className="min-w-0 truncate text-xs font-semibold text-slate-600 opacity-70 md:text-sm dark:text-slate-300">
              {user?.email ?? '—'}
            </span>
          </div>
        </aside>

        <div className="wms-ops-profile-modal__panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50/80 dark:bg-[#07070c]">
          <header className="wms-ops-profile-modal__header flex shrink-0 items-center justify-between gap-3 border-b border-dashed border-slate-200/70 px-6 py-5 sm:px-8 md:px-10 dark:border-white/[0.08]">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-8 w-0.5 shrink-0 rounded-full bg-[var(--wms-brand-primary)] shadow-[0_0_10px_var(--wms-brand-shadow)]"
                aria-hidden
              />
              <h2 className="text-xl font-bold uppercase tracking-[0.12em] text-slate-900 sm:text-2xl lg:text-3xl dark:text-white">
                {t('sidebar.settings')}
              </h2>
            </div>
            <DialogClose
              type="button"
              className={cn(
                'wms-ops-profile-modal__close flex size-9 shrink-0 cursor-pointer items-center justify-center transition-[border-color,box-shadow,transform] duration-300',
                'border border-slate-200/80 bg-white/80 text-slate-500',
                'hover:border-red-300/50 hover:bg-red-50/90 hover:text-red-600 active:scale-90',
                'dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400',
                'dark:hover:border-red-500/30 dark:hover:bg-red-950/30 dark:hover:text-red-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)] focus-visible:ring-offset-0',
              )}
            >
              <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              <span className="sr-only">{t('common.close')}</span>
            </DialogClose>
          </header>

          <div className="wms-ops-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-4 sm:px-8 md:px-10">
            <button type="button" onClick={onOpenProfileDetails} className={settingsProfileRowClass}>
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <span className={cn(settingsIconClass, 'bg-violet-600/90')}>
                  <HugeiconsIcon
                    icon={UserCircleIcon}
                    size={settingsHugeiconSize}
                    strokeWidth={settingsHugeiconStroke}
                    className="text-white"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                    {t('profile.settingsProfileInfo')}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:mt-1 sm:text-sm dark:text-slate-400">
                    {t('profile.settingsProfileHint')}
                  </p>
                </div>
              </div>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-slate-400 opacity-30 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-60 dark:text-slate-500"
                aria-hidden
              />
            </button>

            <div className={settingsRowBaseClass}>
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <span className={cn(settingsIconClass, 'bg-[var(--wms-brand-primary)] text-[var(--wms-brand-on-primary)]')}>
                  <HugeiconsIcon
                    icon={LanguageCircleIcon}
                    size={settingsHugeiconSize}
                    strokeWidth={settingsHugeiconStroke}
                    className="text-[var(--wms-brand-on-primary)]"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                  {t('profile.settingsLanguage')}
                </span>
              </div>
              <AppDropdown
                value={currentLanguage.code}
                onValueChange={handleLanguageChange}
                options={languageOptions}
                ariaLabel={t('profile.settingsLanguage')}
                searchable
                tone="plain"
                portalContainer={null}
                matchTriggerWidth={false}
                contentAlign="end"
                renderValue={() => (
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{currentLanguage.flagEmoji}</span>
                    <span className="font-semibold tracking-wide">{currentLanguage.flagLabel}</span>
                  </span>
                )}
                className="wms-ops-profile-lang-trigger h-10 w-auto min-w-[6.5rem] shrink-0 px-3 text-sm font-semibold sm:h-11 sm:px-4 sm:text-base"
                contentClassName="wms-ops-profile-lang-select wms-ops-scrollbar min-w-[15rem]"
              />
            </div>

            <div className={cn(settingsRowBaseClass, useCustomBrandThemes && 'opacity-60')}>
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <span className={cn(settingsIconClass, 'bg-[var(--wms-brand-accent)] text-[var(--wms-brand-on-primary)]')}>
                  <HugeiconsIcon
                    icon={isDark ? Moon02Icon : Sun02Icon}
                    size={settingsHugeiconSize}
                    strokeWidth={settingsHugeiconStroke}
                    className="text-[var(--wms-brand-on-primary)]"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                    {t('profile.settingsAppearance')}
                  </span>
                  {useCustomBrandThemes ? (
                    <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-sm dark:text-slate-400">
                      {t('profile.settingsAppearanceDisabledHint')}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="wms-ops-profile-modal__switch-slot shrink-0 self-center">
                <OpsLightSwitch
                  checked={isDark}
                  disabled={useCustomBrandThemes}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  onLabel={t('profile.terminal.switchOn', { defaultValue: 'ON' })}
                  offLabel={t('profile.terminal.switchOff', { defaultValue: 'OFF' })}
                  aria-label={t('profile.settingsAppearance')}
                />
              </div>
            </div>

            <div className={settingsRowBaseClass}>
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <span className={cn(settingsIconClass, 'bg-slate-700 text-white dark:bg-white/10')}>
                  <MonitorCog className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                    {t('profile.settingsSkin')}
                  </span>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-sm dark:text-slate-400">
                    {t('profile.settingsSkinHint')}
                  </p>
                </div>
              </div>
              <div
                className="wms-skin-switch shrink-0 self-center"
                role="radiogroup"
                aria-label={t('profile.settingsSkin')}
              >
                <span
                  className="wms-skin-switch__glider"
                  data-skin={skin}
                  aria-hidden
                />
                <button
                  type="button"
                  role="radio"
                  aria-checked={skin === 'terminal'}
                  title={t('profile.skinTerminalHint')}
                  onClick={() => setSkin('terminal')}
                  className={cn('wms-skin-switch__option', skin === 'terminal' && 'wms-skin-switch__option--active')}
                >
                  <TerminalSquare className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  {t('profile.skinTerminal')}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={skin === 'premium'}
                  title={t('profile.skinPremiumHint')}
                  onClick={() => setSkin('premium')}
                  className={cn('wms-skin-switch__option', skin === 'premium' && 'wms-skin-switch__option--active')}
                >
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  {t('profile.skinPremium')}
                </button>
              </div>
            </div>

            <div
              className={cn(
                'wms-ops-profile-modal__theme-panel border px-4 py-4 sm:px-5',
                'border-slate-200/70 bg-white/90 dark:border-white/[0.06] dark:bg-white/[0.03]',
              )}
              aria-busy={appearanceMutation.isPending}
            >
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <span className={cn(settingsIconClass, 'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]')}>
                    <ScanLine className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                      {t('profile.settingsBackgroundMotion')}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-sm dark:text-slate-400">
                      {t('profile.settingsBackgroundMotionHint')}
                    </p>
                  </div>
                </div>
                <div className="wms-ops-profile-modal__circuit-slot shrink-0">
                  <OpsCircuitToggle
                    horizontal
                    checked={backgroundMotionEnabled}
                    disabled={appearanceMutation.isPending}
                    onCheckedChange={(checked) => updateBackgroundMotion(checked, backgroundMotionVariant)}
                    aria-label={t('profile.settingsBackgroundMotion')}
                  />
                </div>
              </div>

              {backgroundMotionEnabled ? (
                <>
                  {prefersReducedMotion ? (
                    <p
                      className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-200"
                      role="status"
                    >
                      {t('profile.backgroundMotionReduced')}
                    </p>
                  ) : null}

                  <div
                    className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
                    role="radiogroup"
                    aria-label={t('profile.settingsBackgroundMotion')}
                  >
                    {wmsBackgroundMotionOptions.map((option) => {
                      const isSelected = option.id === backgroundMotionVariant;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={appearanceMutation.isPending}
                          onClick={() => updateBackgroundMotion(true, option.id)}
                          className={cn(
                            'group min-w-0 rounded-xl border p-2 text-left transition-[border-color,box-shadow,transform] duration-200',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)] disabled:cursor-wait disabled:opacity-60',
                            isSelected
                              ? 'border-[var(--wms-brand-primary)] bg-[var(--wms-brand-soft)] shadow-[0_10px_24px_-18px_var(--wms-brand-shadow)]'
                              : 'border-slate-200 bg-white/65 hover:-translate-y-0.5 hover:border-[var(--wms-brand-ring)] dark:border-white/10 dark:bg-black/10',
                          )}
                        >
                          <WarehouseMotionScene
                            variant={option.id}
                            running={isSelected && !prefersReducedMotion && !appearanceMutation.isPending}
                            preview
                          />
                          <span className="mt-2 block truncate text-xs font-bold text-slate-900 dark:text-white">
                            {t(option.labelKey)}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                            {t(option.descriptionKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>

            <div
              className={cn(
                'wms-ops-profile-modal__theme-panel border px-4 py-4 sm:px-5',
                'border-slate-200/70 bg-white/90 dark:border-white/[0.06] dark:bg-white/[0.03]',
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                  <span className={cn(settingsIconClass, 'bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]')}>
                    <Palette className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                      {t('profile.settingsUseCustomBrandThemes')}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:text-sm dark:text-slate-400">
                      {t('profile.settingsUseCustomBrandThemesHint')}
                    </p>
                  </div>
                </div>
                <div className="wms-ops-profile-modal__circuit-slot shrink-0">
                  <OpsCircuitToggle
                    horizontal
                    checked={useCustomBrandThemes}
                    onCheckedChange={setUseCustomBrandThemes}
                    aria-label={t('profile.settingsUseCustomBrandThemes')}
                  />
                </div>
              </div>

              {useCustomBrandThemes ? (
              <div className="wms-ops-profile-modal__theme-grid wms-ops-scrollbar grid max-h-[260px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:max-h-[300px] lg:max-h-[340px]">
                {brandThemes.map((item) => {
                  const isSelected = item.id === brandTheme;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBrandTheme(item.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        'wms-ops-profile-modal__theme-option group flex min-h-16 items-center gap-3 border p-3 text-left transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]',
                        isSelected
                          ? 'wms-ops-profile-modal__theme-option--selected border-[var(--wms-brand-primary)] bg-[var(--wms-brand-soft)] shadow-[0_12px_30px_-22px_var(--wms-brand-shadow)]'
                          : 'border-slate-200 bg-white/70 hover:border-[var(--wms-brand-ring)] hover:bg-white dark:border-white/10 dark:bg-black/10 dark:hover:bg-white/5',
                      )}
                    >
                      <span className="flex h-9 w-12 shrink-0 overflow-hidden border border-white/50 shadow-sm dark:border-white/10">
                        {item.swatches.map((color, index) => (
                          <span key={`${item.id}-${index}-${color}`} className="h-full flex-1" style={{ backgroundColor: color }} />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-white">
                          {localizeLegacyUiText(item.label, activeLanguage)}
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-[10px] font-medium text-[var(--wms-app-text-muted)] sm:text-[11px]">
                          {localizeLegacyUiText(item.description, activeLanguage)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'wms-ops-profile-theme-check',
                          isSelected && 'wms-ops-profile-theme-check--on',
                        )}
                        aria-hidden
                      >
                        <span className="wms-ops-profile-theme-check__fill" />
                        <span className="wms-ops-profile-theme-check__corner wms-ops-profile-theme-check__corner--tl" />
                        <span className="wms-ops-profile-theme-check__corner wms-ops-profile-theme-check__corner--tr" />
                        <span className="wms-ops-profile-theme-check__corner wms-ops-profile-theme-check__corner--bl" />
                        <span className="wms-ops-profile-theme-check__corner wms-ops-profile-theme-check__corner--br" />
                      </span>
                    </button>
                  );
                })}
              </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-dashed border-slate-200/70 bg-white/80 px-6 py-4 dark:border-white/[0.06] dark:bg-[#07070c] sm:px-8 sm:py-5 md:px-10">
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'wms-ops-profile-modal__logout flex h-12 w-full cursor-pointer items-center justify-center gap-3 bg-[image:var(--wms-brand-gradient)] px-6 md:h-14',
                'text-sm font-bold uppercase tracking-[0.08em] text-white transition-all duration-300 sm:text-base',
                'shadow-[0_8px_24px_var(--wms-brand-shadow)]',
                'hover:scale-[1.01] hover:brightness-[1.05] hover:shadow-[0_10px_32px_var(--wms-brand-shadow)]',
                'active:scale-[0.98]',
              )}
            >
              <HugeiconsIcon icon={Logout02Icon} size={20} strokeWidth={1.75} className="shrink-0 text-white" aria-hidden />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
