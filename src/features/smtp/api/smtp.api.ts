import { api } from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T; message?: string };
const unwrap = <T>(response: Envelope<T>): T => {
  if (!response.success) throw new Error(response.message || 'İşlem başarısız.');
  return response.data;
};

export interface SmtpSettings { id?: number; host: string; port: number; enableSsl: boolean; username: string; fromEmail: string; fromName: string; timeout: number; hasPassword?: boolean }
export interface UpdateSmtpSettings extends Omit<SmtpSettings, 'id' | 'hasPassword'> { password?: string }

export const smtpApi = {
  getSmtp: async () => unwrap(await api.get<Envelope<Partial<SmtpSettings>>>('/api/smtp-settings')),
  updateSmtp: async (request: UpdateSmtpSettings) => unwrap(await api.put<Envelope<SmtpSettings>>('/api/smtp-settings', request)),
  testSmtp: async (to: string) => unwrap(await api.post<Envelope<boolean>>('/api/smtp-settings/test', { to })),
};
