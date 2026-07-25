import { type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import Notification01Icon from '@hugeicons/core-free-icons/Notification01Icon';
import { Button } from '@/components/ui/button';
import { NavbarGradientIcon } from '@/components/shared/NavbarGradientIcon';
import { navbarIconButtonClassName } from '@/components/shared/navbar-gradient-icon.styles';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '../stores/notification-store';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationIcon(): ReactElement {
  const { t } = useTranslation();
  const { unreadCount } = useNotificationStore();
  const hasUnread = unreadCount > 0;

  return (
    <NotificationDropdown
      children={
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            navbarIconButtonClassName,
            'relative size-10 hover:!bg-sky-400/[0.06] dark:hover:!bg-cyan-400/[0.08] hover:!text-slate-500 dark:hover:!text-slate-400',
          )}
          aria-label={`${t('notification.notifications')}${hasUnread ? ` (${unreadCount} ${t('notification.new')})` : ''}`}
        >
          <NavbarGradientIcon icon={Notification01Icon} size={22} />
          {hasUnread && (
            <span className="absolute right-2 top-2 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EC4899] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#EC4899]" />
            </span>
          )}
        </Button>
      }
    />
  );
}
