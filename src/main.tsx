import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './app/App';
import { ThemeProvider } from './components/theme-provider';
import i18n, { ensureI18nReady } from './lib/i18n';
import { ensureApiReady } from './lib/axios';
import { useAuthStore } from './stores/auth-store';
import './index.css';
import './styles/shared-input.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

async function bootstrap(): Promise<void> {
  await Promise.all([ensureI18nReady(), ensureApiReady()]);
  await useAuthStore.getState().init();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            <App />
            <Toaster position="top-right" richColors closeButton className="wms-ops-toaster" />
          </ThemeProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}

void bootstrap();
