export class DmmApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DmmApiError";
  }
}

export interface DmmEarnings {
  totalJpy: number;
  period: string;
}

// DMM Affiliate API v3 — earnings are already in JPY.
export async function getDmmEarnings(
  cacheTtl = Number(process.env.REVENUE_CACHE_TTL ?? 3600)
): Promise<DmmEarnings> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new DmmApiError(
      "DMM_API_ID or DMM_AFFILIATE_ID environment variable is missing"
    );
  }

  const url = new URL("https://affiliate.api.dmm.com/affiliate/v3/sales");
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("output", "json");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: cacheTtl },
    });
  } catch (err) {
    throw new DmmApiError("Failed to reach DMM Affiliate API", err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DmmApiError(`DMM API error ${res.status}: ${body}`);
  }

  // Response shape follows DMM Affiliate API v3 conventions.
  // Exact field names should be verified against the DMM developer docs.
  const data = await res.json();
  const sales = data?.result?.sales;

  return {
    totalJpy: Number(sales?.total_amount ?? 0),
    period: String(sales?.period ?? "unknown"),
  };
}
