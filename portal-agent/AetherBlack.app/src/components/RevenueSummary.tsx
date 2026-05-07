import { formatJpy } from "@/lib/formatters";

interface Props {
  totalJpy: number;
}

export default function RevenueSummary({ totalJpy }: Props) {
  return (
    <div className="mb-8 rounded-2xl border border-aether-accent/30 bg-gradient-to-br from-gray-900 to-black p-8 text-center">
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-aether-muted">
        合計収益（円）
      </p>
      <p className="text-5xl font-extrabold text-aether-accent">
        {formatJpy(totalJpy)}
      </p>
    </div>
  );
}
