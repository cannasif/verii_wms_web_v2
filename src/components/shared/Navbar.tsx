import { type ReactElement, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Mic01Icon from '@hugeicons/core-free-icons/Mic01Icon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import SidebarLeft01Icon from '@hugeicons/core-free-icons/SidebarLeft01Icon';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useTheme } from '@/components/theme-provider';
import v3riiWmsLogo from '@/assets/v3riiwms.png';
import { NotificationIcon } from '@/features/notification/components/NotificationIcon';
import { NavbarGradientIcon, NavbarIconGradientDefs } from '@/components/shared/NavbarGradientIcon';
import { navbarIconButtonClassName } from '@/components/shared/navbar-gradient-icon.styles';
import { cn } from '@/lib/utils';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { resolveNavItemTitle, type NavItem } from './nav-items';

const UserProfileModal = lazy(() =>
  import('@/features/user-detail').then((module) => ({
    default: module.UserProfileModal,
  })),
);

interface SearchTarget {
  title: string;
  subtitle: string;
  href: string;
  haystack: string;
}

interface NavbarProps {
  navItems?: NavItem[];
}

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

const matchesSearchQuery = (haystack: string, query: string): boolean => {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedQuery = normalizeText(query.trim());
  if (!normalizedQuery) return false;
  if (normalizedHaystack.includes(normalizedQuery)) return true;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => normalizedHaystack.includes(token));
};

const flattenSearchTargets = (
  items: NavItem[],
  resolveTitle: (item: NavItem) => string,
  resolveAlias: (alias: string) => string,
): SearchTarget[] => {
  const targets: SearchTarget[] = [];
  const seenHrefs = new Set<string>();
  const walk = (nodes: NavItem[], trail: string[]): void => {
    for (const item of nodes) {
      const title = resolveTitle(item);
      if (item.href && !seenHrefs.has(item.href)) {
        seenHrefs.add(item.href);
        const aliases = (item.searchAliases ?? []).map(resolveAlias).filter(Boolean);
        const subtitle = [...trail, title].join(' / ');
        targets.push({
          title,
          subtitle,
          href: item.href,
          haystack: [title, item.titleFallback ?? '', subtitle, ...aliases].join(' '),
        });
      }
      if (item.children?.length) {
        walk(item.children, [...trail, title]);
      }
    }
  };
  walk(items, []);
  return targets;
};

const searchInputClassName = (isFocused: boolean): string =>
  cn(
    'w-full rounded-md border py-2.5 pl-11 pr-20 text-sm font-medium outline-none transition-all duration-300',
    'border-slate-200 bg-slate-100/60 text-slate-900 placeholder:text-slate-500',
    isFocused
      ? 'border-[var(--wms-brand-ring)] bg-white shadow-[0_0_0_1px_var(--wms-brand-ring),0_4px_18px_var(--wms-brand-shadow)]'
      : '',
    'dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500',
    isFocused
      ? 'dark:border-[var(--wms-brand-ring)] dark:bg-[var(--wms-app-panel-strong)] dark:shadow-[0_0_0_1px_var(--wms-brand-ring),0_0_18px_var(--wms-brand-shadow)]'
      : '',
  );

export function Navbar({ navItems = [] }: NavbarProps): ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((state) => state.user);
  const branch = useAuthStore((state) => state.branch);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const searchQuery = useUIStore((state) => state.searchQuery);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [isSearchFocus, setIsSearchFocus] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const resolveTitle = useMemo(
    () => (item: NavItem): string => resolveNavItemTitle(t, i18n.resolvedLanguage ?? i18n.language, item),
    [i18n.language, i18n.resolvedLanguage, t],
  );
  const resolveAlias = useMemo(
    () => (alias: string): string => t(alias, { defaultValue: alias }),
    [t],
  );

  const { isListening, isSupported, startListening } = useVoiceSearch({
    onResult: (text) => {
      setSearchQuery(text);
      if (text.trim().length > 0) {
        if (isPremium) {
          setIsSearchExpanded(true);
          setIsSearchFocus(true);
        } else {
          setSidebarOpen(true);
          setIsSearchFocus(true);
        }
      }
    },
  });

  const searchTargets = useMemo(
    () => flattenSearchTargets(navItems, resolveTitle, resolveAlias),
    [navItems, resolveTitle, resolveAlias],
  );
  const quickResults = useMemo(() => {
    if (!searchQuery.trim()) return [] as SearchTarget[];
    return searchTargets.filter((item) => matchesSearchQuery(item.haystack, searchQuery)).slice(0, 8);
  }, [searchQuery, searchTargets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isPremium) {
          setIsSearchExpanded(true);
        } else {
          setSidebarOpen(true);
        }
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      }
      if (e.key === 'Escape' && isPremium && isSearchExpanded) {
        setSearchQuery('');
        setIsSearchExpanded(false);
        setIsSearchFocus(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchQuery, setSidebarOpen, isPremium, isSearchExpanded]);

  useEffect(() => {
    if (isPremium && isSearchExpanded) {
      setIsSearchFocus(true);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isPremium, isSearchExpanded]);

  const openPremiumSearch = (): void => {
    setIsSearchExpanded(true);
    setIsSearchFocus(true);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!isPremium && val.trim().length > 0) {
      setSidebarOpen(true);
    }
  };

  const handleSearchNavigate = (target: SearchTarget): void => {
    setSearchQuery(target.title);
    if (!isPremium) {
      setSidebarOpen(true);
    }
    setIsSearchFocus(false);
    if (isPremium) {
      setIsSearchExpanded(false);
    }
    navigate(target.href);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (isPremium && e.key === 'Enter' && quickResults.length > 0) {
      e.preventDefault();
      handleSearchNavigate(quickResults[0]);
    }
  };

  const displayName = user?.name || user?.email || t('common.user');
  const displayInitial = displayName.charAt(0).toUpperCase();
  const navbarBranchCodeTrimmed = branch?.code?.trim();
  const navbarBranchCodePrefix =
    navbarBranchCodeTrimmed && navbarBranchCodeTrimmed.toLowerCase() !== '0'
      ? `${navbarBranchCodeTrimmed} • `
      : '';

  const renderSearchResults = (): ReactElement | null => {
    // Terminal mode filters the sidebar; dropdown is premium-only.
    if (!isPremium || !isSearchFocus || !searchQuery.trim().length) return null;

    return (
      <div className="wms-premium-navbar-search__results absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--wms-brand-primary)_28%,transparent)] p-2 shadow-xl backdrop-blur-xl">
        {quickResults.length > 0 ? (
          quickResults.map((item) => (
            <button
              key={item.href}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSearchNavigate(item)}
              className="wms-premium-navbar-search__result-item flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--wms-brand-soft)]"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-100">
                {item.title}
              </span>
              <span className="ml-3 max-w-[48%] truncate text-[11px] font-medium tracking-wide text-slate-400">
                {item.subtitle}
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{t('common.notFound')}</p>
        )}
      </div>
    );
  };

  const closePremiumSearch = (): void => {
    setSearchQuery('');
    setIsSearchExpanded(false);
    setIsSearchFocus(false);
  };

  const renderPremiumSearch = (): ReactElement => (
    <>
      {!isSearchExpanded ? (
        <button
          type="button"
          onClick={openPremiumSearch}
          className={cn(navbarIconButtonClassName, 'wms-premium-navbar-search__trigger')}
          aria-label={t('navbar.search_placeholder')}
          title={t('navbar.search_placeholder')}
        >
          <NavbarGradientIcon icon={Search01Icon} size={22} />
        </button>
      ) : (
        <div
          className="wms-premium-navbar-search-layer"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="wms-premium-navbar-search-layer__backdrop"
            aria-label={t('common.close')}
            onClick={closePremiumSearch}
          />
          <div className="wms-premium-navbar-search-layer__sheet">
            <div className="wms-premium-navbar-search__field relative w-full">
              <div aria-hidden className="wms-premium-navbar-search__glow" />
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                strokeWidth={1.75}
                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-[var(--wms-brand-primary)]"
              />
              <input
                ref={searchInputRef}
                type="text"
                inputMode="search"
                autoComplete="off"
                value={searchQuery}
                onChange={handleSearch}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setIsSearchFocus(true)}
                onBlur={() => {
                  // Desktop: boşsa blur'da kapat; mobilde backdrop kapatır
                  if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
                    setTimeout(() => {
                      if (!searchQuery.trim()) closePremiumSearch();
                      else setIsSearchFocus(false);
                    }, 140);
                  }
                }}
                placeholder={t('navbar.search_placeholder')}
                className="wms-premium-navbar-search__input"
              />
              <div className="absolute right-2 top-1/2 z-[1] flex -translate-y-1/2 items-center gap-0.5">
                {isSupported && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setIsSearchFocus(true);
                      startListening();
                    }}
                    className={cn(
                      'rounded-xl p-1.5 transition-all duration-300',
                      isListening
                        ? 'animate-pulse bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]'
                        : 'text-slate-400 hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-brand-primary)]',
                    )}
                    title={t('voiceSearch.start')}
                  >
                    <HugeiconsIcon icon={Mic01Icon} size={16} strokeWidth={1.75} />
                  </button>
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={closePremiumSearch}
                  className="rounded-full p-1.5 text-slate-400 transition-colors duration-300 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/20 dark:hover:text-white"
                  aria-label={t('common.close')}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.75} />
                </button>
              </div>
              {renderSearchResults()}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderTerminalSearch = (): ReactElement => (
    <>
      <div className="relative hidden w-[min(100%,20rem)] shrink-0 md:block lg:w-80">
        {isSearchFocus && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 -z-10 rounded-md bg-[image:var(--wms-brand-gradient-soft)] opacity-80 blur-2xl transition-opacity duration-300"
          />
        )}
        <HugeiconsIcon
          icon={Search01Icon}
          size={18}
          strokeWidth={1.75}
          className={cn(
            'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-300',
            isSearchFocus ? 'text-[var(--wms-brand-primary)]' : 'text-slate-400',
          )}
        />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          onKeyDown={handleSearchKeyDown}
          onFocus={() => setIsSearchFocus(true)}
          onBlur={() => setTimeout(() => setIsSearchFocus(false), 120)}
          placeholder={t('navbar.search_placeholder')}
          className={searchInputClassName(isSearchFocus)}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {isSupported && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsSearchFocus(true);
                startListening();
              }}
              className={cn(
                'rounded-xl p-1.5 transition-all duration-300',
                isListening
                  ? 'animate-pulse bg-[var(--wms-brand-soft)] text-[var(--wms-brand-primary)]'
                  : 'text-slate-400 hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-brand-primary)]',
              )}
              title={t('voiceSearch.start')}
            >
              <HugeiconsIcon icon={Mic01Icon} size={16} strokeWidth={1.75} />
            </button>
          )}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded-full p-1 text-slate-400 transition-colors duration-300 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/20 dark:hover:text-white"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {isSupported && (
        <button
          type="button"
          onClick={() => startListening()}
          className={cn(
            navbarIconButtonClassName,
            'md:hidden',
            isListening && 'shadow-[0_0_18px_var(--wms-brand-shadow)]',
          )}
          title={t('voiceSearch.start')}
          aria-label={t('voiceSearch.start')}
        >
          <NavbarGradientIcon icon={Mic01Icon} size={22} className={isListening ? 'animate-pulse' : undefined} />
        </button>
      )}
    </>
  );

  return (
    <>
      <header className="app-navbar-panel sticky top-0 z-40 border-b border-[var(--wms-app-border)] bg-[color-mix(in_srgb,var(--wms-app-panel)_97%,var(--wms-app-background))] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors duration-200 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:px-6">
        <NavbarIconGradientDefs />
        <div className="flex h-20 items-center justify-between gap-3 sm:gap-4">
          <div className="relative flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {isPremium ? (
              <img
                src={v3riiWmsLogo}
                alt="V3RII WMS"
                decoding="async"
                fetchPriority="high"
                className="wms-premium-navbar-logo h-11 w-auto shrink-0 object-contain sm:h-12"
              />
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                className={navbarIconButtonClassName}
                aria-label={t('navbar.toggleSidebar', { defaultValue: 'Toggle sidebar' })}
              >
                <NavbarGradientIcon icon={SidebarLeft01Icon} size={24} />
              </button>
            )}

            {isPremium ? renderPremiumSearch() : renderTerminalSearch()}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <NotificationIcon />

            {user && <div className="hidden h-8 w-px bg-slate-200/80 dark:bg-white/10 sm:block" />}

            {user && (
              <button
                type="button"
                onClick={() => setUserProfileModalOpen(true)}
                aria-label={t('sidebar.settings', { defaultValue: 'Ayarlar' })}
                aria-haspopup="dialog"
                aria-expanded={userProfileModalOpen}
                data-testid="navbar-profile-menu"
                className="group relative z-10 flex min-h-11 min-w-11 touch-manipulation items-center justify-end gap-3 rounded-xl px-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
              >
                <div className="hidden text-right lg:block">
                  <p
                    className={cn(
                      'max-w-[190px] truncate text-sm font-semibold text-slate-700 dark:text-slate-100',
                      isPremium && 'wms-premium-navbar-user__name',
                    )}
                  >
                    {navbarBranchCodePrefix}
                    {displayName}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400',
                      isPremium ? 'wms-premium-navbar-user__branch' : 'font-mono',
                    )}
                  >
                    {branch?.name || t('roles.admin')}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[image:var(--wms-brand-gradient)] p-[2px]',
                    'transition-[box-shadow,filter] duration-300 ease-out',
                    'group-hover:shadow-[0_0_24px_var(--wms-brand-shadow)]',
                    'group-hover:brightness-[1.03]',
                  )}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--wms-app-panel-strong)] text-xs font-bold text-[var(--wms-brand-primary)]">
                    {displayInitial}
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        {userProfileModalOpen ? (
          <UserProfileModal
            open={userProfileModalOpen}
            onOpenChange={setUserProfileModalOpen}
            onOpenProfileDetails={() => {
              setUserProfileModalOpen(false);
              navigate('/profile');
            }}
          />
        ) : null}
      </Suspense>
    </>
  );
}
