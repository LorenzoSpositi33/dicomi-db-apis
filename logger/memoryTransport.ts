// src/logger/memoryTransport.ts
import Transport, { TransportStreamOptions } from "winston-transport";

export interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
  [key: string]: any;
}

export default class MemoryTransport extends Transport {
  private _logs: LogEntry[] = [];

  constructor(opts?: TransportStreamOptions) {
    super(opts);
  }

  // Registra solo warn ed error
  log(info: LogEntry, callback: () => void): void {
    if (info.level !== "warn" && info.level !== "error") {
      return callback();
    }
    this._logs.push(info);
    setImmediate(() => this.emit("logged", info));
    callback();
  }

  public getLogEntries(): LogEntry[] {
    return this._logs;
  }

  // Restituisce summary con header e footer dinamici
  public getLogSummary(): string {
    if (this._logs.length === 0) {
      return '';
    }

    // Ordina le entry per timestamp
    const sorted = this._logs
      .slice()
      .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

    // Formatta date
    const format = (ts: string) => new Date(ts)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    const header = `${format(sorted[0].timestamp!)} info: 🚀 Script avviato con successo`;
    const footer = `${format(sorted[sorted.length - 1].timestamp!)} info: 🚀 Estrazione terminata con successo`;

    // Mappa ogni entry a "YYYY-MM-DD HH:mm:ss emoji motivo"
    const body = sorted.map(info => {
      const date = format(info.timestamp!);
      const emoji = info.level === 'warn' ? '⚠️' : '❌';
      // estrai motivo prima di ' per '
      const match = info.message.match(/^(.*?)\s+per\s+/i);
      const reason = match ? match[1] : info.message;
      return `${date} ${emoji} ${reason}`;
    });

    return [header, ...body, footer].join('\n');
  }

  public clearLogs(): void {
    this._logs = [];
  }
}
