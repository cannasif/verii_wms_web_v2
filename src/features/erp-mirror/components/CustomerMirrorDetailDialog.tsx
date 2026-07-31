import { type ReactElement, type ReactNode } from 'react';
import { Building2, Hash, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OpsActionButton } from '@/components/shared/OpsActionButton';
import {
  OpsDialogBody,
  OpsDialogContent,
  OpsDialogFooter,
  OpsDialogHeader,
} from '@/components/shared/OpsDialogShell';
import { OpsCodeBadge } from '@/components/shared/OpsStatusBadge';
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatProjectDateTime } from '@/lib/project-format';
import type { CustomerMirror } from '../types/erp-mirror.types';

const CARD = 'erpMirror.customerCardUi';

const display = (value?: string | number | null) => {
  if (value == null || value === '') return '—';
  return String(value);
};

export function CustomerMirrorDetailDialog({
  customer,
  onClose,
}: {
  customer: CustomerMirror | null;
  onClose: () => void;
}): ReactElement {
  const { t } = useTranslation('common');

  return (
    <Dialog open={Boolean(customer)} onOpenChange={open => { if (!open) onClose(); }}>
      <OpsDialogContent
        size="xl"
        portalRoot="body"
        className="!max-h-[min(92dvh,900px)] !gap-0 !overflow-hidden !rounded-2xl !p-0 data-no-auto-localize"
      >
        <OpsDialogHeader className="!m-0 !w-full !rounded-none !border-x-0 !border-t-0 !px-5 !py-4 !pr-14 sm:!px-6">
          <div className="flex w-full items-start gap-3 sm:gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--wms-ops-accent)_28%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_12%,transparent)] text-[var(--wms-ops-accent)] shadow-[0_0_18px_color-mix(in_oklab,var(--wms-ops-accent)_16%,transparent)]">
              <Users className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wms-ops-accent)]">
                {t(`${CARD}.eyebrow`)}
              </p>
              <DialogTitle className="wms-ops-detail-dialog__title">
                {t(`${CARD}.title`)}
                {customer ? (
                  <span className="ml-2 font-mono text-base font-bold text-[var(--wms-ops-accent)]">
                    {customer.customerCode}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="wms-ops-detail-dialog__description">
                {customer?.customerName || t(`${CARD}.untitled`)}
              </DialogDescription>
              {customer ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <OpsCodeBadge>{display(customer.customerCode)}</OpsCodeBadge>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_80%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--wms-app-text-muted)]">
                    <Building2 className="size-3.5" aria-hidden />
                    {t('erpMirror.fields.branchCode')}: {display(customer.branchCode)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wms-app-border)] px-2.5 py-1 font-mono text-xs text-[var(--wms-app-text-muted)]">
                    <Hash className="size-3.5" aria-hidden />
                    #{customer.id}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </OpsDialogHeader>

        <OpsDialogBody className="!px-5 !py-4 sm:!px-6">
          {customer ? (
            <div className="space-y-5">
              <section className="overflow-hidden rounded-xl border border-[color-mix(in_oklab,var(--wms-ops-accent)_22%,var(--wms-app-border))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent),transparent_55%)]">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color-mix(in_oklab,var(--wms-ops-accent)_14%,transparent)] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--wms-ops-accent)]">
                      {t(`${CARD}.identitySection`)}
                    </p>
                    <p className="mt-1 truncate font-mono text-lg font-black text-[var(--wms-app-text)]">
                      {customer.customerCode}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--wms-app-text-muted)]">{customer.customerName}</p>
                  </div>
                  <div className="text-right text-xs text-[var(--wms-app-text-muted)]">
                    <p className="inline-flex items-center gap-1.5">
                      <RefreshCw className="size-3.5" aria-hidden />
                      {t('erpMirror.fields.lastSyncDate')}
                    </p>
                    <p className="mt-1 font-mono font-semibold text-[var(--wms-app-text)]">
                      {customer.lastSyncDate ? formatProjectDateTime(customer.lastSyncDate) : '—'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-px bg-[color-mix(in_oklab,var(--wms-app-border)_70%,transparent)] sm:grid-cols-2">
                  <MetaCell label={t('erpMirror.fields.branchCode')} value={display(customer.branchCode)} />
                  <MetaCell label={t('erpMirror.fields.businessUnitCode')} value={display(customer.businessUnitCode)} />
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeading
                  icon={<Building2 className="size-3.5" aria-hidden />}
                  title={t(`${CARD}.orgSection`)}
                />
                <div className="grid gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)] p-4 sm:grid-cols-2">
                  <OpsDetailField label={t('erpMirror.fields.id')}>{display(customer.id)}</OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.branchCode')}>{display(customer.branchCode)}</OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.businessUnitCode')}>{display(customer.businessUnitCode)}</OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.customerCode')}>{display(customer.customerCode)}</OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.customerName')} wide>
                    {display(customer.customerName)}
                  </OpsDetailField>
                </div>
              </section>

              <section className="space-y-3">
                <SectionHeading
                  icon={<ShieldCheck className="size-3.5" aria-hidden />}
                  title={t(`${CARD}.auditSection`)}
                />
                <div className="grid gap-3 rounded-xl border border-[var(--wms-app-border)] bg-[color-mix(in_oklab,var(--wms-app-panel)_92%,transparent)] p-4 sm:grid-cols-2">
                  <OpsDetailField label={t('erpMirror.fields.createdBy')}>{display(customer.createdBy)}</OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.createdDate')}>
                    {customer.createdDate ? formatProjectDateTime(customer.createdDate) : '—'}
                  </OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.updatedBy')}>{display(customer.updatedBy)}</OpsDetailField>
                  <OpsDetailField label={t('erpMirror.fields.updatedDate')}>
                    {customer.updatedDate ? formatProjectDateTime(customer.updatedDate) : '—'}
                  </OpsDetailField>
                </div>
              </section>
            </div>
          ) : null}
        </OpsDialogBody>

        <OpsDialogFooter className="!m-0 !w-full !rounded-none !border-x-0 !border-b-0 !px-5 !py-3.5 sm:!px-6">
          <OpsActionButton type="button" variant="secondary" onClick={onClose}>
            {t('common.close')}
          </OpsActionButton>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}

function SectionHeading({ icon, title }: { icon: ReactNode; title: string }): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md border border-[color-mix(in_oklab,var(--wms-ops-accent)_24%,var(--wms-app-border))] bg-[color-mix(in_oklab,var(--wms-ops-accent)_10%,transparent)] text-[var(--wms-ops-accent)]">
        {icon}
      </span>
      <h3 className="text-sm font-bold text-[var(--wms-app-text)]">{title}</h3>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="bg-[color-mix(in_oklab,var(--wms-app-panel)_94%,transparent)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--wms-app-text-muted)]">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-[var(--wms-app-text)]">{value}</p>
    </div>
  );
}

function OpsDetailField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}): ReactElement {
  return (
    <div className={wide ? 'wms-ops-detail-field wms-ops-detail-field--wide sm:col-span-2' : 'wms-ops-detail-field'}>
      <span className="wms-ops-detail-field__label">{label}</span>
      <span className="wms-ops-detail-field__value">{children}</span>
    </div>
  );
}
