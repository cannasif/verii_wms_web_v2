import type { NavItem } from '../nav-items';

const iconTones = [
  'blue',
  'orange',
  'emerald',
  'pink',
  'amber',
  'cyan',
  'indigo',
  'violet',
] as const;

export type IconTone = (typeof iconTones)[number];

export const toneClassMap: Record<IconTone, { idle: string; active: string }> = {
  blue: {
    idle: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    active: 'bg-blue-200 text-blue-800 dark:bg-blue-500/30 dark:text-blue-200',
  },
  orange: {
    idle: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    active: 'bg-orange-200 text-orange-800 dark:bg-orange-500/30 dark:text-orange-200',
  },
  emerald: {
    idle: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    active: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-200',
  },
  pink: {
    idle: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
    active: 'bg-pink-200 text-pink-800 dark:bg-pink-500/30 dark:text-pink-200',
  },
  amber: {
    idle: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    active: 'bg-amber-200 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200',
  },
  cyan: {
    idle: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    active: 'bg-cyan-200 text-cyan-800 dark:bg-cyan-500/30 dark:text-cyan-200',
  },
  indigo: {
    idle: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
    active: 'bg-indigo-200 text-indigo-800 dark:bg-indigo-500/30 dark:text-indigo-200',
  },
  violet: {
    idle: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    active: 'bg-violet-200 text-violet-800 dark:bg-violet-500/30 dark:text-violet-200',
  },
};

export const getToneByTitle = (title: string): IconTone => {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return iconTones[hash % iconTones.length];
};

export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c');
};

export function matchesQuery(title: string, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;

  const normalizedQuery = normalizeText(searchQuery);
  const queryWords = normalizedQuery.split(/\s+/).filter((word) => word.length > 0);
  if (queryWords.length === 0) return true;

  const normalizedTitle = normalizeText(title);
  const titleWords = normalizedTitle.split(/\s+/).filter((word) => word.length > 0);

  return queryWords.every((queryWord) => titleWords.some((titleWord) => titleWord.includes(queryWord)));
}

export function nodeMatchesSearch(node: NavItem, searchQuery: string, resolveTitle: (item: NavItem) => string): boolean {
  if (matchesQuery(resolveTitle(node), searchQuery)) {
    return true;
  }

  return node.children?.some((child) => nodeMatchesSearch(child, searchQuery, resolveTitle)) ?? false;
}

export function nodeHasActiveDescendant(node: NavItem, pathname: string): boolean {
  if (node.href && pathname === node.href) {
    return true;
  }

  return node.children?.some((child) => nodeHasActiveDescendant(child, pathname)) ?? false;
}

export function collectActiveAncestorKeys(nodes: NavItem[], pathname: string, level = 0): string[] {
  for (const node of nodes) {
    const itemKey = getItemKey(node, level);
    if (node.href && node.href === pathname) {
      return [];
    }

    if (node.children?.length) {
      const childKeys = collectActiveAncestorKeys(node.children, pathname, level + 1);
      if (childKeys.length > 0 || node.children.some((child) => nodeHasActiveDescendant(child, pathname))) {
        return [itemKey, ...childKeys];
      }
    }
  }

  return [];
}

export function getItemKey(item: NavItem, level: number): string {
  return item.href || `${level}:${item.title}`;
}

interface NavIndexEntry {
  key: string;
  level: number;
  parentKey: string | null;
  topLevelKey: string;
  hasChildren: boolean;
}

export function buildNavIndex(
  nodes: NavItem[],
  level = 0,
  parentKey: string | null = null,
  topLevelKey: string | null = null,
  map = new Map<string, NavIndexEntry>(),
): Map<string, NavIndexEntry> {
  for (const node of nodes) {
    const key = getItemKey(node, level);
    const top = level === 0 ? key : topLevelKey!;
    map.set(key, {
      key,
      level,
      parentKey,
      topLevelKey: top,
      hasChildren: Boolean(node.children?.length),
    });
    if (node.children?.length) {
      buildNavIndex(node.children, level + 1, key, top, map);
    }
  }
  return map;
}

function isDescendantKey(key: string, ancestorKey: string, index: Map<string, NavIndexEntry>): boolean {
  let current = index.get(key);
  while (current) {
    if (current.key === ancestorKey) {
      return true;
    }
    if (!current.parentKey) {
      return false;
    }
    current = index.get(current.parentKey);
  }
  return false;
}

export function collectSubtreeExpandKeys(rootKey: string, index: Map<string, NavIndexEntry>): string[] {
  const keys: string[] = [];
  for (const [key] of index) {
    if (key === rootKey || isDescendantKey(key, rootKey, index)) {
      keys.push(key);
    }
  }
  return keys;
}

export function resolveExpandedKeysAfterToggle(
  prev: string[],
  toggledKey: string,
  items: NavItem[],
  pathname: string,
  collapsedByUser: ReadonlySet<string> = new Set(),
): string[] {
  const index = buildNavIndex(items);
  const toggled = index.get(toggledKey);
  if (!toggled) {
    return prev;
  }

  const activeAncestors = collectActiveAncestorKeys(items, pathname);

  if (prev.includes(toggledKey)) {
    const toRemove = new Set(collectSubtreeExpandKeys(toggledKey, index));
    return prev.filter((key) => !toRemove.has(key));
  }

  const next = prev.filter((key) => {
    if (key === toggledKey) {
      return true;
    }
    if (activeAncestors.includes(key) && !collapsedByUser.has(key)) {
      return true;
    }

    const entry = index.get(key);
    if (!entry) {
      return false;
    }

    if (entry.topLevelKey !== toggled.topLevelKey) {
      return false;
    }

    if (entry.parentKey === toggled.parentKey && entry.hasChildren && key !== toggledKey) {
      return false;
    }

    return true;
  });

  return Array.from(new Set([...next, toggledKey]));
}
