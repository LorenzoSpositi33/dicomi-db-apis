import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export interface CartePromoRow {
  pv: string;
  tipo: string;
  giorno: string;
  totale: number;
  nonAbilitata: boolean;
}

export interface CartePromoStats {
  reportDate: string;
  rows: CartePromoRow[];
  modified: number;
  skipped: number;
  errored: number;
}

const tplSrc = fs.readFileSync(path.join(__dirname, "cartePromo.html"), "utf8");
const tpl = Handlebars.compile<CartePromoStats>(tplSrc);

export function buildCartePromoHtml(stats: CartePromoStats): string {
  return tpl({
    reportDate: new Date().toLocaleString("it-IT"),
    ...stats
  });
}
