import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';

export const formatNotificationTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays < 7) {
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: tr,
      });
    }

    return format(date, 'd MMMM yyyy, HH:mm', { locale: tr });
  } catch (error) {
    console.error('Error formatting date:', error);
    return timestamp;
  }
};

