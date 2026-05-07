/**
 * DLsite ランキング取得クライアント。
 * DLsite のパブリック RSS / JSON ランキングエンドポイントを使用する。
 *
 * アフィリエイトリンク形式: https://www.dlsite.com/maniax/dlaf/=/link/...
 */

import type { DlsiteItem } from "../shared/types.js";

// DLsite の公開ランキング JSON エンドポイント（認証不要）
const RANKING_URL =
  "https://www.dlsite.com/maniax/api/=/rank/type/total/page/1/per/50/format/json";

interface DlsiteRawItem {
  product_id: string;
  work_name: string;
  default_point: number;
  rate_average_2dp?: number;
  rate_count?: number;
  work_type_string?: string;
  image_main?: { url?: string };
}

function buildAffiliateUrl(productId: string): string {
  const affiliateId = process.env.DLSITE_AFFILIATE_ID;
  const base = `https://www.dlsite.com/maniax/work/=/product_id/${productId}.html`;
  if (!affiliateId) return base;
  // DLsite アフィリエイトリンク形式
  return `https://www.dlsite.com/maniax/dlaf/=/aid/${affiliateId}/url/${encodeURIComponent(base)}`;
}

export async function fetchRanking(): Promise<DlsiteItem[]> {
  const res = await fetch(RANKING_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AetherBlack-Portal-Agent/1.0",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`DLsite ranking API ${res.status}: ${res.statusText}`);
  }

  const raw: DlsiteRawItem[] = await res.json();
  const fetchedAt = new Date().toISOString();

  return raw.map((item, i): DlsiteItem => ({
    productId: item.product_id,
    title: item.work_name,
    affiliateUrl: buildAffiliateUrl(item.product_id),
    imageUrl: item.image_main?.url ?? "",
    price: item.default_point,
    reviewCount: item.rate_count ?? 0,
    reviewAverage: item.rate_average_2dp ?? 0,
    rankPosition: i + 1,
    category: item.work_type_string ?? "unknown",
    fetchedAt,
  }));
}
