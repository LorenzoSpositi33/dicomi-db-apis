import express, { Request, Response } from "express";
import * as dotenv from "dotenv";
import { sql, getDatabasePool } from "./db/db.js";
import { logger } from "./logger/logger.js";
import crypto from "crypto";
// Aggiunto per HTTPS
import https from "https";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

dotenv.config();

// Parametri del file .ENV
const apiPort = process.env.DB_API_PORT;
const concTable = process.env.TABLE_CONCORRENZA;
const impiantiTable = process.env.TABLE_IMPIANTI;
const consegnatoTable = process.env.TABLE_CONSEGNATO;
const artSellInTable = process.env.TABLE_ARTICOLI_SELLIN;
const artTable = process.env.TABLE_ARTICOLI;
const secretGen = process.env.SECRET_AUTH_KEY;
const csvMainDirectory = String(process.env.FILE_MAIN_FOLDER);
const csvInputDirectory = String(process.env.FILE_FOLDER_INPUT);
const csvOkDirectory = String(process.env.FILE_FOLDER_OK);
const csvErrDirectory = String(process.env.FILE_FOLDER_ERR);

const app = express();

// Leggi i file dei certificati SSL
const privateKey = fs.readFileSync("C:/Certificati/cert_dicosv001.key", "utf8");
const certificate = fs.readFileSync(
  "C:/Certificati/cert_dicosv001.crt",
  "utf8"
);
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

async function impiantiMapping(): Promise<String[]> {
  let result: String[] = [];

  try {
    const pool = await getDatabasePool();

    const query = `SELECT imp.ImpiantoCodice AS imp
    
    FROM ${impiantiTable} AS imp`;

    result = (await pool.request().query(query)).recordset.map(
      (item) => item.imp
    );
  } catch (err) {
    console.error(
      `Errore nell'ottenere l'elenco degli articoli sell-in, query`,
      err
    );
  }

  return result;
}

async function sellInMapping(): Promise<Record<string, string>> {
  let result: Record<string, string> = {};

  try {
    const pool = await getDatabasePool();

    const query = `SELECT ars.Articolo AS art, ars.ArticoloSellin AS artSellin
    
    FROM ${artSellInTable} AS ars

    INNER JOIN ${artTable} AS arb
    ON arb.Articolo=ars.Articolo`;

    const recordset = (await pool.request().query(query)).recordset;

    const mapping = recordset.reduce((acc, item) => {
      acc[item.artSellin] = item.art;
      return acc;
    }, {} as Record<string, string>);

    result = mapping;
  } catch (err) {
    console.error(
      `Errore nell'ottenere l'elenco degli articoli sell-in, query`,
      err
    );
  }

  return result;
}

// Funzione per fare upsert riga per riga per il Consegnato
async function upsertConsegnato(
  impiantoCodice: string,
  ArticoloSellin: string,
  dataConsegna: Date,
  articolo: string,
  consegnato: number
) {
  console.log(impiantoCodice, ArticoloSellin, dataConsegna, consegnato);

  //.toISOString().split("T")[0];
  try {
    const pool = await getDatabasePool();
    // La query MERGE controlla se esiste già una riga con le stesse chiavi (impiantoCodice, Articolo, DataConsegna):
    // se sì, esegue l'UPDATE, altrimenti esegue l'INSERT.
    const query = `
        MERGE INTO ${consegnatoTable} AS target
        USING (VALUES (@ImpiantoCodice, @ArticoloSellin, @DataConsegna))
          AS source (ImpiantoCodice, ArticoloSellin, DataConsegna)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.ArticoloSellin = source.ArticoloSellin
          AND target.DataConsegna = source.DataConsegna
        )
        WHEN MATCHED THEN
          UPDATE SET
          Articolo = @Articolo,
          QtaConsegnata = @QtaConsegnata,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataConsegna, ImpiantoCodice, Articolo, ArticoloSellin, QtaConsegnata)
            VALUES (@DataConsegna, @ImpiantoCodice, @Articolo, @ArticoloSellin, @QtaConsegnata);
      `;

    const result = await pool
      .request()
      .input("ImpiantoCodice", sql.NVarChar, impiantoCodice)
      .input("ArticoloSellin", sql.NVarChar, ArticoloSellin)
      .input("DataConsegna", sql.Date, dataConsegna)
      .input("Articolo", sql.NVarChar, articolo)
      .input("QtaConsegnata", sql.Float, consegnato)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Upsert eseguito con successo: ${consegnatoTable}: ${impiantoCodice}, ${ArticoloSellin}, ${articolo}, ${dataConsegna}, ${consegnato}`
      );
      return true;
    } else {
      logger.warn(
        `Nessuna riga è stata aggiornata/inserita: ${consegnatoTable}: ${impiantoCodice}, ${ArticoloSellin}, ${articolo}, ${dataConsegna}, ${consegnato}`
      );
      return false;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert della riga di Consegnato: ${impiantoCodice}, ${ArticoloSellin}, ${articolo}, ${dataConsegna}, ${consegnato}`,
      err
    );
    return false;
  }
}

async function elaboraConsegnato(results: any[], fileHeaders: String[]) {
  const sellinMap = await sellInMapping();
  const impiantiMap = await impiantiMapping();

  const expectedHeaders = ["PV", "PRODOTTO", "DATA_CONSEGNA", "CONSEGNATO"];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    console.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    // Ottengo il prodotto (ArticoloSellIn)
    const prodotto = String(row.PRODOTTO);

    // Ottengo la data consegna formattata correttamente
    const oldDataConsegna = String(row.DATA_CONSEGNA);
    const [dayDataConsegna, monthDataConsegna, yearDataConsegna] =
      oldDataConsegna.split("/");
    const dataConsegna = new Date(
      Number(yearDataConsegna),
      Number(monthDataConsegna) - 1,
      Number(dayDataConsegna)
    );

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    const impiantoCodice = String(row.PV).padStart(4, "0");

    // Ottengo la quantità di consegnato nel formato corretto, pronto per l'inserimento nel DB
    const consegnato =
      parseFloat(String(row.CONSEGNATO).replace(",", ".")) / 1000;

    // CONTROLLO RIGA PER RIGA SE E' VALIDA, ALTRIMENTI LA IGNORO

    // 1) Controllo se la quantità consegnata è minore di 0
    if (consegnato < 0 || !consegnato) {
      console.error(
        "Il valore di consegnato contiene una quantità negativa o nulla: ",
        row
      );
      continue;
    }

    const art = sellinMap[prodotto];

    // 2) Controllo se il prodotto è valido, in base all'anagrafica nel DB
    if (!art) {
      console.error(
        "Il valore di prodotto non è presente nel database di Dicomi: ",
        row
      );
      continue;
    }

    // 3) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      console.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );
      continue;
    }

    // Faccio l'upsert sul DB
    await upsertConsegnato(
      impiantoCodice,
      prodotto,
      dataConsegna,
      art,
      consegnato
    );
  }

  return true;
}

// Confronto contenuto array, ritorna true se sono uguali a livello di contenuti, oppure false
async function equalList(list1: String[], list2: String[]): Promise<boolean> {
  return (
    list1.length === list2.length &&
    list2.every((expected) =>
      list1.some((header) => header.toLowerCase() === expected.toLowerCase())
    )
  );
}

async function moveFile(status: boolean, filePath: string) {
  // Se status è vero, usa la cartella OK, altrimenti quella ERR

  const targetDirectory = status
    ? csvMainDirectory + `/${csvOkDirectory}`
    : csvMainDirectory + `/${csvErrDirectory}`;

  // Estrai il nome originale del file e la sua estensione
  const originalFileName = path.basename(filePath);
  const ext = path.extname(originalFileName);
  const baseName = path.basename(originalFileName, ext);

  // Crea un timestamp formattato come YYYYMMDD_HHMMSS
  const timestamp = new Date()
    .toISOString() // "2025-04-07T13:14:15.678Z"
    .replace(/[-:]/g, "") // "20250407T131415.678Z"
    .slice(0, 15) // "20250407T131415"
    .replace("T", "_"); // "20250407_131415"

  // Costruisci il nuovo nome del file
  const newFileName = `${baseName}_${timestamp}${ext}`;
  const targetPath = path.join(targetDirectory, newFileName);

  try {
    await fs.promises.rename(filePath, targetPath);
    console.log(`File spostato in: ${targetPath}`);
  } catch (err) {
    console.error("Errore nello spostamento del file:", err);
  }
}

// CONTROLLO FILES continuo, per import csv di Q8
async function controlloFiles() {
  const inputDirectory = csvMainDirectory + `/${csvInputDirectory}`;

  try {
    // Ottengo tutti i files nella cartella di input
    const files = await fs.promises.readdir(inputDirectory);

    // Se è presente almeno un file
    if (files.length > 0) {
      console.log("File rilevati:", files);

      for (const file of files) {
        const filePath = path.join(inputDirectory, file);
        console.log("File in elaborazione:", file);

        // Il file è del formato corretto CSV
        if (path.extname(file).toLowerCase() === ".csv") {
          // Leggo il contenuto del file
          const results: any[] = [];
          // Headers del file
          let fileHeaders: String[] = [];

          // Incapsula la lettura in una Promise
          await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
              .pipe(csv({ separator: ";" }))
              .on("headers", (headers) => {
                fileHeaders = headers;
              })
              .on("data", (row) => {
                // Accumula ogni riga
                results.push(row);
              })
              .on("end", () => {
                console.log("Il file CSV è stato letto correttamente");
                resolve(results);
              })
              .on("error", (err) => {
                console.error("Errore nella lettura del file CSV:", err);
                reject(err);
              });
          });

          // CONTROLLO SE IL FILE NON SIA VUOTO
          if (results.length === 0) {
            console.error("Errore: il file non contiene righe di dati.");
            await moveFile(false, filePath);
            continue;
          }

          // Capisco la categoria del file
          switch (true) {
            // Il file è "CONSEGNATO"
            case /consegnato/i.test(file):
              console.log("File riconosciuto come CONSEGNATO: ", file);

              await moveFile(
                await elaboraConsegnato(results, fileHeaders),
                filePath
              );

              break;
            // Il file non è stato riconosciuto
            default:
              console.log("File non riconosciuto: ", file);
          }
        }
        // Il file non è in formato CSV
        else {
          await moveFile(false, filePath);
          console.log("Il file contiene un'estensione errata: ", file);
        }
      }

      //TODO: Da rimuovere:
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    // Se non è presente neanche un file
    else {
      console.log("Nessun file .csv trovato nella cartella", inputDirectory);

      // Sleep di 1 minuto
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  } catch (error) {
    console.error(
      "Errore durante la lettura della cartella",
      csvMainDirectory,
      error
    );
  }

  // Ora richiama la funzione per eseguire il prossimo ciclo
  controlloFiles();
}

// ENDPOINT per sostituire l'osservatorio ID
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

// Inizio del pooling
controlloFiles();

httpsServer.listen(apiPort, () => {
  logger.info(`Servizio avviato e in ascolto sulla porta HTTPS: ${apiPort}`);
});
