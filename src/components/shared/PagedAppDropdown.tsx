import { useEffect, useMemo, useState, type ReactElement } from 'react';
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
  value,
  onValueChange,
  ...dropdownProps
}: PagedAppDropdownProps<TItem, TValue>): ReactElement {
  const { t } = useTranslation('shared');
  const [inputSearchTerm, setInputSearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [rememberedSelected, setRememberedSelected] = useState<AppDropdownOption<TValue> | undefined>();
  const query = useDropdownInfiniteSearch({
    queryKey,
    inputSearchTerm,
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

  useEffect(() => {
    if (selectedOption) {
      setRememberedSelected(selectedOption);
      return;
    }
    if (value == null || value === '') {
      setRememberedSelected(undefined);
    }
  }, [selectedOption, value]);

  const resolvedSelected = selectedOption
    ?? (rememberedSelected && rememberedSelected.value === value ? rememberedSelected : undefined);

  const options = useMemo(() => {
    const mapped = [...staticOptions, ...query.items.map(toOption)];
    if (resolvedSelected && !mapped.some((option) => option.value === resolvedSelected.value)) {
      mapped.unshift(resolvedSelected);
    }
    return [...new Map(mapped.map((option) => [option.value, option])).values()];
  }, [query.items, resolvedSelected, staticOptions, toOption]);

  const thresholdText = query.isThresholdMode
    ? t('dropdown.minSearchCharacters', { count: minSearchLength })
    : emptyText;

  return (
    <AppDropdown
      {...dropdownProps}
      value={value}
      onValueChange={(next) => {
        const matched = options.find((option) => option.value === next);
        if (matched) setRememberedSelected(matched);
        else if (next == null || next === '') setRememberedSelected(undefined);
        onValueChange(next);
      }}
      options={options}
      searchable={searchable}
      searchApi
      onSearchInputChange={setInputSearchTerm}
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
