import Transport from "winston-transport";

interface MemoryTransportOptions extends Transport.TransportStreamOptions {}

class MemoryTransport extends Transport {
  private logs: Array<{ timestamp?: string; level: string; message: string }>; // Tipizzazione array di log

  constructor(opts: MemoryTransportOptions = {}) {
    super(opts);
    this.logs = []; // Array per salvare i log
  }

  log(
    info: { timestamp?: string; level: string; message: string },
    callback: () => void
  ): void {
    // Usa setImmediate per rispettare l'aspetto asincrono richiesto da Winston
    setImmediate(() => {
      this.logs.push(info); // Salva il log in memoria
      this.emit("logged", info);
    });
    callback();
  }

  // Metodo per ottenere un riepilogo dei log in una stringa
  getLogSummary(): string {
    return this.logs
      .map((log) => `${log.timestamp ?? ""} ${log.level}: ${log.message}`)
      .join("\n");
  }
}

export default MemoryTransport;
