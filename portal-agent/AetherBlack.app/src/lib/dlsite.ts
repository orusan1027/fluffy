/**
 * DLsite 収益（仮）取得クライアント。
 *
 * DLsite は公式の収益 API を一般公開していないため、
 * このモジュールはポータル自身が集計した推定収益を取得する。
 * DLSITE_ESTIMATED_REVENUE_JPY を環境変数で直接設定するか、
 * PORTAL_BASE_URL 経由で内部 API から取得する。
 */

export class DlsiteApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DlsiteApiError";
  }
}

export interface DlsiteEarnings {
  estimatedJpy: number;
  note: string;
}

export async function getDlsiteEarnings(
  cacheTtl = Number(process.env.REVENUE_CACHE_TTL ?? 3600)
): Promise<DlsiteEarnings> {
  // 環境変数から直接設定された場合はそれを返す（手動入力モード）
  const manual = process.env.DLSITE_ESTIMATED_REVENUE_JPY;
  if (manual) {
    return {
      estimatedJpy: Number(manual),
      note: "手動設定値（環境変数 DLSITE_ESTIMATED_REVENUE_JPY）",
    };
  }

  // ポータル内部 API から取得する場合
  const baseUrl = process.env.PORTAL_BASE_URL;
  const apiKey = process.env.PORTAL_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new DlsiteApiError(
      "DLsite 収益の取得には DLSITE_ESTIMATED_REVENUE_JPY または " +
        "PORTAL_BASE_URL + PORTAL_API_KEY が必要です"
    );
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/revenue/dlsite`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new DlsiteApiError("DLsite 収益 API への接続に失敗しました", err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DlsiteApiError(`DLsite 収益 API エラー ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    estimatedJpy: Number(data?.estimated_revenue_jpy ?? 0),
    note: "ポータル集計値（推定）",
  };
}
