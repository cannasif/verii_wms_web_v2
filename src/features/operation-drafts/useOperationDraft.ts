import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildOperationDraftKey,
  readOperationDraft,
  removeExpiredOperationDrafts,
  removeOperationDraft,
  writeOperationDraft,
  type OperationDraftRecord,
  type OperationDraftType,
} from './operation-draft-store';

const AUTOSAVE_DELAY_MS = 900;
const DRAFT_TTL_DAYS = 14;

interface UseOperationDraftOptions<TPayload> {
  operationType: OperationDraftType;
  userId?: string | number | null;
  branchCode?: string | number | null;
  payload: TPayload;
  isMeaningful: (payload: TPayload) => boolean;
  onRestore: (payload: TPayload) => void;
  enabled?: boolean;
  schemaVersion?: number;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function isFileLike(value: unknown): boolean {
  return (
    (typeof File !== 'undefined' && value instanceof File) ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
  );
}

function sanitize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (isFileLike(item)) return undefined;
      if (typeof item === 'string' && item.startsWith('blob:')) return undefined;
      return item;
    }),
  ) as T;
}

export function useOperationDraft<TPayload>({
  operationType,
  userId,
  branchCode,
  payload,
  isMeaningful,
  onRestore,
  enabled = true,
  schemaVersion = 1,
}: UseOperationDraftOptions<TPayload>) {
  const normalizedBranch = String(branchCode ?? '').trim();
  const draftKey = useMemo(() => {
    if (userId == null || userId === '' || !normalizedBranch) return null;
    return buildOperationDraftKey({
      userId,
      branchCode: normalizedBranch,
      operationType,
    });
  }, [normalizedBranch, operationType, userId]);
  const [pendingDraft, setPendingDraft] =
    useState<OperationDraftRecord<TPayload> | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);
  const restoringRef = useRef(false);

  const clearDraft = useCallback(async (): Promise<void> => {
    if (draftKey) await removeOperationDraft(draftKey);
  }, [draftKey]);

  useEffect(() => {
    let active = true;
    setLoadComplete(false);
    setPendingDraft(null);
    setRestoreDialogOpen(false);
    if (!draftKey) {
      setLoadComplete(true);
      return () => {
        active = false;
      };
    }
    void (async () => {
      await removeExpiredOperationDrafts();
      const record = await readOperationDraft<TPayload>(draftKey);
      if (!active) return;
      if (
        !record ||
        record.schemaVersion !== schemaVersion ||
        new Date(record.expiresAt).getTime() <= Date.now() ||
        !isMeaningful(record.payload)
      ) {
        if (record) await removeOperationDraft(draftKey);
        if (active) setLoadComplete(true);
        return;
      }
      setPendingDraft(record);
      setRestoreDialogOpen(true);
      setLoadComplete(true);
    })();
    return () => {
      active = false;
    };
  }, [draftKey, isMeaningful, schemaVersion]);

  useEffect(() => {
    if (
      !draftKey ||
      !enabled ||
      !loadComplete ||
      restoreDialogOpen ||
      restoringRef.current
    )
      return;
    const safePayload = sanitize(payload);
    if (!isMeaningful(safePayload)) {
      void removeOperationDraft(draftKey);
      return;
    }
    const timeout = window.setTimeout(() => {
      const now = new Date();
      void writeOperationDraft<TPayload>({
        key: draftKey,
        userId: String(userId),
        branchCode: normalizedBranch,
        operationType,
        schemaVersion,
        updatedAt: now.toISOString(),
        expiresAt: addDays(now, DRAFT_TTL_DAYS).toISOString(),
        payload: safePayload,
      });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [
    draftKey,
    enabled,
    isMeaningful,
    loadComplete,
    normalizedBranch,
    operationType,
    payload,
    restoreDialogOpen,
    schemaVersion,
    userId,
  ]);

  const restoreDraft = useCallback((): void => {
    if (!pendingDraft) return;
    restoringRef.current = true;
    onRestore(pendingDraft.payload);
    setPendingDraft(null);
    setRestoreDialogOpen(false);
    window.setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  }, [onRestore, pendingDraft]);

  const discardDraft = useCallback(async (): Promise<void> => {
    await clearDraft();
    setPendingDraft(null);
    setRestoreDialogOpen(false);
  }, [clearDraft]);

  return {
    pendingDraft,
    restoreDialogOpen,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}
