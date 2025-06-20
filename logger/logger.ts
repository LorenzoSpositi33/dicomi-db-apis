import { createLogger, format, transports } from "winston";
import path from "path";
import { fileURLToPath } from "url";
import MemoryTransport from "./memoryTransport.js";

const { combine, timestamp, printf, colorize } = format;

// Icone da usare nei log:
// ✅ Successo (info)
// ❌ Errore (error)
// ⚠️ Avviso (warn)
// 📢 Informazione (info)
// 🐛 Debug (debug)

// Ottieni il percorso corrente del file (per ES module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// formattazione unica (aggiunge timestamp in info.timestamp)
const myFormat = printf(({ timestamp, level, message, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
});

// istanza singola, sempre la stessa
export const memoryTransport = new MemoryTransport({ level: "debug" });

export const logger = createLogger({
  level: "debug",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
  transports: [
    // console: solo info+ (no debug)
    new transports.Console({
      level: "info",
      format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
    }),

    // file per tutti i log di livello info e superiore
    new transports.File({
      filename: path.join(__dirname, "..", "logs", "app.log"),
      level: "info",
      format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
    }),

    // file per gli errori
    new transports.File({
      filename: path.join(__dirname, "..", "logs", "error.log"),
      level: "error",
      format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
    }),

    // file per i debug (tutti i debug)
    new transports.File({
      filename: path.join(__dirname, "..", "logs", "debug.log"),
      level: "debug",
      format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
    }),

    // infine, il memory transport (che tu filtri internamente via mail_log)
    memoryTransport,
  ],
});
