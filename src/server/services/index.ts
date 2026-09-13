import "server-only";

/**
 * Server domain services boundary.
 * Encapsulates server-only business domain operations, transactions, and security checks.
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface BaseService {
  readonly serviceName: string;
}
