export type ProfileMetaV1 = {
  v: 1;
  note: string;
  phone: string;
  linkedInUrl: string;
};

export function serializeProfileMeta(parts: { note: string; phone: string; linkedInUrl: string }): string {
  const payload: ProfileMetaV1 = {
    v: 1,
    note: parts.note,
    phone: parts.phone,
    linkedInUrl: parts.linkedInUrl,
  };
  return JSON.stringify(payload);
}

export function parseProfileMeta(raw: string | null | undefined): { note: string; phone: string; linkedInUrl: string } {
  if (!raw || raw.trim() === '') {
    return { note: '', phone: '', linkedInUrl: '' };
  }
  try {
    const o = JSON.parse(raw) as Partial<ProfileMetaV1>;
    if (o && typeof o === 'object' && o.v === 1) {
      return {
        note: typeof o.note === 'string' ? o.note : '',
        phone: typeof o.phone === 'string' ? o.phone : '',
        linkedInUrl: typeof o.linkedInUrl === 'string' ? o.linkedInUrl : '',
      };
    }
  } catch {
    return { note: raw, phone: '', linkedInUrl: '' };
  }
  return { note: raw, phone: '', linkedInUrl: '' };
}
