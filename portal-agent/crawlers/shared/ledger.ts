/**
 * Project_Ledger.json の読み書きユーティリティ。
 * 各クローラーのステータス・エラー・最終実行時刻を永続化する。
 */

import fs from "node:fs/promises";
import path from "node:path";

export type TaskStatus = "ok" | "error" | "running" | "pending";

export interface TaskEntry {
  lastRun: string;       // ISO 8601 UTC
  nextRun: string;
  status: TaskStatus;
  message: string;
  itemsProcessed: number;
  errors: string[];
}

export interface Ledger {
  updatedAt: string;
  tasks: {
    dmm_crawler?: TaskEntry;
    dlsite_crawler?: TaskEntry;
  };
}

const LEDGER_PATH = path.resolve(
  process.env.LEDGER_PATH ?? "portal-agent/Project_Ledger.json"
);

async function read(): Promise<Ledger> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf-8");
    return JSON.parse(raw) as Ledger;
  } catch {
    return { updatedAt: new Date().toISOString(), tasks: {} };
  }
}

async function write(ledger: Ledger): Promise<void> {
  ledger.updatedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf-8");
}

export async function updateTask(
  taskName: keyof Ledger["tasks"],
  patch: Partial<TaskEntry>
): Promise<void> {
  const ledger = await read();
  const existing = ledger.tasks[taskName] ?? {
    lastRun: "",
    nextRun: "",
    status: "pending" as TaskStatus,
    message: "",
    itemsProcessed: 0,
    errors: [],
  };
  ledger.tasks[taskName] = { ...existing, ...patch };
  await write(ledger);
}

export async function readLedger(): Promise<Ledger> {
  return read();
}
