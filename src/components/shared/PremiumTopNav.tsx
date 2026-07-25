import {
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem } from './nav-items';

interface PremiumTopNavProps {
  items: NavItem[];
}

function itemContainsPath(item: NavItem, pathname: string): boolean {
  if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) {
    return true;
  }
  return item.children?.some((child) => itemContainsPath(child, pathname)) ?? false;
}

function getItemKey(item: NavItem, index: number): string {
  return item.href ?? item.title ?? String(index);
}

function collectCollapsibleKeys(item: NavItem, depth: number, trail: string): string[] {
  const keys: string[] = [];
  const key = `${trail}/${getItemKey(item, depth)}`;
  if (depth > 1 && item.children?.length) {
    keys.push(key);
  }
  item.children?.forEach((child, index) => {
    keys.push(...collectCollapsibleKeys(child, depth + 1, `${key}-${index}`));
  });
  return keys;
}

export function PremiumTopNav({ items }: PremiumTopNavProps): ReactElement {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [gliderStyle, setGliderStyle] = useState<CSSProperties | null>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const resolveTitle = useCallback(
    (item: NavItem): string => t(item.title, { defaultValue: item.titleFallback ?? item.title }),
    [t],
  );

  const activeIndex = useMemo(
    () => items.findIndex((item) => itemContainsPath(item, location.pathname)),
    [items, location.pathname],
  );

  const highlightIndex = openIndex ?? (activeIndex >= 0 ? activeIndex : null);

  const updateGlider = useCallback((): void => {
    if (highlightIndex === null) {
      setGliderStyle(null);
      return;
    }
    const tab = tabRefs.current[highlightIndex];
    const container = containerRef.current;
    if (!tab || !container) {
      setGliderStyle(null);
      return;
    }
    const tabRect = tab.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setGliderStyle({
      transform: `translateX(${tabRect.left - containerRect.left + container.scrollLeft}px)`,
      width: `${tabRect.width}px`,
    });
  }, [highlightIndex]);

  useLayoutEffect(() => {
    updateGlider();
  }, [updateGlider, items, i18n.language]);

  useEffect(() => {
    window.addEventListener('resize', updateGlider);
    return () => window.removeEventListener('resize', updateGlider);
  }, [updateGlider]);

  useEffect(() => {
    setOpenIndex(null);
  }, [location.pathname]);

  useEffect(() => {
    if (openIndex === null) {
      setExpandedGroups(new Set());
      return;
    }
    const openItem = items[openIndex];
    if (!openItem?.children?.length) {
      setExpandedGroups(new Set());
      return;
    }
    // Dropdown açılınca tüm daraltılabilir alt gruplar varsayılan açık
    const defaults = new Set<string>();
    openItem.children.forEach((child, index) => {
      collectCollapsibleKeys(child, 1, `root-${index}`).forEach((key) => defaults.add(key));
    });
    setExpandedGroups(defaults);
  }, [openIndex, items]);

  useEffect(() => {
    if (openIndex === null) return;

    const handlePointerDown = (event: MouseEvent): void => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenIndex(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpenIndex(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openIndex]);

  const toggleGroup = (key: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderLeaf = (item: NavItem, depth: number): ReactElement => {
    const isActive = Boolean(
      item.href && (location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)),
    );
    return (
      <Link
        key={item.href}
        to={item.href ?? '#'}
        className={cn(
          'wms-premium-nav__link',
          depth > 1 && 'wms-premium-nav__link--nested',
          isActive && 'wms-premium-nav__link--active',
        )}
        onClick={() => setOpenIndex(null)}
      >
        <span className="wms-premium-nav__link-text">{resolveTitle(item)}</span>
      </Link>
    );
  };

  const renderGroupContent = (item: NavItem, depth: number, trail: string): ReactElement => {
    const groupKey = `${trail}/${getItemKey(item, depth)}`;
    const isCollapsible = depth > 1 && Boolean(item.children?.length);
    const isExpanded = !isCollapsible || expandedGroups.has(groupKey);
    const isCurrent = itemContainsPath(item, location.pathname);
    const titleClassName = cn(
      'wms-premium-nav__group-title',
      depth === 1 && 'wms-premium-nav__group-title--column',
      depth > 1 && 'wms-premium-nav__group-title--nested',
      isCurrent && 'wms-premium-nav__group-title--current',
    );

    return (
      <div
        key={groupKey}
        className={cn(
          'wms-premium-nav__group',
          depth === 1 && 'wms-premium-nav__group--column',
          depth > 1 && 'wms-premium-nav__group--nested',
          isCollapsible && 'wms-premium-nav__group--collapsible',
          isCollapsible && !isExpanded && 'wms-premium-nav__group--collapsed',
          isCurrent && 'wms-premium-nav__group--current',
        )}
      >
        {isCollapsible ? (
          <button
            type="button"
            className={cn(titleClassName, 'wms-premium-nav__group-title--toggle')}
            aria-expanded={isExpanded}
            onClick={() => toggleGroup(groupKey)}
          >
            <span className="wms-premium-nav__group-title-label">{resolveTitle(item)}</span>
            <ChevronDown
              className={cn(
                'wms-premium-nav__group-chevron',
                isExpanded && 'wms-premium-nav__group-chevron--open',
              )}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        ) : (
          <p className={titleClassName}>{resolveTitle(item)}</p>
        )}
        {isExpanded ? (
          <div className="wms-premium-nav__group-body">
            {item.href ? renderLeaf(item, depth) : null}
            {item.children?.map((child, childIndex) =>
              child.children?.length
                ? renderGroupContent(child, depth + 1, `${groupKey}-${childIndex}`)
                : child.href
                  ? renderLeaf(child, depth)
                  : null,
            )}
          </div>
        ) : null}
      </div>
    );
  };

  const openItem = openIndex !== null ? items[openIndex] : null;

  return (
    <nav ref={navRef} className="wms-premium-nav" aria-label={t('sidebar.mainNavigation', { defaultValue: 'Ana menü' })}>
      <div ref={containerRef} className="wms-premium-nav__tabs wms-ops-scrollbar">
        {gliderStyle ? <span className="wms-premium-nav__glider" style={gliderStyle} aria-hidden /> : null}
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const isOpen = index === openIndex;
          const title = resolveTitle(item);

          if (!item.children?.length && item.href) {
            return (
              <Link
                key={getItemKey(item, index)}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                to={item.href}
                className={cn('wms-premium-nav__tab', isActive && 'wms-premium-nav__tab--active')}
                onClick={() => setOpenIndex(null)}
              >
                {item.icon ? <span className="wms-premium-nav__tab-icon">{item.icon}</span> : null}
                <span className="wms-premium-nav__tab-label">{title}</span>
              </Link>
            );
          }

          return (
            <button
              key={getItemKey(item, index)}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              aria-expanded={isOpen}
              className={cn(
                'wms-premium-nav__tab',
                isActive && 'wms-premium-nav__tab--active',
                isOpen && 'wms-premium-nav__tab--open',
              )}
              onClick={() => setOpenIndex((prev) => (prev === index ? null : index))}
            >
              {item.icon ? <span className="wms-premium-nav__tab-icon">{item.icon}</span> : null}
              <span className="wms-premium-nav__tab-label">{title}</span>
              <ChevronDown
                className={cn('wms-premium-nav__tab-chevron', isOpen && 'wms-premium-nav__tab-chevron--open')}
                strokeWidth={2.25}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {openItem?.children?.length ? (
        <div className="wms-premium-nav__panel" role="menu">
          <div className="wms-premium-nav__panel-inner wms-premium-nav__panel-scroll">
            <div className="wms-premium-nav__panel-grid">
              {openItem.children.map((child, childIndex) =>
                child.children?.length
                  ? renderGroupContent(child, 1, `root-${childIndex}`)
                  : child.href
                    ? (
                        <div key={getItemKey(child, childIndex)} className="wms-premium-nav__group">
                          <div className="wms-premium-nav__group-body">{renderLeaf(child, 1)}</div>
                        </div>
                      )
                    : null,
              )}
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
