import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import MemoryTransport from "./memoryTransport.js";


// Ottieni il percorso corrente del file (per ES module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instanza di MemoryTransport per accumulare i log destinati alla mail
export const memoryTransport = new MemoryTransport({ level: "info" });

// Configura Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : "";
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // mantiene i colori
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "logs", "app.log"),
      maxsize: 500 * 1024 * 1024, // 500MB
      maxFiles: 30,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
        })
      ),
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "logs", "errors.log"),
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaString = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
        })
      ),
    }),
    // Transport in memoria per il dump email (filtra internamente mail_log)
    memoryTransport
  ],
});

export { logger };
