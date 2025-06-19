import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";

export interface CartePromoRow {
  GIORNO: string;
  PV: string;
  TIPO: string;
  TOTALE: string;
}

export interface CartePromoStats {
  reportDate: string;
  rows: CartePromoRow[];
  skippedCount: number;
  ok: number;
  err: number;
  logDump?: string;       // opzionale
  mail_log?: boolean;     // opzionale
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../logger/summary-cartepromo.html");
const tplSrc = fs.readFileSync(templatePath, "utf8");
const tpl = Handlebars.compile<CartePromoStats>(tplSrc);

/**
 * Costruisce l'HTML completo del report "Carte Promo" usando Handlebars
 */
export function buildCartePromoHtml(stats: CartePromoStats): string {
  return tpl(stats);
}