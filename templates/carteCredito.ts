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
  totalRows: number;
  newCards: number;
  errors: number;
  rows: CarteCreditoRow[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../logger/summary-cartecredito.html");
const tplSrc = fs.readFileSync(templatePath, "utf8");
const tpl = Handlebars.compile<CarteCreditoStats>(tplSrc);

export function buildCarteCreditoHtml(stats: CarteCreditoStats): string {
  return tpl(stats);
}
