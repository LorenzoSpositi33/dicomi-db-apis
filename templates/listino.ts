import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";

export interface ListinoRow {
  pv: string;
  product: string;
  prezzoServ: number;
  scontoServ: number;
  prezzoSelf: number;
  scontoSelf: number;
  prezzoOpt: number;
  scontoOpt: number;
  stacco: number;
  ordinato: number;
  note: string;
}

export interface ListinoStats {
  reportDate: string;
  totalRows: number;
  modified: number;
  skipped: number;
  errored: number;
  deltaYesterday: string;
  rows: ListinoRow[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../logger/summary-listino.html");
const tplSrc = fs.readFileSync(templatePath, "utf8");
const tpl = Handlebars.compile<ListinoStats>(tplSrc);

/**
 * Costruisce l'HTML completo del report Listino Distributori
 */
export function buildListinoHtml(stats: ListinoStats): string {
  return tpl(stats);
}
