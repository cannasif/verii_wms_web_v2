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
import { stockBalancesApi } from '../api/stock-balances.api';
import type {
  LocationInventoryLookup,
  LotInventoryLookup,
  SerialInventoryLookup,
  WarehouseInventoryLookup,
} from '../types/stock-balance.types';
import {
  LocationInventoryDialog,
  LotInventoryDialog,
  SerialInventoryDialog,
  WarehouseInventoryDialog,
} from './InventoryLookupDialogs';

type InventoryLookupContextValue = {
  openWarehouse: (warehouseId: number) => Promise<void>;
  openLocation: (locationId: number) => Promise<void>;
  openSerial: (serialBalanceId: number) => Promise<void>;
  openLot: (lotNo: string) => Promise<void>;
};

const InventoryLookupContext = createContext<InventoryLookupContextValue | null>(null);

export function InventoryLookupProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [opening, setOpening] = useState(false);
  const [warehouse, setWarehouse] = useState<WarehouseInventoryLookup | null>(null);
  const [location, setLocation] = useState<LocationInventoryLookup | null>(null);
  const [serial, setSerial] = useState<SerialInventoryLookup | null>(null);
  const [lot, setLot] = useState<LotInventoryLookup | null>(null);

  const run = useCallback(async (work: () => Promise<void>) => {
    if (opening) return;
    setOpening(true);
    const toastId = toast.loading(t('navbar.inventoryLookup.opening'));
    try {
      await work();
      toast.dismiss(toastId);
    } catch {
      toast.error(t('navbar.inventoryLookup.notFound'), { id: toastId });
    } finally {
      setOpening(false);
    }
  }, [opening, t]);

  const openWarehouse = useCallback(async (warehouseId: number) => {
    if (warehouseId <= 0) return;
    await run(async () => {
      setLocation(null);
      setSerial(null);
      setLot(null);
      setWarehouse(await stockBalancesApi.getWarehouseInventory(warehouseId));
    });
  }, [run]);

  const openLocation = useCallback(async (locationId: number) => {
    if (locationId <= 0) return;
    await run(async () => {
      setWarehouse(null);
      setSerial(null);
      setLot(null);
      setLocation(await stockBalancesApi.getLocationInventory(locationId));
    });
  }, [run]);

  const openSerial = useCallback(async (serialBalanceId: number) => {
    if (serialBalanceId <= 0) return;
    await run(async () => {
      setWarehouse(null);
      setLocation(null);
      setLot(null);
      setSerial(await stockBalancesApi.getSerialInventory(serialBalanceId));
    });
  }, [run]);

  const openLot = useCallback(async (lotNo: string) => {
    const term = lotNo.trim();
    if (!term) return;
    await run(async () => {
      setWarehouse(null);
      setLocation(null);
      setSerial(null);
      setLot(await stockBalancesApi.getLotInventory(term));
    });
  }, [run]);

  const value = useMemo(
    () => ({ openWarehouse, openLocation, openSerial, openLot }),
    [openLocation, openLot, openSerial, openWarehouse],
  );

  return (
    <InventoryLookupContext.Provider value={value}>
      {children}
      <WarehouseInventoryDialog value={warehouse} onClose={() => setWarehouse(null)} />
      <LocationInventoryDialog value={location} onClose={() => setLocation(null)} />
      <SerialInventoryDialog value={serial} onClose={() => setSerial(null)} />
      <LotInventoryDialog value={lot} onClose={() => setLot(null)} />
    </InventoryLookupContext.Provider>
  );
}

export function useOptionalInventoryLookup(): InventoryLookupContextValue | null {
  return useContext(InventoryLookupContext);
}
