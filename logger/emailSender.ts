import nodemailer from "nodemailer";
import { logger } from "./logger.js";

export async function sendLogSummary(logSummary: string): Promise<void> {
  // Ottieni il percorso corrente del file (per ES module)

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL_USER}>`,
    replyTo: `dicomi@iceinformatics.com`,
    to: process.env.EMAIL_TO,
    cc: process.env.EMAIL_CC,
    bcc: process.env.EMAIL_BCC,
    subject: `ETL Osservatorio Prezzi`,
    text: `Questa email contiene del codice HTML, utilizzare un dispositivo idoneo per la visualizzazione o contattare ICE Informatics`,
    html: `<h1>Email di test</h1><span>${logSummary}</span>`,
  };

  const info = await transporter.sendMail(mailOptions);
  logger.info(`✅ Email inviata con ID: ${info.messageId}`);
}
