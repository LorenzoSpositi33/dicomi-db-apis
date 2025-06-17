import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export interface DayCard {
  date: string;
  prods: { article: string; ok: number; warn: number; err: number }[];
}

const tplSrc = fs.readFileSync(path.join(__dirname, "consegnato.html"), "utf8");
const tpl = Handlebars.compile<{ reportDate: string; dayCards: DayCard[] }>(tplSrc);

export function buildConsegnatoHtml(dayCards: DayCard[]): string {
  const reportDate = new Date().toLocaleString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
  return tpl({ reportDate, dayCards });
}
