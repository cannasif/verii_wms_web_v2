import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types/api';
import type {
  WarehouseAssistantCapabilities,
  WarehouseAssistantChatResponse,
  WarehouseAssistantConversationRow,
  WarehouseAssistantMessageRow,
} from '../types/warehouse-assistant.types';

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data == null) {
    throw new Error(response.message || 'Depo asistanı isteği tamamlanamadı.');
  }
  return response.data;
}

export const warehouseAssistantApi = {
  async getCapabilities(): Promise<WarehouseAssistantCapabilities> {
    return unwrap(await api.get<ApiResponse<WarehouseAssistantCapabilities>>('/api/warehouse-assistant/capabilities'));
  },

  async getConversations(): Promise<WarehouseAssistantConversationRow[]> {
    return unwrap(await api.get<ApiResponse<WarehouseAssistantConversationRow[]>>('/api/warehouse-assistant/conversations'));
  },

  async getMessages(conversationId: number): Promise<WarehouseAssistantMessageRow[]> {
    return unwrap(await api.get<ApiResponse<WarehouseAssistantMessageRow[]>>(
      `/api/warehouse-assistant/conversations/${conversationId}/messages`,
    ));
  },

  async ask(message: string, conversationId?: number | null): Promise<WarehouseAssistantChatResponse> {
    return unwrap(await api.post<ApiResponse<WarehouseAssistantChatResponse>>('/api/warehouse-assistant/chat', {
      conversationId: conversationId ?? null,
      message,
    }));
  },
};
