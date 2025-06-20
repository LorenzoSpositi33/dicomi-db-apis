import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";

export interface CarteCreditoRow {
  tipoTrs: string;
  datetime: string;
  pv: string;
  indirizzo: string;
  tipoCarta: string;
  codProd: string;
  descrProd: string;
  volume: number;
  importoAccr: number;
  prezzoAccr: number;
}

export interface CarteCreditoStats {
  reportDate: string;
  modified: number;
  skipped: number;
  errored: number;
  logDump: string;
  mail_log: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../logger/summary-cartecredito.html");
const tplSrc = fs.readFileSync(templatePath, "utf8");
// Compiliamo una sola volta il template con il tipo stats
const tpl = Handlebars.compile<CarteCreditoStats>(tplSrc);

/**
 * Costruisce l'HTML completo del report "Carte Credito" usando Handlebars
 */
export function buildCarteCreditoHtml(stats: CarteCreditoStats): string {
  return tpl(stats);
}
