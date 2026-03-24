export type TimerCallback = () => void;

export class TimerManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private startTimes = new Map<string, number>();
  private durations = new Map<string, number>();

  start(userId: string, ms: number, onExpire: TimerCallback): void {
    this.clear(userId);
    this.startTimes.set(userId, Date.now());
    this.durations.set(userId, ms);
    const handle = setTimeout(() => {
      this.timers.delete(userId);
      this.startTimes.delete(userId);
      this.durations.delete(userId);
      onExpire();
    }, ms);
    this.timers.set(userId, handle);
  }

  clear(userId: string): void {
    const handle = this.timers.get(userId);
    if (handle !== undefined) clearTimeout(handle);
    this.timers.delete(userId);
    this.startTimes.delete(userId);
    this.durations.delete(userId);
  }

  clearAll(): void {
    for (const handle of this.timers.values()) clearTimeout(handle);
    this.timers.clear();
    this.startTimes.clear();
    this.durations.clear();
  }

  /** Returns remaining milliseconds, or 0 if no timer running */
  getRemainingMs(userId: string): number {
    const start = this.startTimes.get(userId);
    const duration = this.durations.get(userId);
    if (start === undefined || duration === undefined) return 0;
    return Math.max(0, duration - (Date.now() - start));
  }

  isRunning(userId: string): boolean {
    return this.timers.has(userId);
  }
}
