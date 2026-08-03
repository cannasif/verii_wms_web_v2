import { api, getApiBaseUrl } from '@/lib/axios';

interface Envelope<T> { success: boolean; data: T; message?: string }
const unwrap = <T,>(value: Envelope<T>): T => {
  if (!value.success) throw new Error(value.message || 'İşlem başarısız.');
  return value.data;
};

export interface StockImage {
  id: number;
  stockId: number;
  url: string;
  originalFileName: string;
  contentType: string;
  fileLength: number;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdDate?: string | null;
}

export const resolveStockImageUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  return `${getApiBaseUrl().replace(/\/$/, '')}/${value.replace(/^\//, '')}`;
};

export const stockImagesApi = {
  list: async (stockId: number): Promise<StockImage[]> =>
    unwrap(await api.get<Envelope<StockImage[]>>(`/api/stocks/${stockId}/images`)),
  upload: async (stockId: number, files: File[]): Promise<StockImage[]> => {
    const form = new FormData();
    files.forEach(file => { form.append('files', file); form.append('altTexts', ''); });
    return unwrap(await api.post<Envelope<StockImage[]>>(`/api/stocks/${stockId}/images`, form));
  },
  update: async (stockId: number, imageId: number, altText: string): Promise<StockImage> =>
    unwrap(await api.patch<Envelope<StockImage>>(`/api/stocks/${stockId}/images/${imageId}`, { altText })),
  setPrimary: async (stockId: number, imageId: number): Promise<StockImage> =>
    unwrap(await api.put<Envelope<StockImage>>(`/api/stocks/${stockId}/images/${imageId}/primary`)),
  reorder: async (stockId: number, imageIds: number[]): Promise<StockImage[]> =>
    unwrap(await api.put<Envelope<StockImage[]>>(`/api/stocks/${stockId}/images/order`, { imageIds })),
  remove: async (stockId: number, imageId: number): Promise<void> => {
    await api.delete(`/api/stocks/${stockId}/images/${imageId}`);
  },
};
