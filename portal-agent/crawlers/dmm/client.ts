/**
 * DMM Affiliate API v3 クライアント。
 * 「動画（ビデオ）」と「同人」カテゴリの新着・人気商品を取得する。
 *
 * API ドキュメント: https://affiliate.api.dmm.com/affiliate/v3/
 */

import type { DmmItem } from "../shared/types.js";

const BASE_URL = "https://affiliate.api.dmm.com/affiliate/v3/ItemList";

// DMM サイト識別子
const SITE_FANZA = "FANZA";

// フロア識別子（v3 API の floor パラメータ）
const FLOOR_VIDEO = "videoa";    // アダルト動画
const FLOOR_DOUJIN = "doujin";   // 同人

export interface FetchOptions {
  hits?: number;       // 取得件数 (max 100)
  sort?: "date" | "rank" | "review" | "price" | "-price";
  keyword?: string;
}

interface DmmApiItem {
  content_id: string;
  title: string;
  URL: string;
  affiliateURL: string;
  imageURL?: { list?: string; small?: string };
  prices?: { price?: string };
  review?: { count?: number; average?: number };
  iteminfo?: {
    genre?: Array<{ name: string }>;
    actress?: Array<{ name: string }>;
  };
  sampleImageURL?: { sample_s?: { image?: string[] } };
}

interface DmmApiResponse {
  result: {
    status: number;
    items?: DmmApiItem[];
    total_count?: number;
  };
}

async function fetchFloor(
  floor: string,
  options: FetchOptions,
  cacheTtl: number
): Promise<DmmItem[]> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error("DMM_API_ID or DMM_AFFILIATE_ID env var missing");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("api_id", apiId);
  url.searchParams.set("affiliate_id", affiliateId);
  url.searchParams.set("site", SITE_FANZA);
  url.searchParams.set("service", "digital");
  url.searchParams.set("floor", floor);
  url.searchParams.set("hits", String(options.hits ?? 30));
  url.searchParams.set("sort", options.sort ?? "date");
  url.searchParams.set("output", "json");
  if (options.keyword) url.searchParams.set("keyword", options.keyword);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    // Node.js fetch does not support Next.js `next` option, use standard cache
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DMM API ${res.status} for floor=${floor}: ${body}`);
  }

  const data: DmmApiResponse = await res.json();

  if (data.result.status !== 200) {
    throw new Error(`DMM API result status ${data.result.status} for floor=${floor}`);
  }

  const items = data.result.items ?? [];
  const fetchedAt = new Date().toISOString();

  return items.map((item): DmmItem => ({
    contentId: item.content_id,
    title: item.title,
    affiliateUrl: item.affiliateURL ?? item.URL,
    imageUrl: item.imageURL?.list ?? item.imageURL?.small ?? "",
    sampleImageUrl: item.sampleImageURL?.sample_s?.image?.[0],
    price: Number(item.prices?.price?.replace(/[^\d]/g, "") ?? 0),
    reviewCount: item.review?.count ?? 0,
    reviewAverage: Number(item.review?.average ?? 0),
    category: floor === FLOOR_DOUJIN ? "doujin" : "video",
    genres: item.iteminfo?.genre?.map((g) => g.name) ?? [],
    actresses: item.iteminfo?.actress?.map((a) => a.name) ?? [],
    fetchedAt,
  }));
}

export async function fetchNewArrivals(
  options: FetchOptions = {},
  cacheTtl = 3600
): Promise<{ video: DmmItem[]; doujin: DmmItem[] }> {
  const [video, doujin] = await Promise.all([
    fetchFloor(FLOOR_VIDEO, { ...options, sort: "date" }, cacheTtl),
    fetchFloor(FLOOR_DOUJIN, { ...options, sort: "date" }, cacheTtl),
  ]);
  return { video, doujin };
}

export async function fetchPopular(
  options: FetchOptions = {},
  cacheTtl = 3600
): Promise<{ video: DmmItem[]; doujin: DmmItem[] }> {
  const [video, doujin] = await Promise.all([
    fetchFloor(FLOOR_VIDEO, { ...options, sort: "rank" }, cacheTtl),
    fetchFloor(FLOOR_DOUJIN, { ...options, sort: "rank" }, cacheTtl),
  ]);
  return { video, doujin };
}
