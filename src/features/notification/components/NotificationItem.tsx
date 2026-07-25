import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from 'lucide-react';
import type { NotificationDto } from '../types/notification';
import { formatNotificationTime } from '../utils/date-utils';
import { notificationApi } from '../api/notification-api';
import { useNotificationStore } from '../stores/notification-store';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: NotificationDto;
}

export function NotificationItem({ notification }: NotificationItemProps): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { markAsRead: markAsReadStore, addMarkedAsReadId } = useNotificationStore();

  const getRouteForEntity = (entityType: string, entityId: number): string | null => {
    if (!entityType || !entityType.endsWith('Header')) {
      const routeMap: Record<string, string> = {
        Package: `/package/detail/${entityId}`,
        Shipment: `/shipment/collection/${entityId}`,
        GoodsReceipt: `/goods-receipt/collection/${entityId}`,
      };
      return routeMap[entityType] || null;
    }

    const prefix = entityType.replace('Header', '');

    const headerRouteMap: Record<string, { route: string; useCollection: boolean }> = {
      WT: { route: 'transfer', useCollection: true },
      GR: { route: 'goods-receipt', useCollection: true },
      SH: { route: 'shipment', useCollection: true },
      SIT: { route: 'subcontracting/issue', useCollection: true },
      SRT: { route: 'subcontracting/receipt', useCollection: true },
      WI: { route: 'warehouse/inbound', useCollection: false },
      WO: { route: 'warehouse/outbound', useCollection: false },
    };

    const routeConfig = headerRouteMap[prefix];
    if (routeConfig) {
      if (routeConfig.useCollection) {
        return `/${routeConfig.route}/collection/${entityId}`;
      }
      return `/${routeConfig.route}/assigned`;
    }

    return null;
  };

  const handleClick = async (): Promise<void> => {
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    } else if (notification.relatedEntityType && notification.relatedEntityId) {
      const route = getRouteForEntity(notification.relatedEntityType, notification.relatedEntityId);
      if (route) {
        navigate(route);
      }
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();

    if (notification.isRead) return;

    try {
      await notificationApi.markNotificationsAsReadBulk([notification.id]);
      markAsReadStore(notification.id);
      addMarkedAsReadId(notification.id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'wms-ops-notification-terminal__entry',
        !notification.isRead && 'wms-ops-notification-terminal__entry--unread',
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void handleClick();
        }
      }}
    >
      <div className="wms-ops-notification-terminal__entry-head">
        <span className="wms-ops-notification-terminal__tag">
          [{notification.isRead ? 'LOG' : 'NEW'}]
        </span>
        <h4 className="wms-ops-notification-terminal__entry-title">{notification.title}</h4>
      </div>
      <p className="wms-ops-notification-terminal__entry-message">{notification.message}</p>
      <div className="wms-ops-notification-terminal__entry-foot">
        <time className="wms-ops-notification-terminal__entry-time">
          {formatNotificationTime(notification.timestamp)}
        </time>
        {!notification.isRead ? (
          <button
            type="button"
            onClick={handleMarkAsRead}
            className="wms-ops-notification-terminal__mark-read"
          >
            <CheckIcon className="size-3" aria-hidden />
            {t('notification.markAsRead')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
