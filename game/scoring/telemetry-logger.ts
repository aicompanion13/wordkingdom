import type { TelemetryRecord } from "./types";

const DEFAULT_KEY = "word-kingdom-scoring-telemetry";

export class TelemetryLogger {
  constructor(private readonly storage: Storage, private readonly key = DEFAULT_KEY) {}

  append(record: TelemetryRecord): void {
    const records = this.read();
    records.push(record);
    this.storage.setItem(this.key, JSON.stringify(records.slice(-250)));
  }

  read(): TelemetryRecord[] {
    try {
      const value = this.storage.getItem(this.key);
      return value ? JSON.parse(value) as TelemetryRecord[] : [];
    } catch {
      return [];
    }
  }

  export(): string {
    return JSON.stringify(this.read(), null, 2);
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}
