import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { AppDropdown, type AppDropdownOption, type AppDropdownProps } from './AppDropdown';
import {
  useDropdownInfiniteSearch,
  type DropdownPage,
  type DropdownPageRequest,
} from '@/hooks/useDropdownInfiniteSearch';

type UiProps<TValue extends string> = Omit<
  AppDropdownProps<TValue>,
  | 'options'
  | 'searchApi'
  | 'onSearchChange'
  | 'onFetchNextPage'
  | 'hasNextPage'
  | 'isLoading'
  | 'isFetchingNextPage'
  | 'errorText'
  | 'onRetry'
>;

export interface PagedAppDropdownProps<TItem, TValue extends string = string> extends UiProps<TValue> {
  queryKey: string | readonly unknown[];
  fetchPage: (request: DropdownPageRequest) => Promise<DropdownPage<TItem>>;
  toOption: (item: TItem) => AppDropdownOption<TValue>;
  staticOptions?: readonly AppDropdownOption<TValue>[];
  selectedOption?: AppDropdownOption<TValue>;
  enabled?: boolean;
  pageSize?: number;
  minSearchLength?: number;
  /** API genel aramasına yalnızca kullanıcıya gösterilen lookup alanları gönderilir. */
  searchFields?: readonly string[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  dependencies?: readonly unknown[];
}

export function PagedAppDropdown<TItem, TValue extends string = string>({
  queryKey,
  fetchPage,
  toOption,
  staticOptions = [],
  selectedOption,
  enabled = true,
  pageSize = 20,
  minSearchLength = 1,
  searchFields = [],
  sortBy,
  sortDirection = 'asc',
  dependencies,
  searchable = true,
  emptyText,
  ...dropdownProps
}: PagedAppDropdownProps<TItem, TValue>): ReactElement {
  const { t } = useTranslation('shared');
  const [searchTerm, setSearchTerm] = useState('');
  const query = useDropdownInfiniteSearch({
    queryKey,
    searchTerm,
    fetchPage,
    enabled,
    pageSize,
    minSearchLength,
    searchFields,
    sortBy,
    sortDirection,
    dependencies,
  });

  const options = useMemo(() => {
    const mapped = [...staticOptions, ...query.items.map(toOption)];
    if (selectedOption && !mapped.some((option) => option.value === selectedOption.value)) {
      mapped.unshift(selectedOption);
    }
    return [...new Map(mapped.map((option) => [option.value, option])).values()];
  }, [query.items, selectedOption, staticOptions, toOption]);

  const thresholdText = query.isThresholdMode
    ? t('dropdown.minSearchCharacters', { count: minSearchLength })
    : emptyText;

  return (
    <AppDropdown
      {...dropdownProps}
      options={options}
      searchable={searchable}
      searchApi
      onSearchChange={setSearchTerm}
      onFetchNextPage={query.fetchNextPage}
      hasNextPage={query.hasNextPage}
      isLoading={query.isLoading}
      isFetchingNextPage={query.isFetchingNextPage}
      emptyText={thresholdText}
      errorText={query.isError ? (query.error instanceof Error ? query.error.message : t('dropdown.loadError')) : undefined}
      onRetry={query.refetch}
    />
  );
}
