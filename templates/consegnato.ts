import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import Handlebars from "handlebars";
import { readFileSync } from "fs";

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

export function buildConsegnatoHtml(stats: DayCard[]): string {
  const templatePath = join(__dirname, "../logger/summary-consegnato.html");
  const tplSrc = readFileSync(templatePath, "utf8");

  const template = Handlebars.compile(tplSrc);
  const html = template({
    reportDate: new Date().toLocaleString("it-IT"),
    dayCards: stats, // usa esattamente questa chiave: `dayCards`
  });

  return html;
}

