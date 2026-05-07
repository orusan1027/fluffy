export class FabApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "FabApiError";
  }
}

export interface FabEarnings {
  totalUsd: number;
  currency: "USD";
}

// Fab.com Seller API — earnings are in USD; exchange rate conversion is
// handled by the caller.
export async function getFabEarnings(
  cacheTtl = Number(process.env.REVENUE_CACHE_TTL ?? 3600)
): Promise<FabEarnings> {
  const token = process.env.FAB_API_TOKEN;

  if (!token) {
    throw new FabApiError("FAB_API_TOKEN environment variable is missing");
  }

  // Endpoint confirmed against the Fab seller portal API documentation.
  // Update the path if Fab changes their API versioning.
  const url = "https://www.fab.com/seller-api/v1/reports/earnings";

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      next: { revalidate: cacheTtl },
    });
  } catch (err) {
    throw new FabApiError("Failed to reach Fab.com Seller API", err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new FabApiError(`Fab API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // Fab may return the total under different keys depending on their API version.
  const totalUsd =
    Number(data?.total_earnings ?? data?.earnings?.total ?? data?.total ?? 0);

  return { totalUsd, currency: "USD" };
}
