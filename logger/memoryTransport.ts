// src/logger/memoryTransport.ts
import Transport, { TransportStreamOptions } from "winston-transport";

export interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
  [key: string]: any;
}

export default class MemoryTransport extends Transport {
  private logs: LogEntry[] = [];

  constructor(opts?: TransportStreamOptions) {
    super(opts);
  }

  log(info: LogEntry, callback: () => void): void {
    // filtra: registra solo se mail_log===true
    if (!info.mail_log) {
      // chiama sempre la callback per non bloccare Winston
      return callback();
    }

    // 1) push solo dei log con mail_log
    this.logs.push(info);

    // 2) emetti logged
    setImmediate(() => this.emit("logged", info));

    // 3) ok a Winston
    callback();
  }

  getLogSummary(): string {
    return this.logs
      .map(({ timestamp, level, message }) => {
        const t = timestamp || new Date().toISOString();
        return `${t} ${level}: ${message}`;
      })
      .join("\n");
  }

  clearLogs(): void {
    this.logs = [];
  }
}
