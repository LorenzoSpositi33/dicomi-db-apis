// src/logger/memoryTransport.ts
import Transport, { TransportStreamOptions } from "winston-transport";

// Definiamo qui l’interfaccia LogEntry
export interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
  [key: string]: any;
}

export default class MemoryTransport extends Transport {
  // 1) dichiariamo correttamente il buffer
  private _logs: LogEntry[] = [];

  constructor(opts?: TransportStreamOptions) {
    super(opts);
  }

  // 2) implementiamo log() con tipi
  log(info: LogEntry, callback: () => void): void {
    if (!info.mail_log) {
      return callback();
    }
    this._logs.push(info);
    setImmediate(() => this.emit("logged", info));
    callback();
  }

  // 3) getter per recuperare le entry
  public getLogEntries(): LogEntry[] {
    return this._logs;
  }

  // 4) riepilogo in stringa
  public getLogSummary(): string {
    return this._logs
      .map(({ timestamp, level, message }) => {
        const t = timestamp ?? new Date().toISOString();
        return `${t} ${level}: ${message}`;
      })
      .join("\n");
  }

  public clearLogs(): void {
    this._logs = [];
  }
}
