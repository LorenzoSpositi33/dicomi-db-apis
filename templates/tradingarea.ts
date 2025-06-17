import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export interface TradingAreaRow {
  impianto: string;
  articolo: string;
  bandiera: string;
  indirizzo: string;
  main: boolean;
  prezzoSelf: number;
  prezzoServ: number;
  prezzoChiusura: number;
}

export interface TradingAreaStats {
  reportDate: string;
  rows: TradingAreaRow[];
  modified: number;
  skipped: number;
  errored: number;
}

const tplSrc = fs.readFileSync(path.join(__dirname, "tradingArea.html"), "utf8");
const tpl = Handlebars.compile<TradingAreaStats>(tplSrc);

export function buildTradingAreaHtml(stats: TradingAreaStats): string {
  return tpl({
    reportDate: new Date().toLocaleString("it-IT"),
    ...stats
  });
}
