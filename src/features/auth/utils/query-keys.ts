export const AUTH_QUERY_KEYS = {
  BRANCHES: 'auth.branches',
  ACTIVE_USERS: 'auth.activeUsers',
} as const;

export const queryKeys = {
  branches: () => [AUTH_QUERY_KEYS.BRANCHES] as const,
  activeUsers: () => [AUTH_QUERY_KEYS.ACTIVE_USERS] as const,
};

