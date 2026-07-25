import { type MouseEvent, type ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import { useUIStore } from '@/stores/ui-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { preloadRoute } from '@/app/route-loaders';
import type { NavItem } from '../nav-items';
import {
  getItemKey,
  getToneByTitle,
  nodeHasActiveDescendant,
  nodeMatchesSearch,
  toneClassMap,
} from './sidebar-utils';
import {
  sidebarActiveDotClassName,
  sidebarActiveLeafClassName,
  sidebarActiveParentClassName,
  sidebarIconBoxClassName,
  sidebarItemHoverClassName,
  sidebarLabelClassName,
  sidebarLeafAccentClassName,
} from './sidebar-styles';

interface SidebarNavItemProps {
  item: NavItem;
  searchQuery: string;
  expandedItemKeys: string[];
  onToggle: (key: string) => void;
  resolveTitle: (item: NavItem) => string;
  level?: number;
}

function getLevelItemClassName(level: number, hasChildren: boolean): string {
  if (level === 0) {
    return 'px-2.5 py-2.5';
  }
  if (level === 1 && hasChildren) {
    return 'px-3 py-2.5 font-semibold text-slate-600 dark:text-slate-300';
  }
  if (level === 1) {
    return 'px-2 py-1.5';
  }
  if (level === 2) {
    return 'px-2 py-1.5';
  }
  return 'px-1.5 py-1';
}

function getLevelTextClassName(level: number, hasChildren: boolean): string {
  if (level === 0) {
    return 'text-sm font-semibold';
  }
  if (level === 1 && hasChildren) {
    return 'text-[11px] font-bold uppercase tracking-[0.12em]';
  }
  if (level === 1) {
    return 'text-[13px] font-medium';
  }
  if (level === 2) {
    return 'text-xs font-medium';
  }
  return 'text-xs font-normal text-slate-500 dark:text-slate-400';
}

function getChildrenContainerClassName(level: number): string {
  if (level === 0) {
    return 'ms-7 space-y-0.5 border-s border-[color-mix(in_oklab,var(--wms-brand-primary)_18%,transparent)] ps-2';
  }
  return 'ms-3 mt-1 space-y-0.5 border-s border-[color-mix(in_oklab,var(--wms-brand-primary)_22%,transparent)] ps-2';
}

function SidebarNavLabel({
  title,
  isSidebarOpen,
  level,
  hasChildren,
}: {
  title: string;
  isSidebarOpen: boolean;
  level: number;
  hasChildren: boolean;
}): ReactElement | null {
  if (!isSidebarOpen) {
    return null;
  }

  const label = (
    <span className={cn('flex-1 min-w-0', sidebarLabelClassName(isSidebarOpen))}>
      <span className={cn('block truncate leading-5', getLevelTextClassName(level, hasChildren))}>{title}</span>
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="max-w-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarNavItem({
  item,
  searchQuery,
  expandedItemKeys,
  onToggle,
  resolveTitle,
  level = 0,
}: SidebarNavItemProps): ReactElement {
  const location = useLocation();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isActive = item.href ? location.pathname === item.href : false;
  const hasActiveChild = item.children?.some((child) => nodeHasActiveDescendant(child, location.pathname)) ?? false;
  const itemKey = getItemKey(item, level);
  const title = resolveTitle(item);
  const searchMatched = nodeMatchesSearch(item, searchQuery, resolveTitle);
  const isExpanded = expandedItemKeys.includes(itemKey) || (Boolean(searchQuery.trim()) && hasChildren && searchMatched);
  const iconTone = getToneByTitle(item.title);
  const toneClasses = toneClassMap[iconTone];
  const isParentActive = hasActiveChild || isActive;
  const isSectionHeader = level === 1 && hasChildren;

  if (!searchMatched) {
    return <></>;
  }

  const handleIconClick = (e: MouseEvent): void => {
    if (!isSidebarOpen) {
      e.preventDefault();
      e.stopPropagation();
      setSidebarOpen(true);
      if (hasChildren) {
        onToggle(itemKey);
      }
    }
  };

  if (hasChildren) {
    return (
      <div className={cn('space-y-0.5', isSectionHeader && 'my-1 rounded-lg border border-[color-mix(in_oklab,var(--wms-brand-primary)_16%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-brand-primary)_4%,transparent)] p-1')}>
        <button
          type="button"
          onClick={() => {
            if (!isSidebarOpen) {
              setSidebarOpen(true);
              setTimeout(() => onToggle(itemKey), 80);
            } else {
              onToggle(itemKey);
            }
          }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-sm transition-colors duration-200',
            getLevelItemClassName(level, hasChildren),
            sidebarItemHoverClassName,
            !isSectionHeader && (isParentActive ? sidebarActiveParentClassName : 'text-slate-600 dark:text-slate-300'),
            isSectionHeader && (isParentActive ? 'bg-[color-mix(in_oklab,var(--wms-brand-primary)_10%,transparent)] text-[var(--wms-brand-primary)]' : ''),
            !isSidebarOpen && 'justify-center',
          )}
        >
          {item.icon && level === 0 ? (
            <span
              className={cn(
                sidebarIconBoxClassName(isParentActive, toneClasses.idle),
                '[&_svg]:h-5 [&_svg]:w-5',
                !isSidebarOpen && 'mx-auto',
              )}
              onClick={handleIconClick}
            >
              {item.icon}
            </span>
          ) : null}
          <SidebarNavLabel title={title} isSidebarOpen={isSidebarOpen} level={level} hasChildren={hasChildren} />
          {isSidebarOpen ? (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={13}
              strokeWidth={1.75}
              className={cn(
                'shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-500',
                isExpanded && 'rotate-90 rtl:-rotate-90',
              )}
            />
          ) : null}
        </button>
        {isExpanded && isSidebarOpen ? (
          <div className={getChildrenContainerClassName(level)}>
            {item.children?.map((child) => (
              <SidebarNavItem
                key={child.href || `${itemKey}:${child.title}`}
                item={child}
                searchQuery={searchQuery}
                expandedItemKeys={expandedItemKeys}
                onToggle={onToggle}
                resolveTitle={resolveTitle}
                level={level + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (!item.href) {
    return <></>;
  }

  return (
    <Link
      to={item.href}
      onMouseEnter={() => preloadRoute(item.href!)}
      onFocus={() => preloadRoute(item.href!)}
      onTouchStart={() => preloadRoute(item.href!)}
      className={cn(
        'flex items-center gap-2.5 rounded-sm transition-colors duration-200',
        getLevelItemClassName(level, false),
        sidebarItemHoverClassName,
        isActive ? sidebarActiveLeafClassName : 'text-slate-600 dark:text-slate-300',
        !isSidebarOpen && 'justify-center',
        isActive && level === 0 && item.icon ? sidebarLeafAccentClassName : '',
      )}
      onClick={(e) => {
        if (!isSidebarOpen) {
          e.preventDefault();
          setSidebarOpen(true);
        } else if (window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      }}
    >
      {item.icon && level === 0 ? (
        <span
          className={cn(
            sidebarIconBoxClassName(isActive, toneClasses.idle),
            '[&_svg]:h-5 [&_svg]:w-5',
            !isSidebarOpen && 'mx-auto',
          )}
          onClick={handleIconClick}
        >
          {item.icon}
        </span>
      ) : null}
      <SidebarNavLabel title={title} isSidebarOpen={isSidebarOpen} level={level} hasChildren={false} />
      {level > 0 && isActive && isSidebarOpen ? <span className={sidebarActiveDotClassName} /> : null}
    </Link>
  );
}
