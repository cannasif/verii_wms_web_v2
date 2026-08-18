export type OperationDraftType =
  | 'goods-receipt-direct'
  | 'goods-receipt-import'
  | 'steel-receipt-direct'
  | 'steel-receipt-placement'
  | 'warehouse-inbound-direct'
  | 'warehouse-outbound-create'
  | 'warehouse-transfer-direct';

export interface OperationDraftRecord<TPayload = unknown> {
  key: string;
  userId: string;
  branchCode: string;
  operationType: OperationDraftType;
  schemaVersion: number;
  updatedAt: string;
  expiresAt: string;
  payload: TPayload;
}

const DB_NAME = 'verii-wms-operation-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined')
    return Promise.reject(new Error('IndexedDB kullanılamıyor.'));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(STORE_NAME)) return;
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      store.createIndex('expiresAt', 'expiresAt', { unique: false });
      store.createIndex(
        'operationOwner',
        ['userId', 'branchCode', 'operationType'],
        { unique: false },
      );
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Taslak veritabanı açılamadı.'));
  });
  return databasePromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openDatabase().then(
    (database) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = callback(store);
        let result: T | undefined;
        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };
          request.onerror = () =>
            reject(request.error ?? new Error('Taslak işlemi başarısız.'));
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('Taslak transaction başarısız.'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Taslak transaction iptal edildi.'));
      }),
  );
}

export function buildOperationDraftKey(params: {
  userId: string | number;
  branchCode: string | number;
  operationType: OperationDraftType;
}): string {
  return `wms.operation-draft.v1.${params.userId}.${params.branchCode}.${params.operationType}`;
}

export async function readOperationDraft<TPayload>(
  key: string,
): Promise<OperationDraftRecord<TPayload> | null> {
  try {
    return (
      (await withStore<OperationDraftRecord<TPayload>>(
        'readonly',
        (store) => store.get(key),
      )) ?? null
    );
  } catch (error) {
    console.warn('[OperationDraft] Taslak okunamadı.', error);
    return null;
  }
}

export async function writeOperationDraft<TPayload>(
  record: OperationDraftRecord<TPayload>,
): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(record));
  } catch (error) {
    console.warn('[OperationDraft] Taslak kaydedilemedi.', error);
  }
}

export async function removeOperationDraft(key: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(key));
  } catch (error) {
    console.warn('[OperationDraft] Taslak silinemedi.', error);
  }
}

export async function removeExpiredOperationDrafts(
  now = new Date().toISOString(),
): Promise<void> {
  try {
    await withStore('readwrite', (store) => {
      const request = store.index('expiresAt').openCursor(IDBKeyRange.upperBound(now));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
    });
  } catch (error) {
    console.warn('[OperationDraft] Süresi dolan taslaklar temizlenemedi.', error);
  }
}
