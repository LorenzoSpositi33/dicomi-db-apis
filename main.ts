import express, { Request, Response } from "express";

const app = express();
const port: number = 3100;

app.get("/updateConcorrenteOss", (req: Request, res: Response) => {
  // Quando si usa Outlook, viene aggiunto un x_ davanti
  const newOssId: string | undefined =
    (req.query.x_newOssId as string) || (req.query.newOssId as string);
  const actOssId: string | undefined =
    (req.query.x_actOssId as string) || (req.query.actOssId as string);

  console.log(`Received: newOssId = ${newOssId}, actOssId = ${actOssId}`);

  res.send(
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
               <div class="data">Osservatorio ID sostituito da <span id="ossId">${newOssId}</span> a <span id="actOssId">${actOssId}</span></div>
            </div>
         </body>
      </html>
   `
  );
});

app.listen(port, () => {
  console.log(`Service started and listening on port ${port}`);
});
