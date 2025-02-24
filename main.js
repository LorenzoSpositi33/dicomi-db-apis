"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = 3100;
// Tabelle da configurare
const apiPort = process.env.DB_API_PORT;
app.get("/updateConcorrenteOss", (req, res) => {
    // Quando si usa Outlook, viene aggiunto un x_ davanti
    const newOssId = req.query.x_newOssId || req.query.newOssId;
    const actOssId = req.query.x_actOssId || req.query.actOssId;
    console.log(`Received: newOssId = ${newOssId}, actOssId = ${actOssId}`);
    res.send(`<!DOCTYPE html>
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
               <div class="data">Osservatorio ID sostituito da <span id="ossId">${newOssId}</span> a <span id="actOssId">${actOssId}</span></div>
            </div>
         </body>
      </html>
   `);
});
app.listen(apiPort, () => {
    console.log(`Service started and listening on port ${apiPort}`);
});
