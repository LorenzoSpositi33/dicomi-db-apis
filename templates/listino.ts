import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export interface ListinoRow {
  impianto: string;
  articolo: string;
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
  deltaYesterday: number;
  rows: ListinoRow[];
  modified: number;
  skipped: number;
  errored: number;
}

const tplSrc = fs.readFileSync(path.join(__dirname, "listino.html"), "utf8");
const tpl = Handlebars.compile<ListinoStats>(tplSrc);

export function buildListinoHtml(stats: ListinoStats): string {
  return tpl({
    reportDate: new Date().toLocaleString("it-IT"),
    ...stats
  });
}
