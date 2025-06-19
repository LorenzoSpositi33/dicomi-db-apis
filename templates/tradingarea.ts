import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";

export interface TradingAreaRow {
  pv: string;
  brand: string;
  addr: string;
  prod: string;
  self: number;
  serv: number;
  close: number;
}

export interface TradingAreaStats {
  reportDate: string;
  totalRows: number;
  modified: number;
  skipped: number;
  errored: number;
  rows: TradingAreaRow[];
  logDump: string;    // per includere il dump dei log
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../logger/summary-tradingarea.html");
const tplSrc = fs.readFileSync(templatePath, "utf8");
// Compiliamo una sola volta il template Handlebars
const tpl = Handlebars.compile<TradingAreaStats>(tplSrc);

/**
 * Costruisce l'HTML completo del report Trading Area usando Handlebars
 * @param stats - oggetto con reportDate, totalRows, modified, skipped, errored, rows, logDump
 */
export function buildTradingAreaHtml(stats: TradingAreaStats): string {
  return tpl(stats);
}
