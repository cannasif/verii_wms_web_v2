import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OpsDialogBody, OpsDialogContent, OpsDialogFooter, OpsDialogHeader } from '@/components/shared/OpsDialogShell';
import { cn } from '@/lib/utils';
import {
  QUICK_ACCESS_SLOT_COUNT,
  type QuickAccessAction,
  type QuickAccessId,
  coerceQuickAccessIds,
} from '../lib/quick-access';

export function QuickAccessCustomizeDialog({
  open,
  onOpenChange,
  allowedActions,
  selectedIds,
  resolveTitle,
  onSave,
  terminalSkin = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedActions: QuickAccessAction[];
  selectedIds: QuickAccessId[];
  resolveTitle: (action: QuickAccessAction) => string;
  onSave: (ids: QuickAccessId[]) => void;
  terminalSkin?: boolean;
}): ReactElement {
  const { t } = useTranslation('common');
  const [draftIds, setDraftIds] = useState<QuickAccessId[]>(() => coerceQuickAccessIds(selectedIds));

  useEffect(() => {
    if (open) setDraftIds(coerceQuickAccessIds(selectedIds));
  }, [open, selectedIds]);

  const byId = useMemo(
    () => new Map(allowedActions.map((action) => [action.id, action])),
    [allowedActions],
  );

  const selectedActions = useMemo(
    () => draftIds.map((id) => byId.get(id)).filter((action): action is QuickAccessAction => Boolean(action)),
    [byId, draftIds],
  );

  const availableActions = useMemo(
    () => allowedActions.filter((action) => !draftIds.includes(action.id)),
    [allowedActions, draftIds],
  );

  const addAction = (id: QuickAccessId) => {
    setDraftIds((current) => {
      if (current.includes(id) || current.length >= QUICK_ACCESS_SLOT_COUNT) return current;
      return [...current, id];
    });
  };

  const removeAction = (id: QuickAccessId) => {
    setDraftIds((current) => current.filter((item) => item !== id));
  };

  const slotsFull = draftIds.length >= QUICK_ACCESS_SLOT_COUNT;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <OpsDialogContent
        size="xl"
        className={cn('wms-dash-quick-edit sm:max-w-4xl', terminalSkin && 'wms-dash-quick-edit--terminal')}
      >
        <OpsDialogHeader>
          <DialogHeader className="gap-1 text-left">
            <DialogTitle>{t('dashboard.quickAccessCustomizeTitle')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.quickAccessCustomizeHint', {
                selected: selectedActions.length,
                max: QUICK_ACCESS_SLOT_COUNT,
              })}
            </DialogDescription>
          </DialogHeader>
        </OpsDialogHeader>

        <OpsDialogBody className="wms-dash-quick-edit__body">
          <section aria-label={t('dashboard.quickAccessSelected')}>
            <h3 className="wms-dash-quick-edit__section-title">{t('dashboard.quickAccessSelected')}</h3>
            {selectedActions.length === 0 ? (
              <p className="wms-dash-quick-edit__empty">{t('dashboard.quickAccessSelectedEmpty')}</p>
            ) : (
              <ul className="wms-dash-quick-edit__list">
                {selectedActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <li key={action.id} className="wms-dash-quick-edit__tile">
                      <span className={cn('wms-dash-quick-edit__icon', `wms-dash-quick-edit__icon--${action.tone}`)} aria-hidden>
                        <Icon size={16} strokeWidth={1.8} />
                      </span>
                      <span className="wms-dash-quick-edit__label">{resolveTitle(action)}</span>
                      <button
                        type="button"
                        className="wms-dash-quick-edit__slot"
                        aria-label={t('dashboard.quickAccessRemove')}
                        title={t('dashboard.quickAccessRemove')}
                        onClick={() => removeAction(action.id)}
                      >
                        <X size={15} strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="wms-dash-quick-edit__tip">{t('dashboard.quickAccessDragTip')}</p>
          </section>

          <section aria-label={t('dashboard.quickAccessAvailable')}>
            <h3 className="wms-dash-quick-edit__section-title">{t('dashboard.quickAccessAvailable')}</h3>
            {availableActions.length === 0 ? (
              <p className="wms-dash-quick-edit__empty">{t('dashboard.quickAccessAvailableEmpty')}</p>
            ) : (
              <ul className="wms-dash-quick-edit__pool">
                {availableActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <li key={action.id}>
                      <button
                        type="button"
                        className="wms-dash-quick-edit__tile wms-dash-quick-edit__tile--add"
                        disabled={slotsFull}
                        onClick={() => addAction(action.id)}
                      >
                        <span className={cn('wms-dash-quick-edit__icon', `wms-dash-quick-edit__icon--${action.tone}`)} aria-hidden>
                          <Icon size={16} strokeWidth={1.8} />
                        </span>
                        <span className="wms-dash-quick-edit__label">{resolveTitle(action)}</span>
                        <span className="wms-dash-quick-edit__slot" aria-hidden>
                          <Plus size={15} strokeWidth={2} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {slotsFull ? (
              <p className="wms-dash-quick-edit__tip">{t('dashboard.quickAccessSlotsFull')}</p>
            ) : null}
          </section>
        </OpsDialogBody>

        <OpsDialogFooter>
          <DialogFooter className="w-full gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                onSave(coerceQuickAccessIds(draftIds));
                onOpenChange(false);
              }}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </OpsDialogFooter>
      </OpsDialogContent>
    </Dialog>
  );
}
