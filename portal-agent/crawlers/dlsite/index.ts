/**
 * DLsite ランキング → 漆黒ポータル（ID: 6）自動投稿ブリッジ。
 * 1 時間ごとに DLsite のランキングを取得し、ポータル API へ送信する。
 *
 * 単体実行:
 *   node --loader ts-node/esm crawlers/dlsite/index.ts
 *
 * デーモン起動:
 *   DLSITE_CRON_MODE=1 node --loader ts-node/esm crawlers/dlsite/index.ts
 */

import cron from "node-cron";
import { fetchRanking } from "./client.js";
import { updateTask } from "../shared/ledger.js";
import type { DlsiteItem } from "../shared/types.js";

const CRON_MODE = process.env.DLSITE_CRON_MODE === "1";
const SCHEDULE = "15 * * * *"; // 毎時 15 分（DMM と分散）

function nextRunAt(): string {
  const d = new Date();
  d.setMinutes(15, 0, 0);
  if (d <= new Date()) d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function log(msg: string): void {
  console.log(`[DLsite Bridge][${new Date().toISOString()}] ${msg}`);
}

export async function runBridge(): Promise<void> {
  const startedAt = new Date().toISOString();
  log("Starting ranking fetch...");

  await updateTask("dlsite_crawler", {
    status: "running",
    lastRun: startedAt,
    message: "Fetch in progress",
    errors: [],
  });

  const errors: string[] = [];
  let itemsProcessed = 0;

  try {
    const items = await fetchRanking();
    itemsProcessed = items.length;
    log(`Fetched ${itemsProcessed} ranking items`);

    await postToPortal(items);

    await updateTask("dlsite_crawler", {
      status: "ok",
      lastRun: startedAt,
      nextRun: nextRunAt(),
      message: `OK — ${itemsProcessed} items posted`,
      itemsProcessed,
      errors: [],
    });

    log(`Bridge complete. ${itemsProcessed} items posted to portal.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    log(`ERROR: ${msg}`);

    await updateTask("dlsite_crawler", {
      status: "error",
      lastRun: startedAt,
      nextRun: nextRunAt(),
      message: `Error: ${msg}`,
      itemsProcessed,
      errors,
    });
  }
}

async function postToPortal(items: DlsiteItem[]): Promise<void> {
  const baseUrl = process.env.PORTAL_BASE_URL;
  const portalId = process.env.PORTAL_ID ?? "6";
  const apiKey = process.env.PORTAL_API_KEY;

  if (!baseUrl || !apiKey) {
    log("PORTAL_BASE_URL or PORTAL_API_KEY not set — skipping portal post");
    return;
  }

  const endpoint = `${baseUrl}/api/portals/${portalId}/items/bulk`;

  // ランキング上位 30 件のみ投稿
  const topItems = items.slice(0, 30);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ source: "dlsite", items: topItems }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Portal POST failed ${res.status}: ${body}`);
  }

  log(`Posted top ${topItems.length} DLsite items to portal ${portalId}`);
}

if (CRON_MODE) {
  log(`Bridge scheduler starting. Cron: "${SCHEDULE}"`);
  void runBridge();
  cron.schedule(SCHEDULE, () => void runBridge(), { timezone: "Asia/Tokyo" });
} else {
  void runBridge().then(() => process.exit(0));
}
