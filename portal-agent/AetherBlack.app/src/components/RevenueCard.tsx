import type { RevenueSource } from "@/types/revenue";
import { formatJpy, formatUsd } from "@/lib/formatters";

interface Props {
  source: RevenueSource;
}

export default function RevenueCard({ source }: Props) {
  const hasError = Boolean(source.error);

  return (
    <div
      className={`rounded-xl border p-6 ${
        hasError
          ? "border-red-800 bg-red-950"
          : "border-aether-border bg-aether-card"
      }`}
    >
      <h2 className="mb-3 text-base font-semibold text-gray-300">
        {source.name}
      </h2>

      {hasError ? (
        <p className="text-sm text-red-400">{source.error}</p>
      ) : (
        <>
          <p className="text-3xl font-bold text-aether-accent">
            {formatJpy(source.amountJpy)}
          </p>

          {source.originalAmount !== undefined && (
            <p className="mt-1 text-sm text-aether-muted">
              {formatUsd(source.originalAmount)} USD
              {source.exchangeRate !== undefined &&
                ` × ¥${source.exchangeRate.toFixed(2)}/USD`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
