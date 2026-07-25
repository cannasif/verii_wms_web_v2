interface JwtPayload {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': string;
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': string;
  firstName: string;
  lastName: string;
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': string;
  exp: number;
  iss: string;
  aud: string;
}

export const decodeJwt = (token: string): JwtPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  } catch {
    return null;
  }
};

export const getUserFromToken = (token: string): { id: number; email: string; name: string } | null => {
  const payload = decodeJwt(token);
  if (!payload) return null;

  return {
    id: parseInt(payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'], 10),
    email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    name: `${payload.firstName} ${payload.lastName}`.trim() || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
  };
};

export const isTokenValid = (token: string): boolean => {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return false;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp > currentTime;
};

