// emailSender.ts
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js"; // mantiene estensione .js se il logger è compilato in JS

export async function sendLogSummary(
  fileType: string,
  logSummary: string,
  SummaryInfos: Record<string, number | string>
): Promise<void> {
  // Percorso del file corrente (ESM)
  const __filename = fileURLToPath(import.meta.url);
  console.log(__filename);
  const __dirname = path.dirname(__filename);

  let htmlContent: string = "";
  let replacements: Record<string, string | number> = {};
  let templatePath: string;
  let deltaColor: string = "";
  let formattedDelta: string = "";

  switch (fileType) {
    case "Ordinato":
      // Carica il template HTML
      templatePath = path.join(__dirname, "ordinatoSummary.html");
      htmlContent = fs.readFileSync(templatePath, "utf8");

      if (Number(SummaryInfos["DELTA"]) > 0) {
        formattedDelta = `+${Number(SummaryInfos["DELTA"])}`;
        deltaColor = "color: green;";
      } else if (Number(SummaryInfos["DELTA"]) < 0) {
        formattedDelta = `${Number(SummaryInfos["DELTA"])}`; // negativo già ha il segno
        deltaColor = "color: red;";
      } else {
        formattedDelta = "0";
      }

      // Definizione dei placeholder e dei loro valori
      replacements = {
        DATA: new Date(SummaryInfos["DATE"]).toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        "VAL CODICE 0": SummaryInfos["OK"] ?? 0,
        "VAL CODICE 1": SummaryInfos["ERROR"] ?? 0,
        "VAL CODICE 2": SummaryInfos["WARN"] ?? 0,
        "VAL DELTA": formattedDelta ?? "N/A",
        "DELTA COLOR": deltaColor,
        //   "LISTA CAMBIO GESTIONE": cambioGestioneHtml,
        "LOG DUMP": logSummary || "Nessun log disponibile",
      };

      break;

    case "Carte Promo":
      // Carica il template HTML
      templatePath = path.join(__dirname, "promoSummary.html");
      htmlContent = fs.readFileSync(templatePath, "utf8");

      // Definizione dei placeholder e dei loro valori
      replacements = {
        DATA: new Date(SummaryInfos["DATE"]).toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        "VAL CODICE 0": SummaryInfos["OK"] ?? 0,
        "VAL CODICE 1": SummaryInfos["ERROR"] ?? 0,
        "VAL CODICE 2": SummaryInfos["WARN"] ?? 0,
        //   "LISTA CAMBIO GESTIONE": cambioGestioneHtml,
        "LOG DUMP": logSummary || "Nessun log disponibile",
      };

      break;

    case "Trading Area":
       // Carica il template HTML
      templatePath = path.join(__dirname, "tradingareaSummary.html");
      htmlContent = fs.readFileSync(templatePath, "utf8");

      // Definizione dei placeholder e dei loro valori
      replacements = {
        DATA: new Date(SummaryInfos["DATE"]).toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        "VAL CODICE 0": SummaryInfos["OK"] ?? 0,
        "VAL CODICE 1": SummaryInfos["ERROR"] ?? 0,
        "VAL CODICE 2": SummaryInfos["WARN"] ?? 0,
        //   "LISTA CAMBIO GESTIONE": cambioGestioneHtml,
        "LOG DUMP": logSummary || "Nessun log disponibile",
      };

      break;
  }

  // Sostituisci tutti i placeholder nel template
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\[${key}\\]`, "g");
    htmlContent = htmlContent.replace(regex, String(value));
  }

  // Configurazione del transporter
  const host = process.env.EMAIL_HOST!;
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASSWORD!;

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
  });

  // Opzioni della mail
  const mailOptions: SendMailOptions = {
    from: `"${process.env.EMAIL_FROM}" <${user}>`,
    replyTo: "dicomi@iceinformatics.com",
    to: process.env.EMAIL_TO,
    cc: process.env.EMAIL_CC,
    bcc: process.env.EMAIL_BCC,
    subject: `ETL ${fileType}`,
    text: "Questa email contiene del codice HTML, utilizzare un dispositivo idoneo per la visualizzazione o contattare ICE Informatics",
    html: htmlContent,
  };

  // Invio
  const info = await transporter.sendMail(mailOptions);
  logger.info(`✅ Email inviata con ID: ${info.messageId}`);
}

export async function sendError(
  fileError: string,
  fileType: string,
  dataFile: Date | null
): Promise<void> {
  // Percorso del file corrente (ESM)
  const __filename = fileURLToPath(import.meta.url);
  console.log(__filename);
  const __dirname = path.dirname(__filename);

  let htmlContent: string = "";
  let replacements: Record<string, string | number> = {};
  let errorMessage: string = "";
  let finalDate: string;

  if (dataFile == null) {
    finalDate = "N/A";
  } else {
    finalDate = new Date(dataFile).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  // Carica il template HTML
  const templatePath = path.join(__dirname, "fileError.html");
  htmlContent = fs.readFileSync(templatePath, "utf8");

  switch (fileError) {
    case "Chiavi":
      errorMessage = "Il file contiene chiavi univoche duplicate";
      break;
    case "Data File":
      errorMessage = "Il file non contiene una data corretta nel nome";
      break;
    case "Headers":
      errorMessage = "Il file non contiene tutti gli header necessari";
      break;
    case "Vuoto":
      errorMessage = "Il file non contiene dati";
      break;
  }

  // Definizione dei placeholder e dei loro valori
  replacements = {
    DATA: finalDate,
    "ERR MESSAGE": errorMessage ?? "N/A",
  };

  // Sostituisci tutti i placeholder nel template
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\[${key}\\]`, "g");
    htmlContent = htmlContent.replace(regex, String(value));
  }

  // Configurazione del transporter
  const host = process.env.EMAIL_HOST!;
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER!;
  const pass = process.env.EMAIL_PASSWORD!;

  const transporter: Transporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
  });

  // Opzioni della mail
  const mailOptions: SendMailOptions = {
    from: `"${process.env.EMAIL_FROM}" <${user}>`,
    replyTo: "dicomi@iceinformatics.com",
    to: process.env.EMAIL_TO,
    cc: process.env.EMAIL_CC,
    bcc: process.env.EMAIL_BCC,
    subject: `Error ETL ${fileType}`,
    text: "Questa email contiene del codice HTML, utilizzare un dispositivo idoneo per la visualizzazione o contattare ICE Informatics",
    html: htmlContent,
  };

  // Invio
  const info = await transporter.sendMail(mailOptions);
  logger.info(`✅ Email inviata con ID: ${info.messageId}`);
}
