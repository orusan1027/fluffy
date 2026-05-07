import fs from "node:fs/promises";
import path from "node:path";
import type { RevenueReport, RevenueSource } from "@/types/revenue";
import type { Ledger } from "@/types/ledger";
import { getDmmEarnings } from "@/lib/dmm";
import { getFabEarnings } from "@/lib/fab";
import { getDlsiteEarnings } from "@/lib/dlsite";
import { getUsdToJpy } from "@/lib/exchangeRate";
import RevenueCard from "@/components/RevenueCard";
import RevenueSummary from "@/components/RevenueSummary";
import LastUpdated from "@/components/LastUpdated";
import ErrorBanner from "@/components/ErrorBanner";
import CrawlerStatus from "@/components/CrawlerStatus";

// ISR: revalidate cached page every hour.
export const revalidate = 3600;

export const metadata = {
  title: "Revenue Check — AetherBlack",
};

const FALLBACK_USD_TO_JPY = 150;

async function readLedger(): Promise<Ledger | null> {
  try {
    const ledgerPath = path.resolve(
      process.env.LEDGER_PATH ?? "portal-agent/Project_Ledger.json"
    );
    const raw = await fs.readFile(ledgerPath, "utf-8");
    return JSON.parse(raw) as Ledger;
  } catch {
    return null;
  }
}

export default async function RevenuePage() {
  const fetchedAt = new Date().toISOString();

  // Fetch all APIs and the ledger in parallel.
  const [rateResult, dmmResult, fabResult, dlsiteResult, ledger] =
    await Promise.all([
      Promise.allSettled([getUsdToJpy()]).then((r) => r[0]),
      Promise.allSettled([getDmmEarnings()]).then((r) => r[0]),
      Promise.allSettled([getFabEarnings()]).then((r) => r[0]),
      Promise.allSettled([getDlsiteEarnings()]).then((r) => r[0]),
      readLedger(),
    ]);

  const usdToJpy =
    rateResult.status === "fulfilled" ? rateResult.value : null;

  const sources: RevenueSource[] = [];
  const warnings: string[] = [];

  // ── DMM Affiliate (JPY) ───────────────────────────────────────────────────
  if (dmmResult.status === "fulfilled") {
    sources.push({
      name: "DMM Affiliate",
      amountJpy: dmmResult.value.totalJpy,
    });
  } else {
    const msg = (dmmResult.reason as Error).message;
    warnings.push(`DMM: ${msg}`);
    sources.push({ name: "DMM Affiliate", amountJpy: 0, error: msg });
  }

  // ── DLsite (JPY 推定) ─────────────────────────────────────────────────────
  if (dlsiteResult.status === "fulfilled") {
    sources.push({
      name: "DLsite（推定）",
      amountJpy: dlsiteResult.value.estimatedJpy,
    });
  } else {
    const msg = (dlsiteResult.reason as Error).message;
    warnings.push(`DLsite: ${msg}`);
    sources.push({ name: "DLsite（推定）", amountJpy: 0, error: msg });
  }

  // ── Fab.com (USD → JPY) ───────────────────────────────────────────────────
  if (fabResult.status === "fulfilled") {
    const rate = usdToJpy ?? FALLBACK_USD_TO_JPY;
    const amountJpy = Math.round(fabResult.value.totalUsd * rate);
    sources.push({
      name: "Fab.com",
      amountJpy,
      originalAmount: fabResult.value.totalUsd,
      originalCurrency: "USD",
      exchangeRate: rate,
    });
  } else {
    const msg = (fabResult.reason as Error).message;
    warnings.push(`Fab.com: ${msg}`);
    sources.push({ name: "Fab.com", amountJpy: 0, error: msg });
  }

  // ── Exchange rate warning ─────────────────────────────────────────────────
  if (rateResult.status === "rejected") {
    warnings.push(
      `為替レート取得失敗 — フォールバック ¥${FALLBACK_USD_TO_JPY}/USD を使用。` +
        ` (${(rateResult.reason as Error).message})`
    );
  }

  const totalJpy = sources.reduce((sum, s) => sum + s.amountJpy, 0);
  const report: RevenueReport = { sources, totalJpy, fetchedAt, warnings };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-aether-muted">
          AetherBlack
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-white">
          Revenue Check
        </h1>
        <p className="mt-2 text-sm text-aether-muted">
          DMM・DLsite・Fab.com 収益合算（日本円）
        </p>
      </header>

      {report.warnings.length > 0 && <ErrorBanner errors={report.warnings} />}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {report.sources.map((source) => (
          <RevenueCard key={source.name} source={source} />
        ))}
      </div>

      <RevenueSummary totalJpy={report.totalJpy} />

      <div className="mt-8">
        <CrawlerStatus ledger={ledger} />
      </div>

      <LastUpdated fetchedAt={report.fetchedAt} />
    </main>
  );
}
