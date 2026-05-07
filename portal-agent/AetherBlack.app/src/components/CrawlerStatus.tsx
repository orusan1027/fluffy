/**
 * Project_Ledger.json のクローラーステータスを表示するコンポーネント。
 * 各タスクの最終実行時刻・ステータス・エラーを一覧表示する。
 */

import type { Ledger, TaskEntry, TaskStatus } from "@/types/ledger";

interface Props {
  ledger: Ledger | null;
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  ok: "bg-green-900/40 text-green-400 border-green-800",
  error: "bg-red-900/40 text-red-400 border-red-800",
  running: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
  pending: "bg-gray-900/40 text-gray-400 border-gray-700",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  ok: "正常",
  error: "エラー",
  running: "実行中",
  pending: "待機中",
};

function TaskRow({
  label,
  entry,
}: {
  label: string;
  entry: TaskEntry | undefined;
}) {
  if (!entry) {
    return (
      <div className="flex items-center justify-between py-2 text-sm text-aether-muted">
        <span>{label}</span>
        <span className="text-xs">未実行</span>
      </div>
    );
  }

  const style = STATUS_STYLES[entry.status];

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${style}`}
        >
          {STATUS_LABELS[entry.status]}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-aether-muted">
        <span>
          最終実行:{" "}
          {entry.lastRun
            ? new Date(entry.lastRun).toLocaleString("ja-JP", {
                timeZone: "Asia/Tokyo",
              })
            : "—"}
        </span>
        <span>取得件数: {entry.itemsProcessed}</span>
      </div>
      {entry.errors.length > 0 && (
        <p className="text-xs text-red-400">{entry.errors[0]}</p>
      )}
    </div>
  );
}

export default function CrawlerStatus({ ledger }: Props) {
  return (
    <div className="rounded-xl border border-aether-border bg-aether-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-aether-muted">
          クローラーステータス
        </h2>
        {ledger && (
          <span className="text-xs text-aether-muted">
            更新: {new Date(ledger.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </span>
        )}
      </div>

      <div className="divide-y divide-aether-border">
        <TaskRow label="DMM/FANZA クローラー" entry={ledger?.tasks.dmm_crawler} />
        <TaskRow label="DLsite ブリッジ" entry={ledger?.tasks.dlsite_crawler} />
      </div>
    </div>
  );
}
