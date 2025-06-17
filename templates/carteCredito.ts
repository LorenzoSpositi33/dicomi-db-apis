// src/templates/carteCredito.ts
export function buildCarteCreditoHtml(params: {
  reportDate: string;
  totalRows: number;
  modified: number;
  skipped: number;
  errored: number;
  newCards: number;
  rows: Array<{
    timestamp: string;
    pv: string;
    article: string;
    volume: number;
    amount: number;
    price: number;
  }>;
}): string {
  const {
    reportDate,
    totalRows,
    modified,
    skipped,
    errored,
    newCards,
    rows
  } = params;

  // qui dentro componi il tuo HTML, ad esempio:
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><title>Report Carte Credito</title>
  <style>/* …stili simili agli altri… */</style>
</head>
<body>
  <div class="container">
    <h1>Estrazione carte credito del ${reportDate}</h1>
    <p>Righe totali: ${totalRows} | Modificate: ${modified} | Nuove carte: ${newCards} | Saltate: ${skipped} | Errori: ${errored}</p>
    <table>
      <thead><tr><th>Timestamp</th><th>PV</th><th>Articolo</th><th>Volume</th><th>Importo</th><th>Prezzo</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.timestamp}</td>
            <td>${r.pv}</td>
            <td>${r.article}</td>
            <td>${r.volume}</td>
            <td>${r.amount}</td>
            <td>${r.price}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
