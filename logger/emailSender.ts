import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import { logger } from "./logger.js";

export async function sendFromTemplate(
  templateName: string,
  subject: string,
  context: Record<string, any>
) {
  // 1) Carica e compila con Handlebars
  const templatePath = path.join(__dirname, templateName);
  const tplSrc = fs.readFileSync(templatePath, "utf8");
  const tpl = Handlebars.compile(tplSrc);
  const html = tpl(context); // <-- Compilazione vera

  // 2) Configura e invia
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



// --------------- funzioni dedicate ---------------

export async function sendConsegnatoReport(
  reportDate: string,
  dayCardsHtml: string
) {
  await sendFromTemplate(
    "summary-consegnato.html",
    "Report ETL Consegnato",
    { reportDate, dayCards: dayCardsHtml }
  );
}

export async function sendOrdinatoReport(
  reportDate: string,
  summaryTableHtml: string,
  mediaGlobal: number
) {
  await sendFromTemplate(
    "summary-ordinato.html",
    "Report ETL Ordinato",
    { reportDate, summaryTable: summaryTableHtml, mediaGlobal }
  );
}

export async function sendCartePromoReport(
  reportDate: string,
  promoByTypeHtml: string,
  skippedCount: number
) {
  await sendFromTemplate(
    "summary-cartepromo.html",
    "Report ETL Carte Promo",
    { reportDate, promoByType: promoByTypeHtml, skippedCount }
  );
}

export async function sendTradingAreaReport(
  reportDate: string,
  priceCardsHtml: string
) {
  await sendFromTemplate(
    "summary-tradingarea.html",
    "Report ETL Trading Area",
    { reportDate, areaCards: priceCardsHtml }
  );
}

export async function sendListinoReport(
  reportDate: string,
  listinoCardsHtml: string,
  deltaYesterday: string
) {
  await sendFromTemplate(
    "summary-listino.html",
    "Report ETL Listino Distributori",
    { reportDate, listinoCards: listinoCardsHtml, deltaYesterday }
  );
}

export async function sendCarteCreditoReport(
  reportDate: string,
  totalRows: number,
  newCards: number,
  errors: number
) {
  await sendFromTemplate(
    "summary-cartecredito.html",
    "Report ETL Carte Credito",
    { reportDate, totalRows, newCards, errors }
  );
}
