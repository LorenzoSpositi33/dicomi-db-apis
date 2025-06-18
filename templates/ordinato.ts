import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";

export interface OrdinatoRow {
  pv: string;
  prod: string;
  vol: number;
}

export interface OrdinatoStats {
  reportDate: string;
  mediaGlobal: number;
  rows: OrdinatoRow[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "../logger/summary-ordinato.html");
const tplSrc = fs.readFileSync(templatePath, "utf8");
const tpl = Handlebars.compile<OrdinatoStats>(tplSrc);

/**
 * Costruisce l'HTML completo del report Ordinato
 */
export function buildOrdinatoHtml(stats: OrdinatoStats): string {
  return tpl(stats);
}
