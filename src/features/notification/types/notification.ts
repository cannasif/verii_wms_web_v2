import type { ApiResponse, PagedResponse, PagedParams } from '@/types/api';

export type NotificationChannel = 'Terminal' | 'Web';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface NotificationDto {
  id: number;
  title: string;
  message: string;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  isRead: boolean;
  readDate: string | null;
  timestamp: string;
  recipientUserId: number | null;
  recipientTerminalUserId: number | null;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  actionUrl: string | null;
  terminalActionCode: string | null;
}

export interface SignalRNotificationPayload {
  id: number;
  title: string;
  message: string;
  type: NotificationSeverity;
  timestamp: string;
  channel: NotificationChannel;
  recipientUserId?: number;
  recipientTerminalUserId?: number;
}

export type NotificationResponse = ApiResponse<NotificationDto>;
export type NotificationsResponse = ApiResponse<NotificationDto[]>;
export type PagedNotificationsResponse = ApiResponse<PagedResponse<NotificationDto>>;

export interface CreateNotificationRequest {
  title: string;
  message: string;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  recipientUserId?: number;
  recipientTerminalUserId?: number;
  relatedEntityType?: string;
  relatedEntityId?: number;
  actionUrl?: string;
  terminalActionCode?: string;
}

export interface GetPagedNotificationsRequest extends PagedParams {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

