export interface CustomerLookup {
  id: number;
  subeKodu: number;
  isletmeKodu: number;
  cariKod: string;
  cariTel: string;
  cariIl: string;
  ulkeKodu: string;
  cariIsim: string;
  cariTip: string;
  grupKodu: string;
  raporKodu1: string;
  raporKodu2: string;
  raporKodu3: string;
  raporKodu4: string;
  raporKodu5: string;
  cariAdres: string;
  cariIlce: string;
  vergiDairesi: string;
  vergiNumarasi: string;
  fax: string;
  postaKodu: string;
  detayKodu: number;
  nakliyeKatsayisi: number;
  riskSiniri: number;
  teminati: number;
  cariRisk: number;
  ccRisk: number;
  saRisk: number;
  scRisk: number;
  cmBorct: number;
  cmAlact: number;
  cmRapTarih: string;
  kosulKodu: string;
  iskontoOrani: number;
  vadeGunu: number;
  listeFiati: number;
  acik1: string;
  acik2: string;
  acik3: string;
  mKod: string;
  dovizTipi: number;
  dovizTuru: number;
  hesapTutmaSekli: string;
  dovizLimi: string;
}

export interface ProjectLookup {
  projeKod: string;
  projeAciklama: string;
}

export interface SpecialCodeLookup {
  isletmeKodu: number;
  ozelKod: string;
  aciklama?: string | null;
  displayName: string;
}

export interface ExchangeRateLookup {
  dovizTipi: number;
  dovizIsmi?: string | null;
  kurDegeri?: number | null;
}

export interface WarehouseLookup {
  id: number;
  depoKodu: number;
  depoIsmi: string;
}

export interface ShelfLookup {
  id: number;
  warehouseId: number;
  depoKodu?: number;
  depoIsmi?: string;
  rafKodu: string;
  rafAdi: string;
  lokasyonTipi: string;
  barkod?: string;
}

export interface StockLookup {
  id: number;
  subeKodu: number;
  isletmeKodu: number;
  stokKodu: string;
  ureticiKodu: string;
  stokAdi: string;
  grupKodu: string;
  saticiKodu: string;
  olcuBr1: string;
  olcuBr2: string;
  pay1: number;
  kod1: string;
  kod2: string;
  kod3: string;
  kod4: string;
  kod5: string;
}

export interface YapKodLookup {
  id: number;
  yapKod: string;
  yapAcik: string;
  stockId?: number;
  yplndrStokKod?: string;
}

export interface BranchLookup {
  subeKodu: number;
  unvan: string;
}
