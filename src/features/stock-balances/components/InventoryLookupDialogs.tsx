import { type ReactElement, type ReactNode } from 'react';
import { Boxes, Hash, MapPin, Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from '@/components/shared/OpsDialogShell';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { localizeEnumValue } from '@/lib/enum-localization';
import { formatProjectNumber } from '@/lib/project-format';
import type {
  LocationBalanceRow,
  LocationInventoryLookup,
  LotInventoryLookup,
  SerialInventoryLookup,
  WarehouseInventoryLookup,
} from '../types/stock-balance.types';

const L = 'navbar.inventoryLookup';
const W = 'dataGrid.warehouseBalances';
const H = 'dataGrid.serialMovementHistory';

function qty(value: number): string {
  return formatProjectNumber(value);
}

function SummaryCard({ label, value }: { label: string; value: string | number }): ReactElement {
  return (
    <div className="border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold text-[var(--wms-app-text)]">{value}</p>
    </div>
  );
}

function BalanceTable({ rows, truncated }: { rows: LocationBalanceRow[]; truncated: boolean }): ReactElement {
  const { t } = useTranslation('common');
  return (
    <div className="overflow-x-auto border border-[var(--wms-app-border)]">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] text-left">
            <th className="p-2.5">{t(`${W}.stockCode`)}</th>
            <th className="p-2.5">{t(`${W}.locationLabel`)}</th>
            <th className="p-2.5">{t(`${W}.yapLotSerial`)}</th>
            <th className="p-2.5">{t(`${W}.stockStatus`)}</th>
            <th className="p-2.5 text-right">{t(`${W}.quantity`)}</th>
            <th className="p-2.5 text-right">{t(`${W}.reservedQuantity`)}</th>
            <th className="p-2.5 text-right">{t(`${W}.availableQuantity`)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="p-4 text-[var(--wms-app-text-muted)]" colSpan={7}>{t(`${L}.emptyLines`)}</td>
            </tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-t border-[var(--wms-app-border)]">
              <td className="p-2.5">
                <strong className="font-mono">{row.stockCode}</strong>
                <small className="mt-0.5 block text-[var(--wms-app-text-muted)]">{row.stockName}</small>
              </td>
              <td className="p-2.5">
                <strong>{row.locationCode}</strong>
                <small className="mt-0.5 block text-[var(--wms-app-text-muted)]">{row.locationName}</small>
              </td>
              <td className="p-2.5">{row.yapCode || '—'} / {row.lotNo || '—'} / {row.serialNo || '—'}</td>
              <td className="p-2.5">{localizeEnumValue(row.stockStatus)}</td>
              <td className="p-2.5 text-right font-mono">{qty(row.quantity)} {row.unitCode}</td>
              <td className="p-2.5 text-right font-mono">{qty(row.reservedQuantity)}</td>
              <td className="p-2.5 text-right font-mono">{qty(row.availableQuantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {truncated ? <p className="px-3 py-2 text-xs text-[var(--wms-app-text-muted)]">{t(`${L}.truncated`)}</p> : null}
    </div>
  );
}

function Shell({
  open,
  title,
  description,
  icon,
  children,
  onClose,
}: {
  open: boolean;
  title: ReactNode;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation('common');
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <OpsDialogContent size="xl" portalRoot="body" className="!max-h-[min(92dvh,900px)] !gap-0 !overflow-hidden !p-0">
        <OpsDialogHeader className="!m-0 !w-full !rounded-none !border-x-0 !border-t-0 !px-5 !py-4 !pr-14">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center border border-[color-mix(in_oklab,var(--wms-ops-accent)_28%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)] text-[var(--wms-ops-accent)]">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-ops-accent)]">
                {t(`${L}.eyebrow`)}
              </p>
              <DialogTitle className="wms-ops-detail-dialog__title">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="wms-ops-detail-dialog__description">{description}</DialogDescription>
              ) : null}
            </div>
          </div>
        </OpsDialogHeader>
        <OpsDialogBody className="!px-5 !py-4">{children}</OpsDialogBody>
        <OpsDialogFooter className="!m-0 !w-full !rounded-none !border-x-0 !border-b-0 !px-5 !py-3.5">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </OpsActionButton>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

export function WarehouseInventoryDialog({
  value,
  onClose,
}: {
  value: WarehouseInventoryLookup | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation('common');
  return (
    <Shell
      open={Boolean(value)}
      icon={<Warehouse className="size-5" aria-hidden />}
      title={value ? `${t(`${L}.warehouseTitle`)} ${value.warehouseName}` : t(`${L}.warehouseTitle`)}
      description={value ? t(`${L}.warehouseCode`, { code: value.warehouseCode }) : undefined}
      onClose={onClose}
    >
      {value ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label={t(`${W}.quantity`)} value={qty(value.quantity)} />
            <SummaryCard label={t(`${W}.reservedQuantity`)} value={qty(value.reservedQuantity)} />
            <SummaryCard label={t(`${W}.availableQuantity`)} value={qty(value.availableQuantity)} />
            <SummaryCard label={t(`${L}.stockCount`)} value={value.distinctStockCount} />
            <SummaryCard label={t(`${W}.distinctLocationCount`)} value={value.distinctLocationCount} />
          </div>
          <BalanceTable rows={value.lines} truncated={value.linesTruncated} />
        </div>
      ) : null}
    </Shell>
  );
}

export function LocationInventoryDialog({
  value,
  onClose,
}: {
  value: LocationInventoryLookup | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation('common');
  return (
    <Shell
      open={Boolean(value)}
      icon={<MapPin className="size-5" aria-hidden />}
      title={value ? `${t(`${L}.locationTitle`)} ${value.locationCode}` : t(`${L}.locationTitle`)}
      description={value ? `${value.locationName} · ${value.warehouseName}` : undefined}
      onClose={onClose}
    >
      {value ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label={t(`${W}.quantity`)} value={qty(value.quantity)} />
            <SummaryCard label={t(`${W}.reservedQuantity`)} value={qty(value.reservedQuantity)} />
            <SummaryCard label={t(`${W}.availableQuantity`)} value={qty(value.availableQuantity)} />
            <SummaryCard label={t(`${L}.stockCount`)} value={value.distinctStockCount} />
          </div>
          <BalanceTable rows={value.lines} truncated={value.linesTruncated} />
        </div>
      ) : null}
    </Shell>
  );
}

export function SerialInventoryDialog({
  value,
  onClose,
}: {
  value: SerialInventoryLookup | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation('common');
  const balance = value?.balance;
  return (
    <Shell
      open={Boolean(value)}
      icon={<Boxes className="size-5" aria-hidden />}
      title={balance ? `${t(`${L}.serialTitle`)} ${balance.serialNo}` : t(`${L}.serialTitle`)}
      description={balance ? `${balance.stockCode} · ${balance.warehouseName} / ${balance.locationCode}` : undefined}
      onClose={onClose}
    >
      {balance ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label={t(`${W}.quantity`)} value={`${qty(balance.quantity)} ${balance.unitCode}`} />
            <SummaryCard label={t(`${W}.reservedQuantity`)} value={qty(balance.reservedQuantity)} />
            <SummaryCard label={t(`${W}.availableQuantity`)} value={qty(balance.availableQuantity)} />
            <SummaryCard label={t(`${W}.stockStatus`)} value={localizeEnumValue(balance.stockStatus)} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[var(--wms-app-text-muted)]">
            <span className="inline-flex items-center gap-1 border border-[var(--wms-app-border)] px-2 py-1">
              <Hash className="size-3.5" aria-hidden />
              {balance.lotNo || '—'}
            </span>
            <span className="border border-[var(--wms-app-border)] px-2 py-1">{balance.yapCode || '—'}</span>
          </div>
          <div className="overflow-x-auto border border-[var(--wms-app-border)]">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="bg-[color-mix(in_oklab,var(--wms-ops-accent)_8%,transparent)] text-left">
                  <th className="p-2.5">{t(`${H}.occurredAt`)}</th>
                  <th className="p-2.5">{t(`${H}.operationType`)}</th>
                  <th className="p-2.5">{t(`${H}.referenceNo`)}</th>
                  <th className="p-2.5">{t(`${H}.locationCode`)}</th>
                  <th className="p-2.5 text-right">{t(`${H}.quantityDelta`)}</th>
                </tr>
              </thead>
              <tbody>
                {(value?.recentMovements.length ?? 0) === 0 ? (
                  <tr>
                    <td className="p-4 text-[var(--wms-app-text-muted)]" colSpan={5}>{t(`${L}.emptyMovements`)}</td>
                  </tr>
                ) : value!.recentMovements.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--wms-app-border)]">
                    <td className="p-2.5 font-mono text-xs">{row.occurredAt}</td>
                    <td className="p-2.5">{row.operationType}</td>
                    <td className="p-2.5">{[row.referenceType, row.referenceNo].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="p-2.5">{row.locationCode}</td>
                    <td className={`p-2.5 text-right font-mono ${row.quantityDelta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {row.quantityDelta > 0 ? '+' : ''}{qty(row.quantityDelta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}

export function LotInventoryDialog({
  value,
  onClose,
}: {
  value: LotInventoryLookup | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation('common');
  return (
    <Shell
      open={Boolean(value)}
      icon={<Hash className="size-5" aria-hidden />}
      title={value ? `${t(`${L}.lotTitle`)} ${value.lotNo}` : t(`${L}.lotTitle`)}
      onClose={onClose}
    >
      {value ? (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label={t(`${W}.quantity`)} value={qty(value.quantity)} />
            <SummaryCard label={t(`${W}.reservedQuantity`)} value={qty(value.reservedQuantity)} />
            <SummaryCard label={t(`${W}.availableQuantity`)} value={qty(value.availableQuantity)} />
            <SummaryCard label={t(`${L}.stockCount`)} value={value.distinctStockCount} />
            <SummaryCard label={t(`${W}.distinctLocationCount`)} value={value.distinctLocationCount} />
          </div>
          <BalanceTable rows={value.lines} truncated={value.linesTruncated} />
        </div>
      ) : null}
    </Shell>
  );
}
