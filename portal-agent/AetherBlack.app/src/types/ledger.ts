export type TaskStatus = "ok" | "error" | "running" | "pending";

export interface TaskEntry {
  lastRun: string;
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
