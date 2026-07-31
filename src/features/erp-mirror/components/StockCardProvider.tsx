import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { StockTrackingSettingsDialog } from './StockTrackingSettingsDialog';
import {
  resolveStockMirror,
  type StockIdentityRef,
} from '../resolve-stock-mirror';
import type { StockMirror } from '../types/erp-mirror.types';

type StockCardContextValue = {
  openStockCard: (ref: StockIdentityRef) => Promise<void>;
};

const StockCardContext = createContext<StockCardContextValue | null>(null);

export function StockCardProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [stock, setStock] = useState<StockMirror | null>(null);
  const [opening, setOpening] = useState(false);

  const openStockCard = useCallback(async (ref: StockIdentityRef) => {
    if (opening) return;
    const hasId = typeof ref.stockId === 'number' && ref.stockId > 0;
    const hasCode = Boolean(ref.stockCode?.trim());
    if (!hasId && !hasCode) {
      toast.error(t('stockCard.openMissingIdentity'));
      return;
    }

    setOpening(true);
    const toastId = toast.loading(t('stockCard.opening'));
    try {
      const resolved = await resolveStockMirror(ref);
      setStock(resolved);
      toast.dismiss(toastId);
    } catch {
      toast.error(t('stockCard.notFound'), { id: toastId });
    } finally {
      setOpening(false);
    }
  }, [opening, t]);

  const value = useMemo(() => ({ openStockCard }), [openStockCard]);

  return (
    <StockCardContext.Provider value={value}>
      {children}
      <StockTrackingSettingsDialog
        stock={stock}
        initialTab="details"
        onClose={() => setStock(null)}
      />
    </StockCardContext.Provider>
  );
}

export function useStockCard(): StockCardContextValue {
  const ctx = useContext(StockCardContext);
  if (!ctx) {
    throw new Error('useStockCard must be used within StockCardProvider');
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. login routes). */
export function useOptionalStockCard(): StockCardContextValue | null {
  return useContext(StockCardContext);
}
