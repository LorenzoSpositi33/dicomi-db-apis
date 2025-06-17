export interface CartePromoRow {
  pv: string;
  tipo: string;
  conteggio: number;
}

export interface CartePromoStats {
  reportDate: string;
  totalRows: number;
  modified: number;
  skipped: number;
  errored: number;
  rows: CartePromoRow[];
}


export function buildCartePromoHtml(stats: {
  reportDate: string;
  rows: {
    timestamp: string;
    pv: string;
    article: string;
    volume: number;
    amount: number;
    price: number;
  }[];
  skippedCount: number;
  ok: number;
  err: number;
}) {
  const rowsHtml = stats.rows.map(row => `
    <tr>
      <td>${row.timestamp}</td>
      <td>${row.pv}</td>
      <td>${row.article}</td>
      <td>${row.volume}</td>
      <td>${row.amount}</td>
      <td>${row.price}</td>
    </tr>
  `).join('');

  return {
    ok: stats.ok,
    err: stats.err,
    html: `
      <h2>Report del ${stats.reportDate}</h2>
      <p>Righe Saltate: ${stats.skippedCount}</p>
      <table border="1">
        <thead>
          <tr><th>Timestamp</th><th>PV</th><th>Articolo</th><th>Volume</th><th>Importo</th><th>Prezzo</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `
  };
}