import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export interface OrdinatoRow {
    timestamp: string;
  date: string;
  total: number;
  pv: string;
  prodotto: string;
  ordinato: number;
}

export interface OrdinatoStats {
  reportDate: string;
  totalRows: number;
  avgPast: number;
  dateFile: string;
  rows: OrdinatoRow[];
}

const tplSrc = fs.readFileSync(path.join(__dirname, "ordinato.html"), "utf8");
const tpl = Handlebars.compile<OrdinatoStats>(tplSrc);

export function buildOrdinatoHtml(stats: OrdinatoStats): string {
  return tpl(stats);
}
