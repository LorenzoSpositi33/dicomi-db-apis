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

// Nuova interfaccia che include logDump e mail_log
export interface ConsegnatoStats {
  reportDate: string;
  dayCards: DayCard[];
  ok: number
  err: number
  warn: number
  logDump: string;
  mail_log: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatePath = join(__dirname, "../logger/summary-consegnato.html");
const tplSrc = readFileSync(templatePath, "utf8");
// Compiliamo ora con la nuova interfaccia
const tpl = Handlebars.compile<ConsegnatoStats>(tplSrc);

export function buildConsegnatoHtml(stats: ConsegnatoStats): string {
  // stats contiene reportDate, dayCards, logDump e mail_log
  return tpl(stats);
}