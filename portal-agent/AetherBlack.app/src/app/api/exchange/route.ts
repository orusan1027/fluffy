import { NextResponse } from "next/server";
import { getUsdToJpy } from "@/lib/exchangeRate";

export async function GET() {
  try {
    const rate = await getUsdToJpy();
    const cacheTtl = Number(process.env.REVENUE_CACHE_TTL ?? 3600);
    return NextResponse.json(
      { usdToJpy: rate, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": `s-maxage=${cacheTtl}, stale-while-revalidate` } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 }
    );
  }
}
