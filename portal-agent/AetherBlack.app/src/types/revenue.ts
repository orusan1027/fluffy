export interface RevenueSource {
  name: string;
  amountJpy: number;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  error?: string;
}

export interface RevenueReport {
  sources: RevenueSource[];
  totalJpy: number;
  fetchedAt: string; // ISO 8601 UTC
  warnings: string[];
}
