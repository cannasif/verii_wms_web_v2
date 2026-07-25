import { api } from '@/lib/axios';
import type { ApiResponse, PagedParams, PagedResponse } from '@/types/api';
import { getLocalizedText } from '@/lib/localized-error';
import type {
  BranchLookup,
  CustomerLookup,
  ExchangeRateLookup,
  ProjectLookup,
  ShelfLookup,
  SpecialCodeLookup,
  StockLookup,
  WarehouseLookup,
  YapKodLookup,
} from './lookup-types';
import type { ApiRequestOptions } from '@/lib/request-utils';
import { buildPagedRequest } from '@/lib/paged';
import { fetchAllPagedData } from '@/lib/fetch-all-paged-data';

async function getServerPagedFirstPageData<T>(url: string, options?: ApiRequestOptions): Promise<T[]> {
  return fetchAllPagedData({
    fetchPage: async (pageNumber, pageSize) => {
      const response = await api.post<ApiResponse<PagedResponse<T>>>(
        url,
        buildPagedRequest({ pageNumber, pageSize }),
        options,
      );
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.message || getLocalizedText('common.errors.unknown'));
    },
  });
}

async function getServerPagedResponse<T>(url: string, params: PagedParams = {}, options?: ApiRequestOptions): Promise<PagedResponse<T>> {
  const response = await api.post<ApiResponse<PagedResponse<T>>>(
    url,
    buildPagedRequest(params, {
      pageNumber: 1,
      pageSize: 20,
      sortBy: 'Id',
      sortDirection: 'desc',
    }),
    options,
  );

  if (response.success && response.data) {
    return response.data;
  }

  throw new Error(response.message || getLocalizedText('common.errors.unknown'));
}

async function getServerListData<T>(url: string, options?: ApiRequestOptions): Promise<T[]> {
  const response = await api.get<ApiResponse<T[]>>(url, options);
  if (response.success && response.data) {
    return response.data;
  }
  throw new Error(response.message || getLocalizedText('common.errors.unknown'));
}

interface WmsCustomerLookupDto {
  id: number;
  branchCode?: string | null;
  customerCode: string;
  customerName: string;
  phone1?: string | null;
  city?: string | null;
  countryCode?: string | null;
  groupCode?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  address?: string | null;
}

interface WmsWarehouseLookupDto {
  id: number;
  warehouseCode: number;
  warehouseName: string;
}

interface WmsShelfLookupDto {
  id: number;
  warehouseId: number;
  warehouseCode?: number | null;
  warehouseName?: string | null;
  code: string;
  name: string;
  locationType: string;
  barcode?: string | null;
}

interface WmsStockLookupDto {
  id: number;
  branchCode?: string | null;
  erpStockCode: string;
  ureticiKodu?: string | null;
  stockName: string;
  grupKodu?: string | null;
  unit?: string | null;
  kod1?: string | null;
  kod2?: string | null;
  kod3?: string | null;
  kod4?: string | null;
  kod5?: string | null;
}

interface WmsYapKodLookupDto {
  id: number;
  yapKod: string;
  yapAcik: string;
  stockId?: number | null;
  yplndrStokKod?: string | null;
}

interface YapKodStockRef {
  stockId?: number;
  // Legacy reference only. Filtering should now be driven by stockId.
  stockCode?: string;
}

export const lookupApi = {
  getCustomerById: async (id: number, options?: ApiRequestOptions): Promise<CustomerLookup> => {
    try {
      const response = await api.get<ApiResponse<WmsCustomerLookupDto>>(`/api/Customer/${id}`, options);
      const customer = response.data;
      if (!response.success || !customer) {
        throw new Error(response.message || getLocalizedText('common.errors.unknown'));
      }

      return {
        id: customer.id,
        subeKodu: Number(customer.branchCode || 0),
        isletmeKodu: 0,
        cariKod: customer.customerCode,
        cariTel: customer.phone1 || '',
        cariIl: customer.city || '',
        ulkeKodu: customer.countryCode || '',
        cariIsim: customer.customerName,
        cariTip: '',
        grupKodu: customer.groupCode || '',
        raporKodu1: '',
        raporKodu2: '',
        raporKodu3: '',
        raporKodu4: '',
        raporKodu5: '',
        cariAdres: customer.address || '',
        cariIlce: '',
        vergiDairesi: customer.taxOffice || '',
        vergiNumarasi: customer.taxNumber || '',
        fax: '',
        postaKodu: '',
        detayKodu: 0,
        nakliyeKatsayisi: 0,
        riskSiniri: 0,
        teminati: 0,
        cariRisk: 0,
        ccRisk: 0,
        saRisk: 0,
        scRisk: 0,
        cmBorct: 0,
        cmAlact: 0,
        cmRapTarih: '',
        kosulKodu: '',
        iskontoOrani: 0,
        vadeGunu: 0,
        listeFiati: 0,
        acik1: '',
        acik2: '',
        acik3: '',
        mKod: '',
        dovizTipi: 0,
        dovizTuru: 0,
        hesapTutmaSekli: '',
        dovizLimi: '',
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpCustomersLoadFailed'));
    }
  },

  getCustomers: async (options?: ApiRequestOptions): Promise<CustomerLookup[]> => {
    try {
      const customers = await getServerPagedFirstPageData<WmsCustomerLookupDto>('/api/Customer/paged', options);
      return customers.map((customer) => ({
        id: customer.id,
        subeKodu: Number(customer.branchCode || 0),
        isletmeKodu: 0,
        cariKod: customer.customerCode,
        cariTel: customer.phone1 || '',
        cariIl: customer.city || '',
        ulkeKodu: customer.countryCode || '',
        cariIsim: customer.customerName,
        cariTip: '',
        grupKodu: customer.groupCode || '',
        raporKodu1: '',
        raporKodu2: '',
        raporKodu3: '',
        raporKodu4: '',
        raporKodu5: '',
        cariAdres: customer.address || '',
        cariIlce: '',
        vergiDairesi: customer.taxOffice || '',
        vergiNumarasi: customer.taxNumber || '',
        fax: '',
        postaKodu: '',
        detayKodu: 0,
        nakliyeKatsayisi: 0,
        riskSiniri: 0,
        teminati: 0,
        cariRisk: 0,
        ccRisk: 0,
        saRisk: 0,
        scRisk: 0,
        cmBorct: 0,
        cmAlact: 0,
        cmRapTarih: '',
        kosulKodu: '',
        iskontoOrani: 0,
        vadeGunu: 0,
        listeFiati: 0,
        acik1: '',
        acik2: '',
        acik3: '',
        mKod: '',
        dovizTipi: 0,
        dovizTuru: 0,
        hesapTutmaSekli: '',
        dovizLimi: '',
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpCustomersLoadFailed'));
    }
  },

  getCustomersPaged: async (
    params: PagedParams = {},
    options?: ApiRequestOptions,
  ): Promise<PagedResponse<CustomerLookup>> => {
    try {
      const response = await getServerPagedResponse<WmsCustomerLookupDto>('/api/Customer/paged', params, options);
      return {
        ...response,
        data: (response.data ?? []).map((customer) => ({
          id: customer.id,
          subeKodu: Number(customer.branchCode || 0),
          isletmeKodu: 0,
          cariKod: customer.customerCode,
          cariTel: customer.phone1 || '',
          cariIl: customer.city || '',
          ulkeKodu: customer.countryCode || '',
          cariIsim: customer.customerName,
          cariTip: '',
          grupKodu: customer.groupCode || '',
          raporKodu1: '',
          raporKodu2: '',
          raporKodu3: '',
          raporKodu4: '',
          raporKodu5: '',
          cariAdres: customer.address || '',
          cariIlce: '',
          vergiDairesi: customer.taxOffice || '',
          vergiNumarasi: customer.taxNumber || '',
          fax: '',
          postaKodu: '',
          detayKodu: 0,
          nakliyeKatsayisi: 0,
          riskSiniri: 0,
          teminati: 0,
          cariRisk: 0,
          ccRisk: 0,
          saRisk: 0,
          scRisk: 0,
          cmBorct: 0,
          cmAlact: 0,
          cmRapTarih: '',
          kosulKodu: '',
          iskontoOrani: 0,
          vadeGunu: 0,
          listeFiati: 0,
          acik1: '',
          acik2: '',
          acik3: '',
          mKod: '',
          dovizTipi: 0,
          dovizTuru: 0,
          hesapTutmaSekli: '',
          dovizLimi: '',
        })),
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpCustomersLoadFailed'));
    }
  },

  getProjects: async (options?: ApiRequestOptions): Promise<ProjectLookup[]> => {
    try {
      return await getServerListData<ProjectLookup>('/api/netsis-read/projects', options);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpProjectsLoadFailed'));
    }
  },

  getSpecialCodes: async (tableType: number, specialCode?: string, options?: ApiRequestOptions): Promise<SpecialCodeLookup[]> => {
    try {
      const query = new URLSearchParams({ tableType: String(tableType) });
      if (specialCode?.trim()) {
        query.set('specialCode', specialCode.trim());
      }
      return await getServerListData<SpecialCodeLookup>(`/api/netsis-read/getSpecialCodes?${query.toString()}`, options);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.unknown'));
    }
  },

  getExchangeRates: async (date: string | Date, pricingType: number, options?: ApiRequestOptions): Promise<ExchangeRateLookup[]> => {
    try {
      const normalizedDate = typeof date === 'string' ? date : date.toISOString();
      const query = new URLSearchParams({ date: normalizedDate, pricingType: String(pricingType) });
      return await getServerListData<ExchangeRateLookup>(`/api/netsis-read/getExchangeRate?${query.toString()}`, options);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.unknown'));
    }
  },

  getWarehouses: async (depoKodu?: number, options?: ApiRequestOptions): Promise<WarehouseLookup[]> => {
    try {
      const warehouses = await getServerPagedFirstPageData<WmsWarehouseLookupDto>('/api/Warehouse/paged', options);
      return warehouses
        .filter((warehouse) => depoKodu === undefined || warehouse.warehouseCode === depoKodu)
        .map((warehouse) => ({
          id: warehouse.id,
          depoKodu: warehouse.warehouseCode,
          depoIsmi: warehouse.warehouseName,
        }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpWarehousesLoadFailed'));
    }
  },

  getWarehousesPaged: async (
    params: PagedParams = {},
    depoKodu?: number,
    options?: ApiRequestOptions,
  ): Promise<PagedResponse<WarehouseLookup>> => {
    try {
      const response = await getServerPagedResponse<WmsWarehouseLookupDto>('/api/Warehouse/paged', params, options);
      const data = (response.data ?? [])
        .filter((warehouse) => depoKodu === undefined || warehouse.warehouseCode === depoKodu)
        .map((warehouse) => ({
          id: warehouse.id,
          depoKodu: warehouse.warehouseCode,
          depoIsmi: warehouse.warehouseName,
        }));

      return {
        ...response,
        data,
        totalCount: depoKodu === undefined ? response.totalCount : data.length,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpWarehousesLoadFailed'));
    }
  },

  getWarehouseById: async (id: number, options?: ApiRequestOptions): Promise<WarehouseLookup> => {
    try {
      const response = await api.get<ApiResponse<WmsWarehouseLookupDto>>(`/api/Warehouse/${id}`, options);
      const warehouse = response.data;
      if (!response.success || !warehouse) {
        throw new Error(response.message || getLocalizedText('common.errors.unknown'));
      }

      return {
        id: warehouse.id,
        depoKodu: warehouse.warehouseCode,
        depoIsmi: warehouse.warehouseName,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpWarehousesLoadFailed'));
    }
  },

  getShelves: async (warehouseCode?: number | string, options?: ApiRequestOptions): Promise<ShelfLookup[]> => {
    try {
      const normalizedWarehouseCode = typeof warehouseCode === 'string' ? Number(warehouseCode) : warehouseCode;
      if (!normalizedWarehouseCode || Number.isNaN(normalizedWarehouseCode)) {
        return [];
      }

      const warehouses = await lookupApi.getWarehouses(normalizedWarehouseCode, options);
      const warehouse = warehouses[0];
      if (!warehouse) {
        return [];
      }

      const response = await api.get<ApiResponse<WmsShelfLookupDto[]>>('/api/Shelf/lookup', {
        ...options,
        params: { warehouseId: warehouse.id, includeInactive: false },
      });

      if (response.success && response.data) {
        return response.data.map((item) => ({
          id: item.id,
          warehouseId: item.warehouseId,
          depoKodu: item.warehouseCode ?? undefined,
          depoIsmi: item.warehouseName ?? undefined,
          rafKodu: item.code,
          rafAdi: item.name,
          lokasyonTipi: item.locationType,
          barkod: item.barcode ?? undefined,
        }));
      }

      throw new Error(response.message || getLocalizedText('common.errors.unknown'));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.unknown'));
    }
  },

  getProducts: async (options?: ApiRequestOptions): Promise<StockLookup[]> => {
    try {
      const products = await getServerPagedFirstPageData<WmsStockLookupDto>('/api/Stock/paged', options);
      return products.map((product) => ({
        id: product.id,
        subeKodu: Number(product.branchCode || 0),
        isletmeKodu: 0,
        stokKodu: product.erpStockCode,
        ureticiKodu: product.ureticiKodu || '',
        stokAdi: product.stockName,
        grupKodu: product.grupKodu || '',
        saticiKodu: '',
        olcuBr1: product.unit || '',
        olcuBr2: '',
        pay1: 0,
        kod1: product.kod1 || '',
        kod2: product.kod2 || '',
        kod3: product.kod3 || '',
        kod4: product.kod4 || '',
        kod5: product.kod5 || '',
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpProductsLoadFailed'));
    }
  },

  getProductsPaged: async (
    params: PagedParams = {},
    options?: ApiRequestOptions,
  ): Promise<PagedResponse<StockLookup>> => {
    try {
      const response = await getServerPagedResponse<WmsStockLookupDto>('/api/Stock/paged', params, options);
      return {
        ...response,
        data: (response.data ?? []).map((product) => ({
          id: product.id,
          subeKodu: Number(product.branchCode || 0),
          isletmeKodu: 0,
          stokKodu: product.erpStockCode,
          ureticiKodu: product.ureticiKodu || '',
          stokAdi: product.stockName,
          grupKodu: product.grupKodu || '',
          saticiKodu: '',
          olcuBr1: product.unit || '',
          olcuBr2: '',
          pay1: 0,
          kod1: product.kod1 || '',
          kod2: product.kod2 || '',
          kod3: product.kod3 || '',
          kod4: product.kod4 || '',
          kod5: product.kod5 || '',
        })),
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpProductsLoadFailed'));
    }
  },

  getProductById: async (id: number, options?: ApiRequestOptions): Promise<StockLookup> => {
    try {
      const response = await api.get<ApiResponse<WmsStockLookupDto>>(`/api/Stock/${id}`, options);
      const product = response.data;
      if (!response.success || !product) {
        throw new Error(response.message || getLocalizedText('common.errors.unknown'));
      }

      return {
        id: product.id,
        subeKodu: Number(product.branchCode || 0),
        isletmeKodu: 0,
        stokKodu: product.erpStockCode,
        ureticiKodu: product.ureticiKodu || '',
        stokAdi: product.stockName,
        grupKodu: product.grupKodu || '',
        saticiKodu: '',
        olcuBr1: product.unit || '',
        olcuBr2: '',
        pay1: 0,
        kod1: product.kod1 || '',
        kod2: product.kod2 || '',
        kod3: product.kod3 || '',
        kod4: product.kod4 || '',
        kod5: product.kod5 || '',
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.erpProductsLoadFailed'));
    }
  },

  getYapKodlar: async (options?: ApiRequestOptions): Promise<YapKodLookup[]> => {
    try {
      const items = await getServerPagedFirstPageData<WmsYapKodLookupDto>('/api/YapKod/paged', options);
      return items.map((item) => ({
        id: item.id,
        yapKod: item.yapKod,
        yapAcik: item.yapAcik,
        stockId: item.stockId ?? undefined,
        yplndrStokKod: item.yplndrStokKod || undefined,
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.unknown'));
    }
  },

  getYapKodlarPaged: async (
    params: PagedParams = {},
    stockRef?: string | YapKodStockRef,
    options?: ApiRequestOptions,
  ): Promise<PagedResponse<YapKodLookup>> => {
    try {
      const normalizedStockRef: YapKodStockRef = typeof stockRef === 'string'
        ? { stockCode: stockRef }
        : stockRef ?? {};

      const response = await getServerPagedResponse<WmsYapKodLookupDto>(
        '/api/YapKod/paged',
        normalizedStockRef.stockId
          ? {
              ...params,
              filters: [
                ...(params.filters ?? []),
                { column: 'StockId', operator: 'Equals', value: String(normalizedStockRef.stockId) },
              ],
            }
          : params,
        options,
      );
      const data = (response.data ?? []).map((item) => ({
          id: item.id,
          yapKod: item.yapKod,
          yapAcik: item.yapAcik,
          stockId: item.stockId ?? undefined,
          yplndrStokKod: item.yplndrStokKod || undefined,
        }));

      return {
        ...response,
        data,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : getLocalizedText('common.errors.unknown'));
    }
  },

  getBranches: async (options?: ApiRequestOptions): Promise<BranchLookup[]> => {
    const response = await api.get('/api/netsis-read/getBranches', { skipAuth: true, ...options }) as ApiResponse<BranchLookup[]>;
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || getLocalizedText('common.errors.erpBranchesLoadFailed'));
  },
};
