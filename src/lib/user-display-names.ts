export type UserDisplayNameSource = {
  id: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type Envelope<T> = { success: boolean; data: T; message?: string };
type UserPage = { items?: UserDisplayNameSource[] | null };

let directory = new Map<number, string>();

export function formatUserDisplayName(user: UserDisplayNameSource): string {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return fullName || user.username?.trim() || String(user.id);
}

export function buildUserDisplayNameMap(users: readonly UserDisplayNameSource[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const user of users) {
    if (user?.id == null) continue;
    map.set(user.id, formatUserDisplayName(user));
  }
  return map;
}

export function setUserDisplayNameDirectory(users: readonly UserDisplayNameSource[]): Map<number, string> {
  directory = buildUserDisplayNameMap(users);
  return directory;
}

export function getUserDisplayName(userId?: number | null): string | undefined {
  if (userId == null) return undefined;
  return directory.get(userId);
}

function readUserPageItems(data: UserPage | UserDisplayNameSource[] | null | undefined): UserDisplayNameSource[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/** Aktif + pasif kullanıcılar; audit kolonlarında tarihsel kayıt edenleri de çözmek için. */
export async function fetchUserDisplayNameDirectory(signal?: AbortSignal): Promise<UserDisplayNameSource[]> {
  const { api } = await import('@/lib/axios');
  const response = await api.post<Envelope<UserPage | UserDisplayNameSource[]>>('/api/users/paged', {
    pageNumber: 1,
    pageSize: 500,
    search: null,
    sortBy: 'username',
    sortDirection: 'asc',
    filterLogic: 'and',
    filters: [],
  }, { signal });

  if (!response.success) {
    throw new Error(response.message || 'Kullanıcı listesi alınamadı.');
  }

  return readUserPageItems(response.data);
}
