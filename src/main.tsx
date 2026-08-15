import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { App } from './app/App';
import { AppErrorBoundary } from './app/AppErrorBoundary';
import { ThemeProvider } from './components/theme-provider';
import i18n, { ensureI18nReady } from './lib/i18n';
import { ensureApiReady } from './lib/axios';
import { installGlobalToastErrorNavigation } from './lib/toast-error-navigation';
import { installGlobalApiActionGuard } from './lib/api-action-guard';
import { useAuthStore } from './stores/auth-store';
import './index.css';
import './styles/shared-input.css';
import './styles/terminal-v2-bridge.css';
import './styles/premium-v2-bridge.css';
import './styles/goods-receipt-qc-summary-terminal.css';
import './styles/goods-receipt-qc-summary-premium.css';
import './styles/goods-receipt-task-modal.css';
import './styles/production-transfer-policy.css';
import './styles/operation-flow-tabs.css';
import './styles/ops-inline-note.css';
import './styles/ops-assignee-chip.css';
import './styles/ops-line-card.css';
import './styles/dashboard-command-center.css';
import './styles/dashboard-home.css';
import './styles/api-action-guard.css';

installGlobalToastErrorNavigation();
installGlobalApiActionGuard();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

async function bootstrap(): Promise<void> {
  try {
    await Promise.all([ensureI18nReady(), ensureApiReady()]);
  } catch (error) {
    console.error('Uygulama yapılandırması yüklenemedi.', error);
  }

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Kök eleman bulunamadı.');
  }

  // Start session restore without blocking first paint. A hung refresh/lock
  // used to leave the tab on a blank white screen forever.
  const sessionInit = useAuthStore.getState().init();

  createRoot(rootEl).render(
    <StrictMode>
      <AppErrorBoundary>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
              <App />
              <Toaster />
            </ThemeProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </AppErrorBoundary>
    </StrictMode>,
  );

  void sessionInit.catch((error) => {
    console.error('Oturum başlatılamadı.', error);
  });
}

void bootstrap();
