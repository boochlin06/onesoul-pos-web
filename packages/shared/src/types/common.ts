/**
 * Standard API Envelope and Common Types
 */

export interface StandardSuccessResponse<T> {
  success: true;
  data: T;
  traceId?: string;
  message?: string;
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  traceId?: string;
}

export type StandardResponse<T> = StandardSuccessResponse<T> | StandardErrorResponse;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
