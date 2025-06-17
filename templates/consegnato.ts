import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";

export interface ConsegnatoRow {
  data: string;
  articolo: string;
  qta: number;
}

export interface DayCard {
  date: string;
  prods: { article: string; ok: number; warn: number; err: number }[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tplSrc = fs.readFileSync(join(__dirname, "../logger/summary-consegnato.html"), "utf8");
const tpl = Handlebars.compile<{ reportDate: string; dayCards: DayCard[] }>(tplSrc);

export function buildConsegnatoHtml(dayCards: DayCard[]): string {
  
  const reportDate = new Date().toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  return tpl({ reportDate, dayCards });
}
