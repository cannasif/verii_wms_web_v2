export interface ApiResponse<T> {
  success: boolean;
  message: string;
  exceptionMessage: string;
  traceId?: string;
  errorCode?: string;
  details?: unknown;
  data: T;
  errors: string[];
  timestamp: string;
  statusCode: number;
  className: string;
}

export interface PagedFilter {
  column: string;
  operator: string;
  value: string;
}

export interface PagedParams {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: string;
  search?: string;
  filters?: PagedFilter[];
  filterLogic?: 'and' | 'or';
}

export interface PagedResponse<T> {
  data: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
