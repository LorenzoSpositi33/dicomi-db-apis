// emailSender.ts
import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger.js";
import handlebars from "handlebars";
import type { CarteCreditoRow } from "../templates/carteCredito.js";
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

export async function sendOrdinatoReport(html: string) {
  await sendHtmlDirectly("Report ETL Ordinato", html);
}

export async function sendCartePromoReport(html: string) {
  await sendHtmlDirectly("Report ETL Carte Promo", html);
}


export async function sendTradingAreaReport(html: string) {
  await sendHtmlDirectly("Report ETL Trading Area", html);
}

export async function sendListinoReport(html: string) {
  await sendHtmlDirectly("Report ETL Listino Distributori", html);
}


export async function sendCarteCreditoReport(html: string) {
  await sendHtmlDirectly("Report ETL Carte Credito", html);
}
