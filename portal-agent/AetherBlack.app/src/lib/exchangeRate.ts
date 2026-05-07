export class ExchangeRateError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ExchangeRateError";
  }
}

interface OpenExchangeResponse {
  result: string;
  rates: Record<string, number>;
}

export async function getUsdToJpy(
  cacheTtl = Number(process.env.REVENUE_CACHE_TTL ?? 3600)
): Promise<number> {
  const url =
    process.env.EXCHANGE_RATE_API_URL ??
    "https://open.er-api.com/v6/latest/USD";

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: cacheTtl } });
  } catch (err) {
    throw new ExchangeRateError("Failed to reach exchange rate API", err);
  }

  if (!res.ok) {
    throw new ExchangeRateError(
      `Exchange rate API returned ${res.status}: ${res.statusText}`
    );
  }

  const data: OpenExchangeResponse = await res.json();
  const rate = data.rates["JPY"];

  if (typeof rate !== "number") {
    throw new ExchangeRateError("JPY rate missing from exchange rate response");
  }

  return rate;
}
