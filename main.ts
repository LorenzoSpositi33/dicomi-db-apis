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
const ordinatoTable = process.env.TABLE_ORDINATO;
const carteCreditoTable = process.env.TABLE_CARTE_CREDITO;
const cartePromoTable = process.env.TABLE_CARTE_PROMO;
const tradingAreaTable = process.env.TABLE_TRADING_AREA;
const listDistTable = process.env.TABLE_LIST_DISTRIBUTORI;
const impScontiFissiTable = process.env.TABLE_IMP_SCONTI_FISSI;
const artSellInTable = process.env.TABLE_ARTICOLI_SELLIN;
const artTable = process.env.TABLE_ARTICOLI;
const tipiCarteTable = process.env.TABLE_TIPI_CARTE;

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
    logger.error(
      `Errore nell'ottenere l'elenco degli impianti dicomi, query: `,
      err
    );
  }

  return result;
}

async function tipiCarteMapping(): Promise<String[]> {
  let result: String[] = [];

  try {
    const pool = await getDatabasePool();

    const query = `SELECT car.TipoCarta AS tipo
    
    FROM ${tipiCarteTable} AS car`;

    result = (await pool.request().query(query)).recordset.map(
      (item) => item.tipo
    );
  } catch (err) {
    logger.error(
      `Errore nell'ottenere l'elenco dei tipi carta dicomi, query: `,
      err
    );
  }

  return result;
}

async function impiantiCartePromoMapping(): Promise<String[]> {
  let result: String[] = [];

  try {
    const pool = await getDatabasePool();

    const query = `SELECT imp.ImpiantoCodice AS imp
    
    FROM ${impiantiTable} AS imp
    
    WHERE imp.CartePromoSiNo = 1`;

    result = (await pool.request().query(query)).recordset.map(
      (item) => item.imp
    );
  } catch (err) {
    logger.error(
      `Errore nell'ottenere l'elenco degli impianti dicomi abilitati alle carte promo, query: `,
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
    logger.error(
      `Errore nell'ottenere l'elenco degli articoli sell-in, query: `,
      err
    );
  }

  return result;
}

async function articoliMapping(): Promise<String[]> {
  let result: String[] = [];

  try {
    const pool = await getDatabasePool();

    const query = `SELECT art.Articolo as art
    
    FROM ${artTable} AS art`;

    result = (await pool.request().query(query)).recordset.map(
      (item) => item.art
    );
  } catch (err) {
    logger.error(
      `Errore nell'ottenere l'elenco degli articoli sell-in, query: `,
      err
    );
  }

  return result;
}

async function scontoFissoMapping(
  dataListDistr: Date
): Promise<Record<string, Record<string, boolean>>> {
  let result: Record<string, Record<string, boolean>> = {};

  try {
    const pool = await getDatabasePool();

    const query = `SELECT udt.ImpiantoCodice,
    udt.Articolo,
    sc2.ScontoFissoSiNo

    FROM
    (
      SELECT
      sc1.ImpiantoCodice,
      sc1.Articolo,
      MAX(sc1.DataSconti) AS maxData
      from ${impScontiFissiTable} sc1
      WHERE sc1.DataSconti <= @DataListDistr
      GROUP BY sc1.ImpiantoCodice, sc1.Articolo
    ) udt

    LEFT JOIN ${impScontiFissiTable} sc2
    ON udt.ImpiantoCodice = sc2.ImpiantoCodice
    AND udt.Articolo = sc2.Articolo
    AND udt.maxData = sc2.DataSconti`;

    const recordset = (
      await pool
        .request()
        .input("DataListDistr", sql.Date, dataListDistr)
        .query(query)
    ).recordset;

    const mapping = recordset.reduce((acc, item) => {
      const imp = item.ImpiantoCodice;
      const art = item.Articolo;
      if (!acc[imp]) {
        acc[imp] = {};
      }
      acc[imp][art] = item.ScontoFissoSiNo;
      return acc;
    }, {} as Record<string, Record<string, boolean>>);

    result = mapping;
  } catch (err) {
    logger.error(
      `Errore nell'ottenere l'elenco degli impianti con sconto fisso`,
      err
    );
  }

  return result;
}

//Funzione che crea un tipo carta provvisorio "TBN" se esiste una carta nuova
async function createTipoCarta(tipo: string) {
  const defaultDescription = "TBN";
  const defaultAziendaleSiNo = 1;

  try {
    const pool = await getDatabasePool();
    const query = `
        INSERT INTO ${tipiCarteTable} (TipoCarta, Descrizione, CartaAziendaleSiNo)
        VALUES (@TipoCarta, @Descrizione, @CartaAziendaleSiNo);   
      `;

    const result = await pool
      .request()
      .input("TipoCarta", sql.NVarChar, tipo)
      .input("Descrizione", sql.NVarChar, defaultDescription)
      .input("CartaAziendaleSiNo", sql.Int, defaultAziendaleSiNo)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Insert effettuato per ${tipiCarteTable}: ${tipo}, ${defaultDescription}, ${defaultAziendaleSiNo}`
      );
      return true;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'insert per ${tipiCarteTable}: ${tipo},  ${defaultDescription}, ${defaultAziendaleSiNo}`,
      err
    );
    return false;
  }
}

// GESTIONE FILE: CONSEGNATO
async function elaboraConsegnato(results: any[], fileHeaders: String[]) {
  let righeModificate = 0;
  let righeSaltate = 0;
  let righeErrore = 0;
  let righeElaborate = 0;

  const sellinMap = await sellInMapping();
  const impiantiMap = await impiantiMapping();

  const expectedHeaders = ["PV", "PRODOTTO", "DATA_CONSEGNA", "CONSEGNATO"];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    logger.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    righeElaborate += 1;

    // Ottengo il prodotto (ArticoloSellIn)
    const prodotto = String(row.PRODOTTO);

    // Ottengo la data consegna formattata correttamente
    const oldDataConsegna = String(row.DATA_CONSEGNA);
    const [dayDataConsegna, monthDataConsegna, yearDataConsegna] =
      oldDataConsegna.split("/");
    const dataConsegna = new Date(
      Date.UTC(
        Number(yearDataConsegna),
        Number(monthDataConsegna) - 1,
        Number(dayDataConsegna)
      )
    );

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    const impiantoCodice = String(row.PV).padStart(4, "0");

    // Ottengo la quantità di consegnato nel formato corretto, pronto per l'inserimento nel DB
    const consegnato =
      parseFloat(String(row.CONSEGNATO).replace(",", ".")) / 1000;

    // CONTROLLO RIGA PER RIGA SE E' VALIDA, ALTRIMENTI LA IGNORO

    // 1) Controllo se la quantità consegnata è minore di 0
    if (consegnato < 0 || !consegnato) {
      logger.error(
        "Il valore di consegnato contiene una quantità negativa o nulla: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    const art = sellinMap[prodotto];

    // 2) Controllo se il prodotto è valido, in base all'anagrafica nel DB
    if (!art) {
      logger.error(
        "Il valore di prodotto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // 3) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      logger.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // Faccio l'upsert sul DB
    /*
    Codice 0: Ho inserito / modificato la riga
    Codice 1: La riga è andata in errore
    Codice 2: Non ho apportato modifiche
    */
    switch (
      await upsertConsegnato(
        impiantoCodice,
        prodotto,
        dataConsegna,
        art,
        consegnato
      )
    ) {
      case 0:
        righeModificate += 1;
        break;
      case 1:
        righeErrore += 1;
        break;
      case 2:
        righeSaltate += 1;
        break;
    }
  }

  //Finito il file, stampo il log

  logger.info(`Il file Consegnato è stato elaborato`);
  logger.info(`Righe elaborate: ${righeElaborate}`);
  logger.info(`Righe inserite / modificate: ${righeModificate}`);
  logger.info(`Righe ignorate: ${righeSaltate}`);
  logger.info(`Righe andate in errore: ${righeErrore}`);

  return true;
}
async function upsertConsegnato(
  impiantoCodice: string,
  ArticoloSellin: string,
  dataConsegna: Date,
  articolo: string,
  consegnato: number
) {
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
        `Upsert effettuato per ${consegnatoTable}: ${impiantoCodice}, ${ArticoloSellin}, ${articolo}, ${dataConsegna}, ${consegnato}`
      );
      return 0;
    } else {
      logger.warn(
        `Nessun upsert effettuato per ${consegnatoTable}: ${impiantoCodice}, ${ArticoloSellin}, ${articolo}, ${dataConsegna}, ${consegnato}`
      );
      return 2;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert per ${consegnatoTable}: ${impiantoCodice}, ${ArticoloSellin}, ${articolo}, ${dataConsegna}, ${consegnato}`,
      err
    );
    return 1;
  }
}

// GESTIONE FILE: ORDINATO
async function elaboraOrdinato(
  fileName: string,
  results: any[],
  fileHeaders: String[]
) {
  let righeModificate = 0;
  let righeSaltate = 0;
  let righeErrore = 0;
  let righeElaborate = 0;

  const impiantiMap = await impiantiMapping();
  const articoliMap = await articoliMapping();

  const expectedHeaders = ["PV_NAME", "PROD_NAME", "VOL_ORDINATO"];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    logger.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // 2) Controllo che nel nome del file ci sia un valore di data valida, da usare come data ordinato
  // Va calcolata ed elaborata la data.
  // La data viene presa dal file, se è Sabato o Domenica, deve diventare il prossimo Lunedì (aggiungo 2 o 1 giorno)
  // Utilizziamo una regex per trovare una sequenza esattamente di 8 cifre
  const dateMatch = fileName.match(/\d{8}/);

  let dataOrdinato;

  if (dateMatch) {
    // dateMatch è un array, il primo elemento contiene la stringa trovata
    const dateString = dateMatch[0]; // ad esempio "20250410"

    // Se desideri formattarla in un formato diverso, ad esempio "YYYY-MM-DD",
    // puoi estrarre anno, mese e giorno:
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    dataOrdinato = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    ); // Nota: i mesi in JS sono zero-indexed
    logger.info("Data trovata:", dataOrdinato); // "2025-04-10"

    // Verifica se è sabato (6) o domenica (0) e, in base al risultato, aggiungi i giorni necessari per passare a lunedì
    const dayOfWeek = dataOrdinato.getUTCDay(); // getUTCDay() restituisce 0 per domenica, 6 per sabato
    if (dayOfWeek === 6) {
      // Se è sabato, aggiungi 2 giorni
      dataOrdinato.setUTCDate(dataOrdinato.getUTCDate() + 2);
      logger.info("Rilevato SABATO, data convertita in: ", dataOrdinato);
    } else if (dayOfWeek === 0) {
      // Se è domenica, aggiungi 1 giorno
      dataOrdinato.setUTCDate(dataOrdinato.getUTCDate() + 1);
      logger.info("Rilevata DOMENICA, data convertita in: ", dataOrdinato);
    }
  } else {
    logger.error("Nessuna data nel formato YYYYMMDD trovata nel filename");

    return false;
  }

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    righeElaborate += 1;

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    const impiantoCodice = String(row.PV_NAME).padStart(4, "0");
    // Ottengo l'articolo
    const articolo = String(row.PROD_NAME);
    // Ottengo la quantità di ordinato nel formato corretto, pronto per l'inserimento nel DB
    const ordinato = parseFloat(String(row.VOL_ORDINATO).replace(",", "."));

    // CONTROLLO RIGA PER RIGA SE E' VALIDA, ALTRIMENTI LA IGNORO
    // 1) Controllo se la quantità ordinata è minore di 0
    if (ordinato < 0 || !ordinato) {
      logger.error(
        "Il valore di ordinato contiene una quantità negativa o nulla: ",
        row
      );
      righeErrore += 1;
      continue;
    }
    // 2) Controllo se l'articolo è valido, in base all'anagrafica nel DB
    if (!articoliMap.includes(articolo)) {
      logger.error(
        "Il valore di articolo non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }
    // 3) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      logger.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // Faccio l'upsert sul DB
    /*
    Codice 0: Ho inserito / modificato la riga
    Codice 1: La riga è andata in errore
    Codice 2: Non ho apportato modifiche
    */
    switch (
      await upsertOrdinato(impiantoCodice, articolo, dataOrdinato, ordinato)
    ) {
      case 0:
        righeModificate += 1;
        break;
      case 1:
        righeErrore += 1;
        break;
      case 2:
        righeSaltate += 1;
        break;
    }
  }

  //Finito il file, stampo il log
  logger.info(`Il file Ordinato è stato elaborato`);
  logger.info(`Righe elaborate: ${righeElaborate}`);
  logger.info(`Righe inserite / modificate: ${righeModificate}`);
  logger.info(`Righe ignorate: ${righeSaltate}`);
  logger.info(`Righe andate in errore: ${righeErrore}`);

  return true;
}
async function upsertOrdinato(
  impiantoCodice: string,
  articolo: string,
  dataOrdinato: Date,
  ordinato: number
) {
  //.toISOString().split("T")[0];
  try {
    const pool = await getDatabasePool();
    // La query MERGE controlla se esiste già una riga con le stesse chiavi (impiantoCodice, Articolo, DataOrdinato):
    // se sì, esegue l'UPDATE, altrimenti esegue l'INSERT.
    const query = `
        MERGE INTO ${ordinatoTable} AS target
        USING (VALUES (@ImpiantoCodice, @Articolo, @DataConsegnaOrdine))
          AS source (ImpiantoCodice, Articolo, DataConsegnaOrdine)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.Articolo = source.Articolo
          AND target.DataConsegnaOrdine = source.DataConsegnaOrdine
        )
        WHEN MATCHED THEN
          UPDATE SET
          QtaOrdinata = @QtaOrdinata,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataConsegnaOrdine, ImpiantoCodice, Articolo, QtaOrdinata)
            VALUES (@DataConsegnaOrdine, @ImpiantoCodice, @Articolo, @QtaOrdinata);
      `;

    const result = await pool
      .request()
      .input("ImpiantoCodice", sql.NVarChar, impiantoCodice)
      .input("Articolo", sql.NVarChar, articolo)
      .input("DataConsegnaOrdine", sql.Date, dataOrdinato)
      .input("QtaOrdinata", sql.Float, ordinato)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Upsert effettuato per ${ordinatoTable}: ${impiantoCodice}, ${articolo}, ${dataOrdinato}, ${ordinato}`
      );
      return 0;
    } else {
      logger.warn(
        `Nessun upsert effettuato per ${ordinatoTable}: ${impiantoCodice}, ${articolo}, ${dataOrdinato}, ${ordinato}`
      );
      return 2;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert per ${ordinatoTable}: ${impiantoCodice}, ${articolo}, ${dataOrdinato}, ${ordinato}`,
      err
    );
    return 1;
  }
}

// GESTIONE FILE: CARTE PROMO
async function elaboraCartePromo(results: any[], fileHeaders: String[]) {
  let righeModificate = 0;
  let righeSaltate = 0;
  let righeErrore = 0;
  let righeElaborate = 0;
  let righeNonAbilitate = 0;

  const impiantiMap = await impiantiMapping();
  const impiantiAbilitatiMap = await impiantiCartePromoMapping();

  const tipoTrsList = [
    "TRXATTIVE",
    "BATTESIMI",
    "PROMOZIONABILE",
    "PROMOZIONATO",
  ];
  // const articoliMap = await articoliMapping();

  const expectedHeaders = ["PV", "TIPO", "GIORNO", "TOTALE"];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    logger.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    righeElaborate += 1;

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    const impiantoCodice = String(row.PV).padStart(4, "0");

    const tipo = String(row.TIPO).toUpperCase();

    //TODO: Bisogna capire come va gestita la conversione del dato, va letto così com'è?
    const totale = parseFloat(String(row.TOTALE).replace(",", "."));

    const oldDataCartePromo = String(row.GIORNO);
    const [dayDataCartePromo, monthDataCartePromo, yearDataCartePromo] =
      oldDataCartePromo.split("/");
    const dataCartePromo = new Date(
      Date.UTC(
        Number(yearDataCartePromo),
        Number(monthDataCartePromo) - 1,
        Number(dayDataCartePromo)
      )
    );

    // 1) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      logger.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );

      righeErrore += 1;
      continue;
    }

    // 2) Controllo se il campo TipoTrs è valido
    if (!tipoTrsList.includes(tipo)) {
      logger.error(
        "Il valore di Tipo Trs non è presente nella lista dichiarata: ",
        row
      );

      righeErrore += 1;
      continue;
    }

    // 3 WARNING) Controllo se l'impianto è abilitato alle carte promo, in base all'anagrafica nel DB
    if (!impiantiAbilitatiMap.includes(impiantoCodice)) {
      logger.warn(
        "Il valore di impianto non è presente tra gli impianti abilitati alle carte promo nel database di Dicomi: ",
        row
      );
      righeNonAbilitate += 1;
    }

    // Nel codice di DM. veniva controllata la data (non vuota), non ho bisogno di farlo, se la data non è valida da errore il DB

    //TODO: Nel codice viene  fatta una delete basata sul codice impianto e sulla data, e poi vengono aggiunte le righe con insert
    // logger.info(impiantoCodice, tipo, dataCartePromo, totale);

    // Faccio l'upsert sul DB
    switch (
      await upsertCartePromo(impiantoCodice, tipo, dataCartePromo, totale)
    ) {
      case 0:
        righeModificate += 1;
        break;
      case 1:
        righeErrore += 1;
        break;
      case 2:
        righeSaltate += 1;
        break;
    }
  }

  //Finito il file, stampo il log
  logger.info(`Il file Carte Promo è stato elaborato`);
  logger.info(`Righe elaborate: ${righeElaborate}`);
  logger.info(`Righe con impianti non abilitati: ${righeNonAbilitate}`);
  logger.info(`Righe inserite / modificate: ${righeModificate}`);
  logger.info(`Righe ignorate: ${righeSaltate}`);
  logger.info(`Righe andate in errore: ${righeErrore}`);

  return true;
}
async function upsertCartePromo(
  impiantoCodice: string,
  tipo: string,
  dataCartePromo: Date,
  valore: number
) {
  //.toISOString().split("T")[0];
  try {
    const pool = await getDatabasePool();

    // La query MERGE controlla se esiste già una riga con le stesse chiavi (impiantoCodice, dataCartePromo):
    // se sì, esegue l'UPDATE, altrimenti esegue l'INSERT.

    let query = "";

    // Switch sul tipo trs
    switch (tipo) {
      case "BATTESIMI":
        query = `
        MERGE INTO ${cartePromoTable} AS target
        USING (VALUES (@ImpiantoCodice, @DataCartePromo))
          AS source (ImpiantoCodice, DataCartePromo)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.DataCartePromo = source.DataCartePromo
        )
        WHEN MATCHED THEN
          UPDATE SET
          Battesimi = @Valore,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataCartePromo, ImpiantoCodice, Battesimi, TrxAttive, Promozionabile, Promozionato, PenSelfServGS)
            VALUES (@DataCartePromo, @ImpiantoCodice, @Valore, 0, 0, 0, 0);
      `;
        break;

      case "TRXATTIVE":
        query = `
        MERGE INTO ${cartePromoTable} AS target
        USING (VALUES (@ImpiantoCodice, @DataCartePromo))
          AS source (ImpiantoCodice, DataCartePromo)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.DataCartePromo = source.DataCartePromo
        )
        WHEN MATCHED THEN
          UPDATE SET
          TrxAttive = @Valore,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataCartePromo, ImpiantoCodice, Battesimi, TrxAttive, Promozionabile, Promozionato, PenSelfServGS)
            VALUES (@DataCartePromo, @ImpiantoCodice, 0, @Valore, 0, 0, 0);
      `;
        break;

      case "PROMOZIONABILE":
        query = `
        MERGE INTO ${cartePromoTable} AS target
        USING (VALUES (@ImpiantoCodice, @DataCartePromo))
          AS source (ImpiantoCodice, DataCartePromo)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.DataCartePromo = source.DataCartePromo
        )
        WHEN MATCHED THEN
          UPDATE SET
          Promozionabile = @Valore,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataCartePromo, ImpiantoCodice, Battesimi, TrxAttive, Promozionabile, Promozionato, PenSelfServGS)
            VALUES (@DataCartePromo, @ImpiantoCodice, 0, 0, @Valore, 0, 0);
      `;
        break;

      case "PROMOZIONATO":
        query = `
        MERGE INTO ${cartePromoTable} AS target
        USING (VALUES (@ImpiantoCodice, @DataCartePromo))
          AS source (ImpiantoCodice, DataCartePromo)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.DataCartePromo = source.DataCartePromo
        )
        WHEN MATCHED THEN
          UPDATE SET
          Promozionato = @Valore,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataCartePromo, ImpiantoCodice, Battesimi, TrxAttive, Promozionabile, Promozionato, PenSelfServGS)
            VALUES (@DataCartePromo, @ImpiantoCodice, 0, 0, 0, @Valore, 0);
      `;
        break;
    }

    const result = await pool
      .request()
      .input("DataCartePromo", sql.Date, dataCartePromo)
      .input("ImpiantoCodice", sql.NVarChar, impiantoCodice)
      .input("Valore", sql.Float, valore)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Upsert effettuato per ${cartePromoTable}: ${impiantoCodice}, ${tipo}, ${dataCartePromo}, ${valore}`
      );
      return 0;
    } else {
      logger.warn(
        `Nessun upsert effettuato per ${cartePromoTable}: ${impiantoCodice}, ${tipo}, ${dataCartePromo}, ${valore}`
      );
      return 2;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert per ${cartePromoTable}: ${impiantoCodice}, ${tipo}, ${dataCartePromo}, ${valore}`,
      err
    );
    return 1;
  }
}

// GESTIONE FILE: TRADING AREA
async function elaboraTradingArea(
  fileName: string,
  results: any[],
  fileHeaders: String[]
) {
  let righeModificate = 0;
  let righeSaltate = 0;
  let righeErrore = 0;
  let righeElaborate = 0;

  const impiantiMap = await impiantiMapping();
  const articoliMap = await articoliMapping();

  // Articoli che scelgo volontariamente di ignorare tra i dati che arrivano dalla Trading Area
  const ignoreArticles = ["GAS_PREST"];

  const expectedHeaders = [
    "PV",
    "BANDIERA",
    "INDIRIZZO",
    "PRODOTTO",
    "MAIN",
    "PREZZO SELF",
    "PREZZO SERV",
    "PREZZO CHIUSURA",
  ];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    logger.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // 2) Controllo che nel nome del file ci sia un valore di data valida, da usare come data ordinato
  // Va calcolata ed elaborata la data.
  // La data viene presa dal file, se è Sabato o Domenica, deve diventare il prossimo Lunedì (aggiungo 2 o 1 giorno)
  // Utilizziamo una regex per trovare una sequenza esattamente di 8 cifre
  const dateMatch = fileName.match(/\d{8}/);

  let dataTradingArea;

  if (dateMatch) {
    // dateMatch è un array, il primo elemento contiene la stringa trovata
    const dateString = dateMatch[0]; // ad esempio "20250410"

    // Se desideri formattarla in un formato diverso, ad esempio "YYYY-MM-DD",
    // puoi estrarre anno, mese e giorno:
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    dataTradingArea = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    ); // Nota: i mesi in JS sono zero-indexed
    logger.info("Data trovata:", dataTradingArea); // "2025-04-10"
  } else {
    logger.error("Nessuna data nel formato YYYYMMDD trovata nel filename");

    return false;
  }

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    righeElaborate += 1;

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    const impiantoCodice = String(row.PV).padStart(4, "0");

    const bandiera = String(row.BANDIERA);
    const indirizzo = String(row.INDIRIZZO);
    const articolo = String(row.PRODOTTO);
    // Se la colonna ha del contenuto, torna 1, altrimenti 0
    const main = Boolean(row.MAIN);

    const self = parseFloat(String(row["PREZZO SELF"]).replace(",", ".")) || 0;
    const serv = parseFloat(String(row["PREZZO SERV"]).replace(",", ".")) || 0;
    const chiusura =
      parseFloat(String(row["PREZZO CHIUSURA"]).replace(",", ".")) || 0;

    // CONTROLLO RIGA PER RIGA SE E' VALIDA, ALTRIMENTI LA IGNORO
    // 1) Controllo se l'articolo è valido, in base all'anagrafica nel DB e non ricade nell'elenco degli articoli da ignorare
    if (!articoliMap.includes(articolo) && !ignoreArticles.includes(articolo)) {
      logger.error(
        "Il valore di articolo non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // 2) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      logger.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // 3) Controllo se l'articolo è da ignorare, in caso salto la riga
    if (ignoreArticles.includes(articolo)) {
      logger.warn(
        "Il valore di articolo è presente nella lista di articoli da ignorare: ",
        row
      );
      righeSaltate += 1;
      // Non devo comunque scrivere la riga
      continue;
    }
    // Faccio l'upsert sul DB
    /*
    Codice 0: Ho inserito / modificato la riga
    Codice 1: La riga è andata in errore
    Codice 2: Non ho apportato modifiche
    */
    switch (
      await upsertTradingArea(
        dataTradingArea,
        impiantoCodice,
        bandiera,
        indirizzo,
        articolo,
        main,
        self,
        serv,
        chiusura
      )
    ) {
      case 0:
        righeModificate += 1;
        break;
      case 1:
        righeErrore += 1;
        break;
      case 2:
        righeSaltate += 1;
        break;
    }

    // Faccio l'upsert sul DB

    //TODO: Dopo aver inserito la trading area, lo script vecchio lanciava la SP Calcolo_GL (ora su qlik) e inseriva le bandiere nuove non presenti in DICOMI_ConBandiere in DICOMI_NewBandiere.
  }

  //Finito il file, stampo il log
  logger.info(`Il file Trading Area è stato elaborato`);
  logger.info(`Righe elaborate: ${righeElaborate}`);
  logger.info(`Righe inserite / modificate: ${righeModificate}`);
  logger.info(`Righe ignorate: ${righeSaltate}`);
  logger.info(`Righe andate in errore: ${righeErrore}`);

  return true;
}
async function upsertTradingArea(
  dataTradingArea: Date,
  impiantoCodice: string,
  bandiera: string,
  indirizzo: string,
  articolo: string,
  main: boolean,
  self: number,
  serv: number,
  chiusura: number
) {
  try {
    const pool = await getDatabasePool();
    // La query MERGE controlla se esiste già una riga con le stesse chiavi (dataTradingArea, impiantoCodice, articolo, bandiera, indirizzo, mainSiNo):
    // se sì, esegue l'UPDATE, altrimenti esegue l'INSERT.
    const query = `
        MERGE INTO ${tradingAreaTable} AS target
        USING (VALUES (@ImpiantoCodice, @Articolo, @DataTradingArea, @Bandiera, @Indirizzo, @MainSiNo))
          AS source (ImpiantoCodice, Articolo, DataTradingArea, Bandiera, Indirizzo, MainSiNo)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.Articolo = source.Articolo
          AND target.DataTradingArea = source.DataTradingArea
          AND target.Bandiera = source.Bandiera
          AND target.Indirizzo = source.Indirizzo
          AND target.MainSiNo = source.MainSiNo
        )
        WHEN MATCHED THEN
          UPDATE SET
          PrezzoServito = @PrezzoServito,
          PrezzoSelf = @PrezzoSelf,
          PrezzoOpt = @PrezzoOpt,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataTradingArea, ImpiantoCodice, Articolo, Bandiera, Indirizzo, MainSiNo, PrezzoServito, PrezzoSelf, PrezzoOpt)
            VALUES (@DataTradingArea, @ImpiantoCodice, @Articolo, @Bandiera, @Indirizzo, @MainSiNo, @PrezzoServito, @PrezzoSelf, @PrezzoOpt);
      `;

    const result = await pool
      .request()
      .input("DataTradingArea", sql.Date, dataTradingArea)
      .input("ImpiantoCodice", sql.NVarChar, impiantoCodice)
      .input("Articolo", sql.NVarChar, articolo)
      .input("Bandiera", sql.NVarChar, bandiera)
      .input("Indirizzo", sql.NVarChar, indirizzo)
      .input("MainSiNo", sql.Bit, main)
      .input("PrezzoServito", sql.Float, serv)
      .input("PrezzoSelf", sql.Float, self)
      .input("PrezzoOpt", sql.Float, chiusura)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Upsert effettuato per ${tradingAreaTable}: ${dataTradingArea}, ${impiantoCodice}, ${articolo}, ${bandiera}, ${indirizzo}, ${main}, ${serv}, ${self}, ${chiusura}`
      );
      return 0;
    } else {
      logger.warn(
        `Nessun upsert effettuato per ${tradingAreaTable}: ${dataTradingArea}, ${impiantoCodice}, ${articolo}, ${bandiera}, ${indirizzo}, ${main}, ${serv}, ${self}, ${chiusura}`
      );
      return 2;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert per ${tradingAreaTable}: ${dataTradingArea}, ${impiantoCodice}, ${articolo}, ${bandiera}, ${indirizzo}, ${main}, ${serv}, ${self}, ${chiusura}`,
      err
    );
    return 1;
  }
}

// GESTIONE FILE: CARTE CREDITO
async function elaboraCarteCredito(results: any[], fileHeaders: String[]) {
  let righeModificate = 0;
  let righeSaltate = 0;
  let righeErrore = 0;
  let righeElaborate = 0;
  let righeNuoveCarte = 0;

  const sellinMap = await sellInMapping();
  const impiantiMap = await impiantiMapping();
  const tipiCarteMap = await tipiCarteMapping();

  const expectedHeaders = [
    "TIPO TRS",
    "DATATIME",
    "PV",
    "INDIRIZZO PV",
    "TIPO CARTA",
    "COD.PROD",
    "DESCR.PROD",
    "VOLUME",
    "IMPORTO ACCR",
    "PRZ ACCR",
  ];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    logger.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    righeElaborate += 1;
    const trs = String(row["TIPO TRS"]);

    //TODO: Verifico la correttezza della data

    const datetime = String(row.DATATIME);
    // Separa la data e il tempo (usando lo slash come delimitatore)
    const [datePart, timePart] = datetime.split("/");

    // Estrai anno, mese e giorno dalla parte della data
    const yearDataCompetenza = datePart.substring(0, 4);
    const monthDataCompetenza = datePart.substring(4, 6);
    const dayDataCompetenza = datePart.substring(6, 8);

    // Estrai ore, minuti e secondi dalla parte dell'orario
    const [hours, minutes, seconds] = timePart.split(":").map(Number);

    // Crea l'oggetto Date completo in UTC
    const dataTimestamp = new Date(
      Date.UTC(
        Number(yearDataCompetenza),
        Number(monthDataCompetenza) - 1,
        Number(dayDataCompetenza),
        hours,
        minutes,
        seconds
      )
    );

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    // L'impianto è in questo formato: 00PV000705
    const impiantoCodice = String(
      Number(String(row.PV).substring(String(row.PV).length - 4))
    ).padStart(4, "0");

    const indirizzo = String(row["INDIRIZZO PV"]);
    const tipo = String(row["TIPO CARTA"]);
    const cod_prodotto = String(row["COD.PROD"]);
    const desc_prodotto = String(row["DESCR.PROD"]);

    const volume = parseFloat(String(row.VOLUME).replace(",", "."));
    const importo_accr = parseFloat(
      String(row["IMPORTO ACCR"]).replace(",", ".")
    );
    const prz_accr = parseFloat(String(row["PRZ ACCR"]).replace(",", "."));

    // CONTROLLO RIGA PER RIGA SE E' VALIDA, ALTRIMENTI LA IGNORO

    const art = sellinMap[cod_prodotto];

    // 2) Controllo se il prodotto è valido, in base all'anagrafica nel DB
    if (!art) {
      logger.error(
        "Il valore di prodotto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // 3) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      logger.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // 4 WARNING) Se non esiste il tipo carta nel DB, creo un tipo carta provvisorio e lo segnalo
    if (!tipiCarteMap.includes(tipo)) {
      logger.warn(
        "Il valore di tipo carta non è presente nel DB, lo creo provvisoriamente",
        row
      );

      // Inserisco nel DB la nuova carta
      (await createTipoCarta(tipo)) ? (righeNuoveCarte += 1) : undefined;
    }

    // Faccio l'upsert sul DB
    switch (
      await upsertCarteCredito(
        trs,
        dataTimestamp,
        impiantoCodice,
        indirizzo,
        art,
        cod_prodotto,
        desc_prodotto,
        tipo,
        volume,
        importo_accr,
        prz_accr
      )
    ) {
      case 0:
        righeModificate += 1;
        break;
      case 1:
        righeErrore += 1;
        break;
      case 2:
        righeSaltate += 1;
        break;
    }
  }

  //Finito il file, stampo il log
  logger.info(`Il file Trading Area è stato elaborato`);
  logger.info(`Righe elaborate: ${righeElaborate}`);
  logger.info(`Righe inserite / modificate: ${righeModificate}`);
  logger.info(`Nuove carte inserite: ${righeNuoveCarte}`);
  logger.info(`Righe ignorate: ${righeSaltate}`);
  logger.info(`Righe andate in errore: ${righeErrore}`);

  return true;
}
async function upsertCarteCredito(
  trs: string,
  dataTimestamp: Date,
  impiantoCodice: string,
  indirizzo: string,
  art: string,
  cod_prodotto: string,
  desc_prodotto: string,
  tipo: string,
  volume: number,
  importo_accr: number,
  prz_accr: number
) {
  try {
    //TODO: Da capire se va bene l'upsert o è meglio fare una delete e importare tutto nuovamente.
    const pool = await getDatabasePool();
    // La query MERGE controlla se esiste già una riga con le stesse chiavi (impiantoCodice, Articolo, DataOrdinato):
    // se sì, esegue l'UPDATE, altrimenti esegue l'INSERT.
    const query = `
          MERGE INTO ${carteCreditoTable} AS target
          USING (VALUES (@TipoTrs, @DataOraTransazione, @DataCompetenza, @ImpiantoCodice, @ArticoloSellin, @TipoCarta))
            AS source (TipoTrs, DataOraTransazione, DataCompetenza, ImpiantoCodice, ArticoloSellin, TipoCarta)
          ON (
            target.TipoTrs = source.TipoTrs
            AND target.DataOraTransazione = source.DataOraTransazione
            AND target.DataCompetenza = source.DataCompetenza
            AND target.ImpiantoCodice = source.ImpiantoCodice
            AND target.ArticoloSellin = source.ArticoloSellin
            AND target.TipoCarta = source.TipoCarta
          )
          WHEN MATCHED THEN
            UPDATE SET
            ImpiantoDescrizione = @ImpiantoDescrizione,
            Articolo = @Articolo,
            ArticoloDescrizione = @ArticoloDescrizione,
            Volume = @Volume,
            ImportoAccr = @ImportoAccr,
            PrezzoAccr = @PrezzoAccr,
            DataModifica = GETDATE()
          WHEN NOT MATCHED THEN
              INSERT (TipoTrs, DataOraTransazione, DataCompetenza, ImpiantoCodice, ImpiantoDescrizione, Articolo, ArticoloSellin, ArticoloDescrizione, TipoCarta, Volume, ImportoAccr, PrezzoAccr)
              VALUES (@TipoTrs, @DataOraTransazione, @DataCompetenza, @ImpiantoCodice, @ImpiantoDescrizione, @Articolo, @ArticoloSellin, @ArticoloDescrizione, @TipoCarta, @Volume, @ImportoAccr, @PrezzoAccr);
        `;

    const result = await pool
      .request()
      .input("TipoTrs", sql.NVarChar, trs)
      .input("DataOraTransazione", sql.DateTime, dataTimestamp)
      .input("DataCompetenza", sql.Date, dataTimestamp)
      .input("ImpiantoCodice", sql.NVarChar, impiantoCodice)
      .input("ImpiantoDescrizione", sql.NVarChar, indirizzo)
      .input("Articolo", sql.NVarChar, art)
      .input("ArticoloSellin", sql.NVarChar, cod_prodotto)
      .input("ArticoloDescrizione", sql.NVarChar, desc_prodotto)
      .input("TipoCarta", sql.NVarChar, tipo)
      .input("Volume", sql.Float, volume)
      .input("ImportoAccr", sql.Float, importo_accr)
      .input("PrezzoAccr", sql.Float, prz_accr)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Upsert effettuato per ${carteCreditoTable}: ${trs}, ${dataTimestamp}, ${impiantoCodice}, ${indirizzo}, ${art}, ${cod_prodotto}, ${desc_prodotto}, ${tipo}, ${volume}, ${importo_accr}, ${prz_accr}`
      );
      return 0;
    } else {
      logger.warn(
        `Nessun upsert effettuato per ${carteCreditoTable}: ${trs}, ${dataTimestamp}, ${impiantoCodice}, ${indirizzo}, ${art}, ${cod_prodotto}, ${desc_prodotto}, ${tipo}, ${volume}, ${importo_accr}, ${prz_accr}`
      );
      return 2;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert per ${carteCreditoTable}: ${trs}, ${dataTimestamp}, ${impiantoCodice}, ${indirizzo}, ${art}, ${cod_prodotto}, ${desc_prodotto}, ${tipo}, ${volume}, ${importo_accr}, ${prz_accr}`,
      err
    );
    return 1;
  }
}

// GESTIONE FILE: LISTINO DISTRIBUTORI
async function elaboraListDistr(
  fileName: string,
  results: any[],
  fileHeaders: String[]
) {
  let righeModificate = 0;
  let righeSaltate = 0;
  let righeErrore = 0;
  let righeElaborate = 0;

  const impiantiMap = await impiantiMapping();
  const articoliMap = await articoliMapping();

  const expectedHeaders = [
    "PV",
    "PRODOTTO",
    "PREZZO_SERV",
    "SCONTO_SERV",
    "PREZZO_SELF",
    "SCONTO_SELF",
    "PREZZO_OPT",
    "SCONTO_OPT",
    "STACCO",
    "ORDINATO",
    "NOTE",
  ];

  // 1) Controllo che gli header del file siano corretti
  if (!(await equalList(fileHeaders, expectedHeaders))) {
    logger.error(
      `Errore: gli header del file non sono quelli previsti. Attuali: ${fileHeaders} vs Previsti ${expectedHeaders}`
    );
    return false;
  }

  // 2) Controllo che nel nome del file ci sia un valore di data valida, da usare come data ordinato
  // Va calcolata ed elaborata la data.
  // La data viene presa dal file, se è Sabato o Domenica, deve diventare il prossimo Lunedì (aggiungo 2 o 1 giorno)
  // Utilizziamo una regex per trovare una sequenza esattamente di 8 cifre
  const dateMatch = fileName.match(/\d{8}/);

  let dataListDistr;

  if (dateMatch) {
    // dateMatch è un array, il primo elemento contiene la stringa trovata
    const dateString = dateMatch[0]; // ad esempio "20250410"

    // Se desideri formattarla in un formato diverso, ad esempio "YYYY-MM-DD",
    // puoi estrarre anno, mese e giorno:
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    dataListDistr = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    ); // Nota: i mesi in JS sono zero-indexed
    logger.info("Data trovata:", dataListDistr); // "2025-04-10"
  } else {
    logger.error("Nessuna data nel formato YYYYMMDD trovata nel filename");

    return false;
  }

  const scontoFissoMap = await scontoFissoMapping(dataListDistr);

  // Elaboro il contenuto, riga per riga, del file e interagisco con il DB
  for (const row of results) {
    righeElaborate += 1;

    // Ottengo l'impianto codice con 4 cifre forzate, e gli 0 davanti in caso servano per completare la stringa
    const impiantoCodice = String(row.PV).padStart(4, "0");
    // Ottengo l'articolo
    const articolo = String(row.PRODOTTO).replace("HVO+", "HVO");

    // Ottengo la quantità di ordinato nel formato corretto, pronto per l'inserimento nel DB
    const prezzo_serv = parseFloat(String(row.PREZZO_SERV).replace(",", "."));
    const sconto_serv = parseFloat(String(row.SCONTO_SERV).replace(",", "."));
    const prezzo_self = parseFloat(String(row.PREZZO_SELF).replace(",", "."));
    const sconto_self = parseFloat(String(row.SCONTO_SELF).replace(",", "."));
    const prezzo_opt = parseFloat(String(row.PREZZO_OPT).replace(",", "."));
    const sconto_opt = parseFloat(String(row.SCONTO_OPT).replace(",", "."));
    const stacco = parseFloat(String(row.STACCO).replace(",", "."));
    const ordinato = parseFloat(String(row.ORDINATO).replace(",", ".")) || 0;

    const note = String(row.NOTE);

    // Ottengo il valore "scontoFissoSiNo"
    const scontoFissoImpianto = scontoFissoMap[impiantoCodice];

    let scontoFisso;

    if (scontoFissoImpianto) {
      scontoFisso = scontoFissoImpianto[articolo] || false;
    } else {
      scontoFisso = false;
    }

    // CONTROLLO RIGA PER RIGA SE E' VALIDA, ALTRIMENTI LA IGNORO
    //1) Controllo se l'impianto è valido, in base all'anagrafica nel DB
    if (!impiantiMap.includes(impiantoCodice)) {
      logger.error(
        "Il valore di impianto non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    // 2) Controllo se l'articolo è valido, in base all'anagrafica nel DB
    if (!articoliMap.includes(articolo)) {
      logger.error(
        "Il valore di articolo non è presente nel database di Dicomi: ",
        row
      );
      righeErrore += 1;
      continue;
    }

    //WARNING 3) Controllo sullo sconto fisso, solo per log
    if (scontoFisso) {
      logger.warn("Impianto a sconto fisso: ", row);
    }

    // Faccio l'upsert sul DB
    switch (
      await upsertListDistr(
        dataListDistr,
        impiantoCodice,
        articolo,
        prezzo_serv,
        sconto_serv,
        prezzo_self,
        sconto_self,
        prezzo_opt,
        sconto_opt,
        stacco,
        ordinato,
        note
      )
    ) {
      case 0:
        righeModificate += 1;
        break;
      case 1:
        righeErrore += 1;
        break;
      case 2:
        righeSaltate += 1;
        break;
    }
  }

  //Finito il file, stampo il log
  logger.info(`Il file Trading Area è stato elaborato`);
  logger.info(`Righe elaborate: ${righeElaborate}`);
  logger.info(`Righe inserite / modificate: ${righeModificate}`);
  logger.info(`Righe ignorate: ${righeSaltate}`);
  logger.info(`Righe andate in errore: ${righeErrore}`);

  return true;
}
async function upsertListDistr(
  DataListino: Date,
  ImpiantoCodice: string,
  Articolo: string,
  PrezzoServito: number,
  ScontoServito: number,
  PrezzoSelf: number,
  ScontoSelf: number,
  PrezzoOpt: number,
  ScontoOpt: number,
  Stacco: number,
  Ordinato: number,
  Note: string
) {
  try {
    const pool = await getDatabasePool();
    // La query MERGE controlla se esiste già una riga con le stesse chiavi (impiantoCodice, Articolo, DataOrdinato):
    // se sì, esegue l'UPDATE, altrimenti esegue l'INSERT.
    const query = `
        MERGE INTO ${listDistTable} AS target
        USING (VALUES (@DataListino, @ImpiantoCodice, @Articolo))
          AS source (DataListino, ImpiantoCodice, Articolo)
        ON (
          target.ImpiantoCodice = source.ImpiantoCodice
          AND target.Articolo = source.Articolo
          AND target.DataListino = source.DataListino
        )
        WHEN MATCHED THEN
          UPDATE SET
          PrezzoServito = @PrezzoServito,
          ScontoServito = @ScontoServito,
          PrezzoSelf = @PrezzoSelf,
          ScontoSelf = @ScontoSelf,
          PrezzoOpt = @PrezzoOpt,
          ScontoOpt = @ScontoOpt,
          Stacco = @Stacco,
          Ordinato = @Ordinato,
          Note = @Note,
          DataModifica = GETDATE()
        WHEN NOT MATCHED THEN
            INSERT (DataListino, ImpiantoCodice, Articolo, PrezzoServito, ScontoServito, PrezzoSelf, ScontoSelf, PrezzoOpt, ScontoOpt, Stacco, Ordinato, Note)
            VALUES (@DataListino, @ImpiantoCodice, @Articolo, @PrezzoServito, @ScontoServito, @PrezzoSelf, @ScontoSelf, @PrezzoOpt, @ScontoOpt, @Stacco, @Ordinato, @Note);
      `;

    const result = await pool
      .request()
      .input("DataListino", sql.Date, DataListino)
      .input("ImpiantoCodice", sql.NVarChar, ImpiantoCodice)
      .input("Articolo", sql.NVarChar, Articolo)
      .input("PrezzoServito", sql.Float, PrezzoServito)
      .input("ScontoServito", sql.Float, ScontoServito)
      .input("PrezzoSelf", sql.Float, PrezzoSelf)
      .input("ScontoSelf", sql.Float, ScontoSelf)
      .input("PrezzoOpt", sql.Float, PrezzoOpt)
      .input("ScontoOpt", sql.Float, ScontoOpt)
      .input("Stacco", sql.Float, Stacco)
      .input("Ordinato", sql.Float, Ordinato)
      .input("Note", sql.NVarChar, Note)
      .query(query);

    if (result.rowsAffected[0] > 0) {
      logger.info(
        `Upsert effettuato per: ${listDistTable}: ${DataListino}, ${ImpiantoCodice}, ${Articolo}, ${PrezzoServito}, ${ScontoServito}, ${PrezzoSelf}, ${ScontoSelf}, ${PrezzoOpt}, ${ScontoOpt}, ${Stacco}, ${Ordinato}, ${Note}`
      );
      return 0;
    } else {
      logger.warn(
        `Nessun upsert effettuato per: ${listDistTable}: ${DataListino}, ${ImpiantoCodice}, ${Articolo}, ${PrezzoServito}, ${ScontoServito}, ${PrezzoSelf}, ${ScontoSelf}, ${PrezzoOpt}, ${ScontoOpt}, ${Stacco}, ${Ordinato}, ${Note}`
      );
      return 2;
    }
  } catch (err) {
    logger.error(
      `Errore durante l'upsert per: ${listDistTable}: ${DataListino}, ${ImpiantoCodice}, ${Articolo}, ${PrezzoServito}, ${ScontoServito}, ${PrezzoSelf}, ${ScontoSelf}, ${PrezzoOpt}, ${ScontoOpt}, ${Stacco}, ${Ordinato}, ${Note}`,
      err
    );
    return 1;
  }
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

  // Costruisci il nuovo nome del file
  const newFileName = `${baseName}${ext}`;
  const targetPath = path.join(targetDirectory, newFileName);

  try {
    await fs.promises.rename(filePath, targetPath);
    logger.info(`File spostato in: ${targetPath}`);
  } catch (err) {
    logger.error("Errore nello spostamento del file:", err);
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
      logger.info("File rilevati:", files);

      for (const file of files) {
        const filePath = path.join(inputDirectory, file);
        logger.info("File in elaborazione:", file);

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

                // Rimuovo eventuali headers vuoti
                fileHeaders = fileHeaders.filter((item) => item !== "");
              })
              .on("data", (row) => {
                // Accumula ogni riga
                results.push(row);
              })
              .on("end", () => {
                logger.info("Il file CSV è stato letto correttamente");
                resolve(results);
              })
              .on("error", (err) => {
                logger.error("Errore nella lettura del file CSV:", err);
                reject(err);
              });
          });

          // CONTROLLO SE IL FILE NON SIA VUOTO
          if (results.length === 0) {
            logger.error("Errore: il file non contiene righe di dati.");
            await moveFile(false, filePath);
            continue;
          }

          // Capisco la categoria del file
          switch (true) {
            // Il file è "CONSEGNATO"
            case /consegnato/i.test(file):
              logger.info("File riconosciuto come CONSEGNATO: ", file);

              await moveFile(
                await elaboraConsegnato(results, fileHeaders),
                filePath
              );

              break;

            // Il file è "ORDINATO"
            case /ordinato/i.test(file):
              logger.info("File riconosciuto come ORDINATO: ", file);

              await moveFile(
                await elaboraOrdinato(file, results, fileHeaders),
                filePath
              );

              break;

            // Il file è "CARTE CREDITO"
            case /utx_dicomi/i.test(file):
              logger.info("File riconosciuto come CARTE CREDITO: ", file);

              await moveFile(
                await elaboraCarteCredito(results, fileHeaders),
                filePath
              );

              break;

            // Il file è "CARTE PROMO"
            case /cartepromo/i.test(file):
              logger.info("File riconosciuto come CARTE PROMO: ", file);

              await moveFile(
                await elaboraCartePromo(results, fileHeaders),
                filePath
              );

              break;

            // Il file è "TRADING AREA"
            case /trading_area/i.test(file):
              logger.info("File riconosciuto come TRADING AREA: ", file);

              await moveFile(
                await elaboraTradingArea(file, results, fileHeaders),
                filePath
              );

              break;

            // Il file è "TRADING AREA"
            case /listino/i.test(file):
              logger.info("File riconosciuto come LISTINO: ", file);

              await moveFile(
                await elaboraListDistr(file, results, fileHeaders),
                filePath
              );

              break;

            // Il file non è stato riconosciuto
            default:
              logger.info("File non riconosciuto: ", file);
          }
        }
        // Il file non è in formato CSV
        else {
          await moveFile(false, filePath);
          logger.info("Il file contiene un'estensione errata: ", file);
        }
      }

      //TODO: Da rimuovere:
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    // Se non è presente neanche un file
    else {
      logger.info("Nessun file .csv trovato nella cartella", inputDirectory);

      // Sleep di 1 minuto
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  } catch (error) {
    logger.error(
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
      // Se secretKey+dataDiOggi corrisponde all'hash che ricevo, la richiesta è autentica
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
