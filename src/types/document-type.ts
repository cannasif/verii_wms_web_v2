export const DocumentType = {
  GR: 'GR',
  WT: 'WT',
  WI: 'WI',
  WO: 'WO',
  SRT: 'SRT',
  SIT: 'SIT',
  SH: 'SH',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

