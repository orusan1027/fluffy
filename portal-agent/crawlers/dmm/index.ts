/**
 * DMM/FANZA 新着・人気商品 定期取得スクリプト。
 * node-cron で 1 時間ごとに実行し、結果を Project_Ledger.json へ記録する。
 *
 * 単体実行:
 *   node --loader ts-node/esm crawlers/dmm/index.ts
 *
 * デーモン起動（cron 有効）:
 *   DMM_CRON_MODE=1 node --loader ts-node/esm crawlers/dmm/index.ts
 */

import cron from "node-cron";
import { fetchNewArrivals, fetchPopular } from "./client.js";
import { updateTask } from "../shared/ledger.js";
import type { DmmItem } from "../shared/types.js";

const CRON_MODE = process.env.DMM_CRON_MODE === "1";
const SCHEDULE = "0 * * * *"; // 毎時 0 分

function nextRunAt(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function log(msg: string): void {
  console.log(`[DMM Crawler][${new Date().toISOString()}] ${msg}`);
}

export async function runCrawl(): Promise<void> {
  const startedAt = new Date().toISOString();
  log("Starting crawl...");

  await updateTask("dmm_crawler", {
    status: "running",
    lastRun: startedAt,
    message: "Crawl in progress",
    errors: [],
  });

  const errors: string[] = [];
  let itemsProcessed = 0;

  try {
    const [newArrivals, popular] = await Promise.all([
      fetchNewArrivals({ hits: 50 }),
      fetchPopular({ hits: 20 }),
    ]);

    const allItems: DmmItem[] = [
      ...newArrivals.video,
      ...newArrivals.doujin,
      ...popular.video,
      ...popular.doujin,
    ];

    itemsProcessed = allItems.length;

    log(`Fetched ${newArrivals.video.length} new video items`);
    log(`Fetched ${newArrivals.doujin.length} new doujin items`);
    log(`Fetched ${popular.video.length} popular video items`);
    log(`Fetched ${popular.doujin.length} popular doujin items`);

    // 結果をポータルへ送信
    await postToPortal(allItems);

    await updateTask("dmm_crawler", {
      status: "ok",
      lastRun: startedAt,
      nextRun: nextRunAt(),
      message: `OK — ${itemsProcessed} items fetched and posted`,
      itemsProcessed,
      errors: [],
    });

    log(`Crawl complete. ${itemsProcessed} items processed.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    log(`ERROR: ${msg}`);

    await updateTask("dmm_crawler", {
      status: "error",
      lastRun: startedAt,
      nextRun: nextRunAt(),
      message: `Error: ${msg}`,
      itemsProcessed,
      errors,
    });
  }
}

async function postToPortal(items: DmmItem[]): Promise<void> {
  const baseUrl = process.env.PORTAL_BASE_URL;
  const portalId = process.env.PORTAL_ID ?? "6";
  const apiKey = process.env.PORTAL_API_KEY;

  if (!baseUrl || !apiKey) {
    log("PORTAL_BASE_URL or PORTAL_API_KEY not set — skipping portal post");
    return;
  }

  const endpoint = `${baseUrl}/api/portals/${portalId}/items/bulk`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ source: "dmm", items }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Portal POST failed ${res.status}: ${body}`);
  }

  log(`Posted ${items.length} items to portal ${portalId}`);
}

if (CRON_MODE) {
  log(`Scheduler starting. Cron: "${SCHEDULE}"`);
  // 起動直後に 1 回実行
  void runCrawl();
  cron.schedule(SCHEDULE, () => void runCrawl(), { timezone: "Asia/Tokyo" });
} else {
  // 単発実行
  void runCrawl().then(() => process.exit(0));
}
