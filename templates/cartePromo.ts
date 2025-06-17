export function buildCartePromoHtmlSimple(stats: {
  reportDate: string;
  rows: {
    GIORNO: string;
    PV: string;
    TIPO: string;
    TOTALE: string;
  }[];
  skippedCount: number;
  ok: number;
  err: number;
}) {
  const rowsHtml = stats.rows.map(row => `
    <tr>
      <td>${row.GIORNO}</td>
      <td>${row.PV}</td>
      <td>${row.TIPO}</td>
      <td>${row.TOTALE}</td>
    </tr>
  `).join('');

  return {
    ok: stats.ok,
    err: stats.err,
    html: `
      <h2>Report del ${stats.reportDate}</h2>
      <p>Righe Saltate: ${stats.skippedCount}</p>
      <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
        <thead>
          <tr>
            <th>Giorno</th>
            <th>PV</th>
            <th>Tipo</th>
            <th>Totale</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `
  };
}
