import express, { Request, Response } from "express";
import * as dotenv from "dotenv";
import { sql, getDatabasePool } from "./db/db.js";
import { logger } from "./logger/logger.js";
import crypto from "crypto";
// Aggiunto per HTTPS
import https from "https";
import fs from "fs";

dotenv.config();

// Parametri del file .ENV
const apiPort = process.env.DB_API_PORT;
const concTable = process.env.TABLE_CONCORRENZA;
const secretGen = process.env.SECRET_AUTH_KEY;

const app = express();

// Leggi i file dei certificati SSL
const privateKey = fs.readFileSync("C:/Certificati/cert_dicosv001.key", "utf8");
const certificate = fs.readFileSync("C:/Certificati/cert_dicosv001.crt", "utf8");
const credentials = { key: privateKey, cert: certificate };

// Crea il server HTTPS usando l'app Express
const httpsServer = https.createServer(credentials, app);


// Funzione per calcolare l'hash di una stringa
function hashString(input: string): string {
  logger.info("Secret in generazione");
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Questa funzione sostituisce l'osservatorio ID nella tabella concorrenza con un nuovo ID
async function replaceOss(oldId: string, newId: string): Promise<boolean> {
  try {
    const pool = await getDatabasePool();

    const query = `UPDATE ${concTable} SET idOsservatorioPrezzi = @newId WHERE idOsservatorioPrezzi = @oldId`;

    const result = await pool
      .request()
      .input("newId", sql.NVarChar, newId)
      .input("oldId", sql.NVarChar, oldId)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `ID Osservatorio sostituito con successo in ${concTable}, da IDOss ${oldId} a IDOss ${newId}`
      );
      return true;
    } else {
      logger.warn(
        `Nessuna riga è stata sostituita in ${concTable}, da IDOss ${oldId} a IDOss ${newId}`
      );
    }
  } catch (err) {
    logger.error(
      `Errore durante la sostituzione dell'ID Osservatorio in ${concTable}, da IDOss ${oldId} a IDOss ${newId}`,
      err
    );
  }

  return false;
}

app.get(
  "/updateConcorrenteOss",
  async (req: Request, res: Response): Promise<any> => {
    logger.info(
      `Ricevuta la richiesta /updateConcorrenteOss con questi parametri: ${JSON.stringify(
        req.query,
        null,
        2
      )}`
    );

    try {
      const newOssId: string | undefined =
        (req.query.x_newOssId as string) || (req.query.newOssId as string);
      const actOssId: string | undefined =
        (req.query.x_actOssId as string) || (req.query.actOssId as string);
      const secretKey: string | undefined =
        (req.query.x_secretKey as string) || (req.query.secretKey as string);

      if (!newOssId || !actOssId || !secretKey) {
        logger.error("I valori newOssId, actOssId o secretKey non sono validi");
        return res.status(400).send(
          `<!DOCTYPE html>
          <html lang="it">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Errore Operazione</title>
              <style>
                body {
                      font-family: Arial, sans-serif;
                      text-align: center;
                      margin-top: 50px;
                }
                .container {
                      padding: 20px;
                      border: 1px solid #ddd;
                      display: inline-block;
                      background-color: #f9f9f9;
                      border-radius: 5px;
                      box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
                }
                .error {
                      font-size: 18px;
                      font-weight: bold;
                      color: red;
                }
                .data {
                      margin-top: 10px;
                      font-size: 16px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error">Operazione non riuscita</div>
                <div class="data">Non è stato possibile sostituire l'Osservatorio ID da <span id="ossId">${actOssId}</span> a <span id="actOssId">${newOssId}</span></div>
              </div>
            </body>
          </html>`
        );
      }

      // Devo verificare se la richiesta è valida.
      // Se secreKey+dataDiOggi corrisponde all'hash che ricevo, la richiesta è autentica
      const today = new Date().toLocaleDateString("it-IT");
      const authHash = hashString(`${today}__${secretGen}`);

      if (authHash !== secretKey) {
        logger.error(
          "La chiave di autenticazione non è corretta, l'operazione non è autorizzata"
        );
        return res.status(401).send(
          `<!DOCTYPE html>
            <html lang="it">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Errore Operazione</title>
                <style>
                  body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        margin-top: 50px;
                  }
                  .container {
                        padding: 20px;
                        border: 1px solid #ddd;
                        display: inline-block;
                        background-color: #f9f9f9;
                        border-radius: 5px;
                        box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
                  }
                  .error {
                        font-size: 18px;
                        font-weight: bold;
                        color: red;
                  }
                  .data {
                        margin-top: 10px;
                        font-size: 16px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="error">Operazione non riuscita</div>
                  <div class="data">Autorizzazione scaduta</div>
                </div>
              </body>
            </html>`
        );
      }

      if (await replaceOss(actOssId, newOssId)) {
        logger.info("Sostituzione avvenuta con successo");
        return res.status(200).send(
          `<!DOCTYPE html>
            <html lang="it">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Risultato Operazione</title>
                <style>
                  body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        margin-top: 50px;
                  }
                  .container {
                        padding: 20px;
                        border: 1px solid #ddd;
                        display: inline-block;
                        background-color: #f9f9f9;
                        border-radius: 5px;
                        box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
                  }
                  .success {
                        font-size: 18px;
                        font-weight: bold;
                        color: green;
                  }
                  .data {
                        margin-top: 10px;
                        font-size: 16px;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="success">Operazione eseguita con successo</div>
                  <div class="data">Osservatorio ID sostituito da <span id="ossId">${actOssId}</span> a <span id="actOssId">${newOssId}</span></div>
                </div>
              </body>
            </html>`
        );
      } else {
        logger.error("Sostituzione non avvenuta");
        return res.status(400).send(
          `<!DOCTYPE html>
        <html lang="it">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Errore Operazione</title>
            <style>
              body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    margin-top: 50px;
              }
              .container {
                    padding: 20px;
                    border: 1px solid #ddd;
                    display: inline-block;
                    background-color: #f9f9f9;
                    border-radius: 5px;
                    box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
              }
              .error {
                    font-size: 18px;
                    font-weight: bold;
                    color: red;
              }
              .data {
                    margin-top: 10px;
                    font-size: 16px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="error">Operazione non riuscita</div>
              <div class="data">Non è stato possibile sostituire l'Osservatorio ID da <span id="ossId">${actOssId}</span> a <span id="actOssId">${newOssId}</span></div>
            </div>
          </body>
        </html>`
        );
      }
    } catch (error) {
      logger.error("Errore nel gestire la richiesta: ", error);
      return res.status(500).send(
        `<!DOCTYPE html>
       <html lang="it">
         <head>
           <meta charset="UTF-8">
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
           <title>Errore Operazione</title>
           <style>
             body {
                   font-family: Arial, sans-serif;
                   text-align: center;
                   margin-top: 50px;
             }
             .container {
                   padding: 20px;
                   border: 1px solid #ddd;
                   display: inline-block;
                   background-color: #f9f9f9;
                   border-radius: 5px;
                   box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.1);
             }
             .error {
                   font-size: 18px;
                   font-weight: bold;
                   color: red;
             }
             .data {
                   margin-top: 10px;
                   font-size: 16px;
             }
           </style>
         </head>
         <body>
           <div class="container">
             <div class="error">Operazione non riuscita</div>
             <div class="data">Non è stato possibile sostituire l'Osservatorio ID</div>
           </div>
         </body>
       </html>`
      );
    }
  }
);

httpsServer.listen(apiPort, () => {
  logger.info(`Servizio avviato e in ascolto sulla porta HTTPS: ${apiPort}`);
});
