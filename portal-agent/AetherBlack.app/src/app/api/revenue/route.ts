import { NextResponse } from "next/server";
import { getDmmEarnings } from "@/lib/dmm";
import { getFabEarnings } from "@/lib/fab";
import { getUsdToJpy } from "@/lib/exchangeRate";
import type { RevenueReport, RevenueSource } from "@/types/revenue";

const FALLBACK_USD_TO_JPY = 150;

// JSON API endpoint — useful for external consumers or a refresh button.
// Cached for REVENUE_CACHE_TTL seconds (default 1 hour).
export async function GET() {
  const fetchedAt = new Date().toISOString();

  const [rateResult, dmmResult, fabResult] = await Promise.allSettled([
    getUsdToJpy(),
    getDmmEarnings(),
    getFabEarnings(),
  ]);

  const usdToJpy =
    rateResult.status === "fulfilled" ? rateResult.value : null;

  const sources: RevenueSource[] = [];
  const warnings: string[] = [];

  if (dmmResult.status === "fulfilled") {
    sources.push({ name: "DMM Affiliate", amountJpy: dmmResult.value.totalJpy });
  } else {
    const msg = (dmmResult.reason as Error).message;
    warnings.push(`DMM: ${msg}`);
    sources.push({ name: "DMM Affiliate", amountJpy: 0, error: msg });
  }

  if (fabResult.status === "fulfilled") {
    const rate = usdToJpy ?? FALLBACK_USD_TO_JPY;
    sources.push({
      name: "Fab.com",
      amountJpy: Math.round(fabResult.value.totalUsd * rate),
      originalAmount: fabResult.value.totalUsd,
      originalCurrency: "USD",
      exchangeRate: rate,
    });
  } else {
    const msg = (fabResult.reason as Error).message;
    warnings.push(`Fab.com: ${msg}`);
    sources.push({ name: "Fab.com", amountJpy: 0, error: msg });
  }

  if (rateResult.status === "rejected") {
    warnings.push(
      `Exchange rate fetch failed — fallback ¥${FALLBACK_USD_TO_JPY}/USD used`
    );
  }

  const report: RevenueReport = {
    sources,
    totalJpy: sources.reduce((sum, s) => sum + s.amountJpy, 0),
    fetchedAt,
    warnings,
  };

  const cacheTtl = Number(process.env.REVENUE_CACHE_TTL ?? 3600);
  return NextResponse.json(report, {
    headers: { "Cache-Control": `s-maxage=${cacheTtl}, stale-while-revalidate` },
  });
}
