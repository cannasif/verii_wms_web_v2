import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import v3riiWmsLogo from '@/assets/v3riiwms.png';
import v3logo from '@/assets/v3logo.png';
import { resolveNavItemTitle, type NavItem } from './nav-items';
import { SidebarNavItem } from './sidebar/SidebarNavItem';
import {
  buildNavIndex,
  collectActiveAncestorKeys,
  collectSubtreeExpandKeys,
  nodeMatchesSearch,
  resolveExpandedKeysAfterToggle,
} from './sidebar/sidebar-utils';
import { sidebarMotionClassName, sidebarShellClassName } from './sidebar/sidebar-styles';
import { TooltipProvider } from '@/components/ui/tooltip';

interface SidebarProps {
  items: NavItem[];
}

const DESKTOP_SIDEBAR_QUERY = '(min-width: 1024px)';

export function Sidebar({ items }: SidebarProps): ReactElement {
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const searchQuery = useUIStore((state) => state.searchQuery);
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen);
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [expandedItemKeys, setExpandedItemKeys] = useState<string[]>([]);
  const collapsedByUserRef = useRef<Set<string>>(new Set());
  const navScrollRef = useRef<HTMLElement | null>(null);
  const resolveTitle = useCallback(
    (item: NavItem): string => resolveNavItemTitle(t, i18n.resolvedLanguage ?? i18n.language, item),
    [i18n.language, i18n.resolvedLanguage, t],
  );

  useEffect(() => {
    navScrollRef.current?.scrollTo({ top: 0 });
  }, [searchQuery]);

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_SIDEBAR_QUERY);
    const synchronizeSidebarWithViewport = (matchesDesktop: boolean): void => {
      if (!matchesDesktop) setSidebarOpen(false);
    };

    synchronizeSidebarWithViewport(desktopQuery.matches);
    const handleBreakpointChange = (event: MediaQueryListEvent): void => {
      synchronizeSidebarWithViewport(event.matches);
    };

    desktopQuery.addEventListener('change', handleBreakpointChange);
    return () => desktopQuery.removeEventListener('change', handleBreakpointChange);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) {
      setExpandedItemKeys([]);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !window.matchMedia(DESKTOP_SIDEBAR_QUERY).matches) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSidebarOpen, setSidebarOpen]);

  useEffect(() => {
    if (searchQuery.trim()) return;

    const activeAncestorKeys = collectActiveAncestorKeys(items, location.pathname);
    const activeAncestorSet = new Set(activeAncestorKeys);
    collapsedByUserRef.current = new Set(
      [...collapsedByUserRef.current].filter((collapsedKey) => !activeAncestorSet.has(collapsedKey)),
    );
    setExpandedItemKeys(activeAncestorKeys);
  }, [items, location.pathname, searchQuery]);

  const handleToggle = useCallback(
    (key: string): void => {
      setExpandedItemKeys((previousKeys) => {
        const isCollapsing = previousKeys.includes(key);
        const index = buildNavIndex(items);
        const subtreeKeys = collectSubtreeExpandKeys(key, index);
        const collapsedSet = new Set(collapsedByUserRef.current);

        if (isCollapsing) {
          subtreeKeys.forEach((subtreeKey) => collapsedSet.add(subtreeKey));
        } else {
          subtreeKeys.forEach((subtreeKey) => collapsedSet.delete(subtreeKey));
        }

        collapsedByUserRef.current = collapsedSet;
        return resolveExpandedKeysAfterToggle(
          previousKeys,
          key,
          items,
          location.pathname,
          collapsedSet,
        );
      });
    },
    [items, location.pathname],
  );

  const closeLabel = t('common.close', { defaultValue: 'Kapat' });
  const visibleItems = items.filter((item) => nodeMatchesSearch(item, searchQuery, resolveTitle));

  return (
    <>
      <button
        type="button"
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity duration-[260ms] ease-[cubic-bezier(0.4,0,0.2,1)] lg:hidden',
          isSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setSidebarOpen(false)}
        aria-label={closeLabel}
        aria-hidden={!isSidebarOpen}
        tabIndex={isSidebarOpen ? 0 : -1}
      />

      <aside
        id="app-sidebar"
        data-sidebar-open={isSidebarOpen ? 'true' : 'false'}
        data-layout-region="sidebar"
        aria-label={t('sidebar.mainNavigation', { defaultValue: 'Ana menü' })}
        className={cn(
          'app-sidebar-panel fixed inset-y-0 left-0 z-50 flex h-[100dvh] min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r',
          'lg:sticky lg:inset-y-auto lg:top-0',
          sidebarShellClassName,
          sidebarMotionClassName,
          isSidebarOpen ? 'translate-x-0 lg:w-72' : '-translate-x-full lg:w-20 lg:translate-x-0',
        )}
      >
        <div className="relative z-10 h-24 shrink-0 overflow-hidden border-b border-slate-200/70 sm:h-28 lg:h-32 dark:border-white/5">
          <div
            className={cn(
              'relative flex h-full items-center justify-center transition-[padding] duration-[260ms]',
              isSidebarOpen ? 'px-3' : 'px-0.5',
            )}
          >
            <Link
              to="/dashboard"
              aria-label={t('sidebar.dashboard')}
              title={t('sidebar.dashboard')}
              className="relative flex h-full min-w-0 flex-1 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)]"
            >
              <img
                src={v3riiWmsLogo}
                alt="V3RII WMS"
                decoding="async"
                fetchPriority="high"
                width={320}
                height={160}
                className={cn(
                  'h-24 w-auto max-w-[min(100%,17.5rem)] object-contain transition-opacity duration-[260ms] sm:h-28 lg:h-32',
                  isSidebarOpen ? 'opacity-100' : 'pointer-events-none absolute opacity-0',
                )}
              />
              <img
                src={v3logo}
                alt="V3"
                decoding="async"
                width={128}
                height={128}
                className={cn(
                  'object-contain transition-[opacity,transform] duration-[260ms]',
                  isSidebarOpen
                    ? 'pointer-events-none absolute h-24 w-auto opacity-0'
                    : 'h-14 w-14 origin-center scale-[2.1] opacity-100',
                )}
              />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'absolute right-3 rounded-xl p-2 text-slate-500 transition-colors duration-300 hover:bg-[var(--wms-brand-soft)] hover:text-[var(--wms-brand-primary)] lg:hidden',
                'rtl:right-auto rtl:left-3',
                !isSidebarOpen && 'pointer-events-none opacity-0',
              )}
              aria-label={closeLabel}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <TooltipProvider delayDuration={400}>
          <nav
            ref={navScrollRef}
            className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain p-3 touch-pan-y"
            aria-label={t('sidebar.mainNavigation', { defaultValue: 'Ana menü' })}
          >
            {isSidebarOpen && searchQuery.trim().length > 0 ? (
              <div className="mb-1 rounded-sm border border-[var(--wms-brand-ring)] bg-[var(--wms-brand-soft)] px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-[var(--wms-brand-primary)]">
                {t('sidebar.filterLabel')}: {searchQuery}
              </div>
            ) : null}
            {visibleItems.map((item, index) => (
              <div
                key={item.href || item.title || index}
                className={cn(index > 0 && 'mt-2 border-t border-slate-200/50 pt-2 dark:border-white/5')}
              >
                <SidebarNavItem
                  item={item}
                  searchQuery={searchQuery}
                  expandedItemKeys={expandedItemKeys}
                  onToggle={handleToggle}
                  resolveTitle={resolveTitle}
                />
              </div>
            ))}
          </nav>
        </TooltipProvider>
      </aside>
    </>
  );
}
