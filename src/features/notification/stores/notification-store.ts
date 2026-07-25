import { create } from 'zustand';
import type { NotificationDto } from '../types/notification';

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface NotificationState {
  notifications: NotificationDto[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  connectionState: ConnectionState;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  markedAsReadIds: Set<number>;
  isMarkingAsRead: boolean;
  setNotifications: (notifications: NotificationDto[]) => void;
  appendNotifications: (notifications: NotificationDto[]) => void;
  addNotification: (notification: NotificationDto) => void;
  markAsRead: (id: number) => void;
  markAsReadBulk: (ids: number[]) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setPaginationState: (page: number, totalPages: number, hasNext: boolean) => void;
  setUnreadCount: (count: number) => void;
  addMarkedAsReadId: (id: number) => void;
  addMarkedAsReadIds: (ids: number[]) => void;
  removeMarkedAsReadIds: (ids: number[]) => void;
  setMarkingAsRead: (marking: boolean) => void;
}


export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isLoadingMore: false,
  connectionState: 'disconnected',
  currentPage: 1,
  totalPages: 0,
  hasNextPage: false,
  markedAsReadIds: new Set<number>(),
  isMarkingAsRead: false,

  setNotifications: (notifications) => {
    set({ notifications });
  },

  appendNotifications: (notifications) => {
    const currentNotifications = get().notifications;
    const existingIds = new Set(currentNotifications.map((n) => n.id));
    const newNotifications = notifications.filter((n) => !existingIds.has(n.id));
    const updatedNotifications = [...currentNotifications, ...newNotifications];
    set({ notifications: updatedNotifications });
  },

  addNotification: (notification) => {
    const currentNotifications = get().notifications;
    const exists = currentNotifications.some((n) => n.id === notification.id);
    
    if (!exists) {
      const updatedNotifications = [notification, ...currentNotifications];
      const currentUnreadCount = get().unreadCount;
      set({
        notifications: updatedNotifications,
        unreadCount: notification.isRead ? currentUnreadCount : currentUnreadCount + 1,
      });
    }
  },

  markAsRead: (id) => {
    const currentNotifications = get().notifications;
    const notification = currentNotifications.find((n) => n.id === id);
    const updatedNotifications = currentNotifications.map((n) =>
      n.id === id ? { ...n, isRead: true, readDate: new Date().toISOString() } : n
    );
    const currentUnreadCount = get().unreadCount;
    set({
      notifications: updatedNotifications,
      unreadCount: notification && !notification.isRead ? Math.max(0, currentUnreadCount - 1) : currentUnreadCount,
    });
  },

  markAsReadBulk: (ids) => {
    const currentNotifications = get().notifications;
    const idSet = new Set(ids);
    const unreadCountToDecrease = currentNotifications.filter((n) => idSet.has(n.id) && !n.isRead).length;
    const updatedNotifications = currentNotifications.map((n) =>
      idSet.has(n.id) ? { ...n, isRead: true, readDate: n.readDate || new Date().toISOString() } : n
    );
    const currentUnreadCount = get().unreadCount;
    set({
      notifications: updatedNotifications,
      unreadCount: Math.max(0, currentUnreadCount - unreadCountToDecrease),
    });
  },

  markAllAsRead: () => {
    const currentNotifications = get().notifications;
    const updatedNotifications = currentNotifications.map((n) => ({
      ...n,
      isRead: true,
      readDate: n.readDate || new Date().toISOString(),
    }));
    set({
      notifications: updatedNotifications,
      unreadCount: 0,
    });
  },

  clearNotifications: () => {
    set({
      notifications: [],
      unreadCount: 0,
      currentPage: 1,
      totalPages: 0,
      hasNextPage: false,
      markedAsReadIds: new Set<number>(),
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setLoadingMore: (loading) => {
    set({ isLoadingMore: loading });
  },

  setConnectionState: (state) => {
    set({ connectionState: state });
  },

  setPaginationState: (page, totalPages, hasNext) => {
    set({
      currentPage: page,
      totalPages,
      hasNextPage: hasNext,
    });
  },

  setUnreadCount: (count) => {
    set({ unreadCount: count });
  },

  addMarkedAsReadId: (id) => {
    const currentIds = get().markedAsReadIds;
    const updatedIds = new Set(currentIds);
    updatedIds.add(id);
    set({ markedAsReadIds: updatedIds });
  },

  addMarkedAsReadIds: (ids) => {
    const currentIds = get().markedAsReadIds;
    const updatedIds = new Set(currentIds);
    ids.forEach((id) => updatedIds.add(id));
    set({ markedAsReadIds: updatedIds });
  },

  removeMarkedAsReadIds: (ids) => {
    const currentIds = get().markedAsReadIds;
    const updatedIds = new Set(currentIds);
    ids.forEach((id) => updatedIds.delete(id));
    set({ markedAsReadIds: updatedIds });
  },

  setMarkingAsRead: (marking) => {
    set({ isMarkingAsRead: marking });
  },
}));

