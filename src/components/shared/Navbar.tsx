import { type ReactElement, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import ClipboardListIcon from '@hugeicons/core-free-icons/ClipboardListIcon';
import DeliveryTruck01Icon from '@hugeicons/core-free-icons/DeliveryTruck01Icon';
import Mic01Icon from '@hugeicons/core-free-icons/Mic01Icon';
import PackageReceive01Icon from '@hugeicons/core-free-icons/PackageReceive01Icon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';
import SidebarLeft01Icon from '@hugeicons/core-free-icons/SidebarLeft01Icon';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import v3riiWmsLogo from '@/assets/v3riiwms.png';
import { NotificationIcon } from '@/features/notification/components/NotificationIcon';
import { NavbarGradientIcon, NavbarIconGradientDefs } from '@/components/shared/NavbarGradientIcon';
import { navbarIconButtonClassName } from '@/components/shared/navbar-gradient-icon.styles';
import { NavbarKpiStrip } from '@/components/shared/NavbarKpiStrip';
import { coerceNavbarCenterMode, coerceNavbarKpiKeys } from '@/lib/navbar-preferences';
import { useVoiceSearch } from '@/hooks/useVoiceSearch';
import { resolveNavItemTitle, type NavItem } from './nav-items';
import { useUserDetail } from '@/features/user-detail/hooks/useUserDetail';
import { useNavbarQuickSearch } from '@/features/dashboard/hooks/useNavbarQuickSearch';
import {
  QUICK_SEARCH_SCOPE_CHIPS,
  readQuickSearchScopes,
  toggleQuickSearchScope,
  writeQuickSearchScopes,
  type QuickSearchScope,
} from '@/features/dashboard/lib/quick-search-scopes';
import type { DashboardQuickSearchHit } from '@/features/dashboard/types/dashboard.types';
import { useOptionalStockCard } from '@/features/erp-mirror/components/StockCardProvider';
import { useOptionalInventoryLookup } from '@/features/stock-balances/components/InventoryLookupProvider';

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

export function Navbar({ navItems = [] }: NavbarProps): ReactElement {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const menuSearchRef = useRef<HTMLInputElement>(null);
  const centerSearchRef = useRef<HTMLInputElement>(null);
  const voiceTargetRef = useRef<'menu' | 'center'>('menu');
  const user = useAuthStore((state) => state.user);
  const branch = useAuthStore((state) => state.branch);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const searchQuery = useUIStore((state) => state.searchQuery);
  const setSearchQuery = useUIStore((state) => state.setSearchQuery);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const { skin } = useTheme();
  const isPremium = skin === 'premium';
  const { data: userDetail } = useUserDetail();
  const stockCard = useOptionalStockCard();
  const inventoryLookup = useOptionalInventoryLookup();
  const navbarCenterMode = coerceNavbarCenterMode(userDetail?.navbarCenterMode);
  const navbarKpiKeys = coerceNavbarKpiKeys(userDetail?.navbarKpiKeys);
  const showKpiStrip = navbarCenterMode === 'kpi';
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [centerQuery, setCenterQuery] = useState('');
  const [centerScopes, setCenterScopes] = useState<QuickSearchScope[]>(readQuickSearchScopes);
  const [, setIsMenuSearchFocus] = useState(false);
  const [isCenterSearchFocus, setIsCenterSearchFocus] = useState(false);
  const [isMenuSearchExpanded, setIsMenuSearchExpanded] = useState(false);
  const [isCenterSearchExpanded, setIsCenterSearchExpanded] = useState(false);
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
      if (voiceTargetRef.current === 'center') {
        setCenterQuery(text);
        setIsCenterSearchFocus(true);
        if (showKpiStrip) setIsCenterSearchExpanded(true);
        return;
      }
      setSearchQuery(text);
      setIsMenuSearchFocus(true);
      setIsMenuSearchExpanded(true);
    },
  });

  const searchTargets = useMemo(
    () => flattenSearchTargets(navItems, resolveTitle, resolveAlias),
    [navItems, resolveTitle, resolveAlias],
  );
  const menuResults = useMemo(() => {
    if (!searchQuery.trim()) return [] as SearchTarget[];
    return searchTargets.filter((item) => matchesSearchQuery(item.haystack, searchQuery)).slice(0, 8);
  }, [searchQuery, searchTargets]);
  const {
    results: centerResults,
    isSearching: isCenterSearching,
    tooShort: isCenterQueryTooShort,
  } = useNavbarQuickSearch(centerQuery, centerQuery.trim().length > 0, centerScopes);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsMenuSearchExpanded(false);
        if (showKpiStrip || (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)) {
          setIsCenterSearchExpanded(true);
        }
        requestAnimationFrame(() => {
          centerSearchRef.current?.focus();
          centerSearchRef.current?.select();
        });
      }
      if (e.key === 'Escape') {
        if (isCenterSearchExpanded) {
          setCenterQuery('');
          setIsCenterSearchExpanded(false);
          setIsCenterSearchFocus(false);
        }
        if (isMenuSearchExpanded) {
          setSearchQuery('');
          setIsMenuSearchExpanded(false);
          setIsMenuSearchFocus(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchQuery, showKpiStrip, isCenterSearchExpanded, isMenuSearchExpanded]);

  useEffect(() => {
    if (isMenuSearchExpanded) {
      setIsMenuSearchFocus(true);
      requestAnimationFrame(() => menuSearchRef.current?.focus());
    }
  }, [isMenuSearchExpanded]);

  useEffect(() => {
    if (isCenterSearchExpanded) {
      setIsCenterSearchFocus(true);
      requestAnimationFrame(() => centerSearchRef.current?.focus());
    }
  }, [isCenterSearchExpanded]);

  const openMenuSearch = (): void => {
    setIsCenterSearchExpanded(false);
    setIsMenuSearchExpanded(true);
    setIsMenuSearchFocus(true);
    voiceTargetRef.current = 'menu';
    if (!isPremium) setSidebarOpen(true);
  };

  const handleMenuSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!isPremium && val.trim().length > 0) {
      setSidebarOpen(true);
    }
  };

  const handleCenterSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setCenterQuery(e.target.value);
  };

  const handleCenterScopeToggle = (scope: QuickSearchScope): void => {
    const next = toggleQuickSearchScope(centerScopes, scope);
    setCenterScopes(next);
    writeQuickSearchScopes(next);
    setIsCenterSearchFocus(true);
    requestAnimationFrame(() => centerSearchRef.current?.focus());
  };

  const handleMenuNavigate = (target: SearchTarget): void => {
    setSearchQuery('');
    setIsMenuSearchFocus(false);
    setIsMenuSearchExpanded(false);
    navigate(target.href);
  };

  const handleCenterNavigate = (target: DashboardQuickSearchHit): void => {
    setCenterQuery('');
    setIsCenterSearchFocus(false);
    setIsCenterSearchExpanded(false);
    if (target.kind === 'stock' && stockCard) {
      const parsedId = Number(target.id);
      const stockId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
      void stockCard.openStockCard({
        stockId,
        stockCode: target.title,
        stockName: target.subtitle || null,
        branchCode: branch?.code ?? null,
      });
      return;
    }
    if (target.kind === 'lot' && inventoryLookup && target.id.trim()) {
      void inventoryLookup.openLot(target.id);
      return;
    }
    const lookupId = Number(target.id);
    if (Number.isFinite(lookupId) && lookupId > 0 && inventoryLookup) {
      if (target.kind === 'warehouse') {
        void inventoryLookup.openWarehouse(lookupId);
        return;
      }
      if (target.kind === 'location') {
        void inventoryLookup.openLocation(lookupId);
        return;
      }
      if (target.kind === 'serial') {
        void inventoryLookup.openSerial(lookupId);
        return;
      }
    }
    navigate(target.href);
  };

  const handleMenuSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (isPremium && e.key === 'Enter' && menuResults.length > 0) {
      e.preventDefault();
      handleMenuNavigate(menuResults[0]);
    }
  };

  const handleCenterSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && centerResults.length > 0) {
      e.preventDefault();
      handleCenterNavigate(centerResults[0]);
    }
  };

  const displayName = user?.name || user?.email || t('common.user');
  const displayInitial = displayName.charAt(0).toUpperCase();
  const navbarBranchCodeTrimmed = branch?.code?.trim();
  const displayBranchName = branch?.name || t('roles.admin');
  const navbarBranchCodePrefix =
    navbarBranchCodeTrimmed && navbarBranchCodeTrimmed.toLowerCase() !== '0'
      ? `${navbarBranchCodeTrimmed} • `
      : '';

  const renderMenuSearchResults = (): ReactElement | null => {
    if (!isPremium || !isMenuSearchExpanded || !searchQuery.trim().length) return null;

    return (
      <div className="wms-premium-navbar-search__results absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-y-auto rounded-xl border border-[color-mix(in_oklab,var(--wms-brand-primary)_28%,transparent)] p-2 shadow-xl backdrop-blur-xl">
        {menuResults.length > 0 ? (
          menuResults.map((item) => (
            <button
              key={item.href}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleMenuNavigate(item)}
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

  const renderCenterSearchResults = (): ReactElement | null => {
    if (!isCenterSearchFocus || !centerQuery.trim().length) return null;

    const kindLabel = (kind: string): string =>
      t(`navbar.search_kinds.${kind}`, { defaultValue: kind });

    let body: ReactElement;
    if (isCenterQueryTooShort) {
      body = <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{t('navbar.search_min_chars')}</p>;
    } else if (isCenterSearching && centerResults.length === 0) {
      body = <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{t('navbar.search_searching')}</p>;
    } else if (centerResults.length > 0) {
      body = (
        <>
          {centerResults.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleCenterNavigate(item)}
              className="wms-premium-navbar-search__result-item flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--wms-brand-soft)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-100">
                  {item.title}
                </span>
                {item.subtitle ? (
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.subtitle}</span>
                ) : null}
              </span>
              <span className="ml-3 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-brand-primary)]">
                {kindLabel(item.kind)}
              </span>
            </button>
          ))}
        </>
      );
    } else {
      body = <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{t('common.notFound')}</p>;
    }

    return (
      <div className="wms-premium-navbar-search__results absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-y-auto rounded-xl border border-[color-mix(in_oklab,var(--wms-brand-primary)_28%,transparent)] p-2 shadow-xl backdrop-blur-xl">
        {body}
      </div>
    );
  };

  const closeMenuSearch = (): void => {
    setSearchQuery('');
    setIsMenuSearchExpanded(false);
    setIsMenuSearchFocus(false);
  };

  const closeCenterSearchOverlay = (): void => {
    setCenterQuery('');
    setIsCenterSearchExpanded(false);
    setIsCenterSearchFocus(false);
  };

  const renderMenuSearch = (): ReactElement => (
    <>
      {!isMenuSearchExpanded ? (
        <button
          type="button"
          onClick={openMenuSearch}
          className={cn(navbarIconButtonClassName, 'wms-premium-navbar-search__trigger')}
          aria-label={t('navbar.menu_search_placeholder')}
          title={t('navbar.menu_search_placeholder')}
        >
          <NavbarGradientIcon icon={Search01Icon} size={22} />
        </button>
      ) : (
        <div className="wms-premium-navbar-search-layer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="wms-premium-navbar-search-layer__backdrop"
            aria-label={t('common.close')}
            onClick={closeMenuSearch}
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
                ref={menuSearchRef}
                type="text"
                inputMode="search"
                autoComplete="off"
                value={searchQuery}
                onChange={handleMenuSearch}
                onKeyDown={handleMenuSearchKeyDown}
                onFocus={() => {
                  voiceTargetRef.current = 'menu';
                  setIsMenuSearchFocus(true);
                }}
                onBlur={() => {
                  if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
                    setTimeout(() => {
                      if (!searchQuery.trim()) closeMenuSearch();
                      else setIsMenuSearchFocus(false);
                    }, 140);
                  }
                }}
                placeholder={t('navbar.menu_search_placeholder')}
                className="wms-premium-navbar-search__input"
              />
              <div className="absolute right-2 top-1/2 z-[1] flex -translate-y-1/2 items-center gap-0.5">
                {isSupported && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      voiceTargetRef.current = 'menu';
                      setIsMenuSearchFocus(true);
                      startListening();
                    }}
                    className={cn(
                      'rounded-xl p-1.5 transition-all duration-300',
                      isListening && voiceTargetRef.current === 'menu'
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
                  onClick={closeMenuSearch}
                  className="rounded-full p-1.5 text-slate-400 transition-colors duration-300 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/20 dark:hover:text-white"
                  aria-label={t('common.close')}
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.75} />
                </button>
              </div>
              {renderMenuSearchResults()}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderCenterSearchField = (): ReactElement => (
    <div
      className={cn(
        'wms-navbar-ops-search',
        isCenterSearchFocus && 'is-focus',
        centerQuery && 'has-query',
      )}
    >
      {isPremium ? <div aria-hidden className="wms-navbar-ops-search__glow" /> : null}
      <div className="wms-navbar-ops-search__shell">
        <div className="wms-navbar-ops-search__rail" aria-hidden>
          <span className="wms-navbar-ops-search__mark">
            <HugeiconsIcon icon={PackageReceive01Icon} size={13} strokeWidth={1.8} />
            <HugeiconsIcon icon={ClipboardListIcon} size={13} strokeWidth={1.8} />
            <HugeiconsIcon icon={DeliveryTruck01Icon} size={13} strokeWidth={1.8} />
          </span>
          <span className="wms-navbar-ops-search__badge">
            {t(isPremium ? 'navbar.search_badge_premium' : 'navbar.search_badge_terminal')}
          </span>
        </div>
        <input
          ref={centerSearchRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          value={centerQuery}
          onChange={handleCenterSearch}
          onKeyDown={handleCenterSearchKeyDown}
          onFocus={() => {
            voiceTargetRef.current = 'center';
            setIsCenterSearchFocus(true);
          }}
          onBlur={() => {
            setTimeout(() => setIsCenterSearchFocus(false), 140);
          }}
          placeholder={t('navbar.search_placeholder')}
          className="wms-navbar-ops-search__input"
        />
        <div className="wms-navbar-ops-search__scopes" role="group" aria-label={t('navbar.search_scopes')}>
          {QUICK_SEARCH_SCOPE_CHIPS.map((chip) => {
            const active = centerScopes.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={active}
                title={t(chip.hintKey)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleCenterScopeToggle(chip.id)}
                className={cn('wms-navbar-ops-search__scope', active && 'is-on')}
              >
                {t(chip.labelKey)}
              </button>
            );
          })}
        </div>
        <div className="wms-navbar-ops-search__tools">
          {isSupported && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                voiceTargetRef.current = 'center';
                setIsCenterSearchFocus(true);
                startListening();
              }}
              className={cn(
                'wms-navbar-ops-search__tool',
                isListening && voiceTargetRef.current === 'center' && 'is-live',
              )}
              title={t('voiceSearch.start')}
            >
              <HugeiconsIcon icon={Mic01Icon} size={16} strokeWidth={1.75} />
            </button>
          )}
          {centerQuery ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCenterQuery('')}
              className="wms-navbar-ops-search__tool"
              aria-label={t('common.close')}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>
      {renderCenterSearchResults()}
    </div>
  );

  const renderCenterSearch = (): ReactElement => {
    if (isCenterSearchExpanded) {
      return (
        <div
          className="fixed inset-0 z-[80] flex flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-pointer border-0 bg-[rgb(2_6_14_/_52%)] backdrop-blur-[6px]"
            aria-label={t('common.close')}
            onClick={closeCenterSearchOverlay}
          />
          <div className="relative z-[1] mx-auto mt-2 w-full max-w-4xl">{renderCenterSearchField()}</div>
        </div>
      );
    }
    return renderCenterSearchField();
  };

  return (
    <>
      <header className="app-navbar-panel sticky top-0 z-40 border-b border-[var(--wms-app-border)] bg-[color-mix(in_srgb,var(--wms-app-panel)_97%,var(--wms-app-background))] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors duration-200 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:px-6">
        <NavbarIconGradientDefs />
        <div className="relative flex h-20 items-center">
          <div className="relative z-20 flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            {isPremium ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                aria-label={t('sidebar.dashboard')}
                title={t('sidebar.dashboard')}
                className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
              >
                <img
                  src={v3riiWmsLogo}
                  alt="V3RII WMS"
                  decoding="async"
                  fetchPriority="high"
                  className="wms-premium-navbar-logo h-11 w-auto object-contain sm:h-12"
                />
              </button>
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

            {renderMenuSearch()}
          </div>

          <div className="wms-navbar-center hidden min-w-0 flex-1 items-center justify-center px-3 md:flex">
            {showKpiStrip ? (
              <NavbarKpiStrip keys={navbarKpiKeys} />
            ) : (
              <>
                <div className="hidden w-full md:block">{isCenterSearchExpanded ? null : renderCenterSearchField()}</div>
                <button
                  type="button"
                  className={cn(navbarIconButtonClassName, 'md:hidden')}
                  aria-label={t('navbar.search_placeholder')}
                  title={t('navbar.search_placeholder')}
                  onClick={() => setIsCenterSearchExpanded(true)}
                >
                  <NavbarGradientIcon icon={Search01Icon} size={22} />
                </button>
              </>
            )}
          </div>
          {isCenterSearchExpanded ? renderCenterSearch() : null}

          <div className="relative z-20 ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
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
                <div className="hidden w-[190px] text-center lg:block">
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
                      'wms-navbar-user__branch-clamp text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400',
                      isPremium ? 'wms-premium-navbar-user__branch' : 'font-mono',
                    )}
                    title={displayBranchName}
                  >
                    {displayBranchName}
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
