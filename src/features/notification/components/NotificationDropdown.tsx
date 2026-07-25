import { type ReactElement, useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificationStore } from '../stores/notification-store';
import { notificationApi } from '../api/notification-api';
import { NotificationItem } from './NotificationItem';
import { debounce } from '@/lib/utils/debounce';

interface NotificationDropdownProps {
  children: ReactElement;
}

export function NotificationDropdown({ children }: NotificationDropdownProps): ReactElement {
  const { t, i18n } = useTranslation();
  const {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasNextPage,
    currentPage,
    isMarkingAsRead,
    setLoading,
    setLoadingMore,
    setNotifications,
    appendNotifications,
    setPaginationState,
    markAllAsRead: markAllAsReadStore,
    setUnreadCount,
    clearNotifications,
  } = useNotificationStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentLanguageRef = useRef(i18n.language);
  const hasLoadedForOpenRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const loadInitialNotifications = useCallback(async (): Promise<void> => {
    if (hasLoadedForOpenRef.current) return;

    hasLoadedForOpenRef.current = true;
    setLoading(true);

    try {
      const response = await notificationApi.getPagedNotifications({
        pageNumber: 1,
        pageSize: 10,
        sortBy: 'Id',
        sortDirection: 'desc',
      });

      setNotifications(response.data);
      setPaginationState(1, response.totalPages, response.hasNextPage);
      setUnreadCount(response.totalCount);
    } catch {
      hasLoadedForOpenRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setNotifications, setPaginationState, setUnreadCount]);

  const loadMoreNotifications = useCallback(async (): Promise<void> => {
    if (!hasNextPage || isLoadingMore || isLoading) return;

    setLoadingMore(true);

    try {
      const nextPage = currentPage + 1;
      const response = await notificationApi.getPagedNotifications({
        pageNumber: nextPage,
        pageSize: 10,
        sortBy: 'Id',
        sortDirection: 'desc',
      });

      appendNotifications(response.data);
      setPaginationState(nextPage, response.totalPages, response.hasNextPage);
    } catch {
      // Pagination failures should not break the dropdown UI.
    } finally {
      setLoadingMore(false);
    }
  }, [hasNextPage, isLoadingMore, isLoading, currentPage, setLoadingMore, appendNotifications, setPaginationState]);

  const handleScroll = useCallback((): void => {
    if (!scrollContainerRef.current || isLoadingMore || isLoading) return;

    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const threshold = 200;

    if (scrollHeight - scrollTop - clientHeight < threshold && hasNextPage) {
      loadMoreNotifications();
    }
  }, [isLoadingMore, isLoading, hasNextPage, loadMoreNotifications]);

  const debouncedScrollHandlerRef = useRef<((...args: unknown[]) => void) | undefined>(undefined);

  useEffect(() => {
    debouncedScrollHandlerRef.current = debounce(handleScroll, 300);
    return () => {
      debouncedScrollHandlerRef.current = undefined;
    };
  }, [handleScroll]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen) return;

    const handler = debouncedScrollHandlerRef.current;
    if (!handler) return;

    container.addEventListener('scroll', handler);
    return () => {
      container.removeEventListener('scroll', handler);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isLoading) {
      loadInitialNotifications();
    }
  }, [isOpen, isLoading, loadInitialNotifications]);

  useEffect(() => {
    if (currentLanguageRef.current !== i18n.language) {
      currentLanguageRef.current = i18n.language;
      hasLoadedForOpenRef.current = false;
      clearNotifications();
      if (isOpen) {
        loadInitialNotifications();
      }
    }
  }, [i18n.language, isOpen, loadInitialNotifications, clearNotifications]);

  const handleOpenChange = (open: boolean): void => {
    setIsOpen(open);

    if (open) {
      hasLoadedForOpenRef.current = false;
      return;
    }

    hasLoadedForOpenRef.current = false;
  };

  const handleMarkAllAsRead = async (): Promise<void> => {
    if (unreadCount === 0) return;

    try {
      await notificationApi.markAllAsRead();
      markAllAsReadStore();
    } catch {
      // Mark-all failures are surfaced by the underlying store refresh path.
    }
  };

  const hasUnread = unreadCount > 0;

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="wms-ops-notification-terminal w-80 p-0" sideOffset={8}>
        <div className="wms-ops-notification-terminal__header">
          <div className="wms-ops-notification-terminal__title-row">
            <span className="wms-ops-notification-terminal__prompt" aria-hidden>
              {'> '}
            </span>
            <span className="wms-ops-notification-terminal__title">{t('notification.title')}</span>
            {hasUnread ? (
              <span className="wms-ops-notification-terminal__badge">
                [{unreadCount} {t('notification.unreadCount')}]
              </span>
            ) : null}
          </div>
          {hasUnread ? (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="wms-ops-notification-terminal__mark-all"
              disabled={isMarkingAsRead}
            >
              {t('notification.markAllAsRead')}
            </button>
          ) : null}
        </div>

        <div
          ref={scrollContainerRef}
          className="wms-ops-notification-terminal__body wms-ops-scrollbar max-h-[400px] overflow-y-auto"
        >
          {isLoading ? (
            <p className="wms-ops-notification-terminal__log-line wms-ops-notification-terminal__log-line--dim">
              <span className="wms-ops-notification-terminal__tag">[SYS]</span>
              {t('notification.loading')}
              <span className="wms-ops-notification-terminal__cursor" aria-hidden>
                _
              </span>
            </p>
          ) : notifications.length === 0 ? (
            <p className="wms-ops-notification-terminal__log-line wms-ops-notification-terminal__log-line--empty">
              <span className="wms-ops-notification-terminal__tag">[SYS]</span>
              {t('notification.terminal.noEntries', { defaultValue: t('notification.noNotifications') })}
            </p>
          ) : (
            <div className="wms-ops-notification-terminal__list">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
              {isLoadingMore ? (
                <p className="wms-ops-notification-terminal__log-line wms-ops-notification-terminal__log-line--dim">
                  <span className="wms-ops-notification-terminal__tag">[SYS]</span>
                  {t('notification.loading')}
                </p>
              ) : null}
              {!hasNextPage && notifications.length > 0 ? (
                <p className="wms-ops-notification-terminal__log-line wms-ops-notification-terminal__log-line--dim">
                  <span className="wms-ops-notification-terminal__tag">[EOF]</span>
                  {t('notification.noMoreNotifications')}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
