// emailSender.ts
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import handlebars from "handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Funzione generica per invio con compilazione template handlebars
async function sendFromTemplate(
  templateName: string,
  subject: string,
  context: Record<string, any>
) {
  const templatePath = path.join(__dirname, templateName);
  const rawHtml = fs.readFileSync(templatePath, "utf8");

  const compiled = handlebars.compile(rawHtml);
  const html = compiled(context);

  await sendHtmlDirectly(subject, html);
}

// Funzione che invia direttamente HTML già pronto
async function sendHtmlDirectly(subject: string, html: string) {
  const transporter: Transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST!,
    port: Number(process.env.EMAIL_PORT!) || 587,
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!,
    },
  });

  const mailOptions: SendMailOptions = {
    from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    cc: process.env.EMAIL_CC,
    bcc: process.env.EMAIL_BCC,
    subject,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  logger.info(`✅ Mail "${subject}" inviata, id=${info.messageId}`);
}

// --------------- Funzioni dedicate ---------------

export async function sendConsegnatoReport(html: string) {
  await sendHtmlDirectly("Report ETL Consegnato", html);
}

export async function sendOrdinatoReport(
  reportDate: string,
  summaryTableHtml: string,
  mediaGlobal: number
) {
  await sendFromTemplate("summary-ordinato.html", "Report ETL Ordinato", {
    reportDate,
    summaryTable: summaryTableHtml,
    mediaGlobal,
  });
}

export async function sendCartePromoReport(
  reportDate: string,
  promoByType: { ok: number; err: number; html: string },
  skippedCount: number
) {
  await sendFromTemplate(
    "summary-cartepromo.html",
    "Report ETL Carte Promo",
    { reportDate, promoByType, skippedCount }
  );
}


export async function sendTradingAreaReport(
  reportDate: string,
  priceCardsHtml: string
) {
  await sendFromTemplate("summary-tradingarea.html", "Report ETL Trading Area", {
    reportDate,
    areaCards: priceCardsHtml,
  });
}

export async function sendListinoReport(
  reportDate: string,
  listinoCardsHtml: string,
  deltaYesterday: string
) {
  await sendFromTemplate("summary-listino.html", "Report ETL Listino Distributori", {
    reportDate,
    listinoCards: listinoCardsHtml,
    deltaYesterday,
  });
}

export async function sendCarteCreditoReport(
  reportDate: string,
  totalRows: number,
  newCards: number,
  errors: number
) {
  await sendFromTemplate("summary-cartecredito.html", "Report ETL Carte Credito", {
    reportDate,
    totalRows,
    newCards,
    errors,
  });
}

// Export utile se vuoi usare invio html diretto altrove
export { sendHtmlDirectly };
