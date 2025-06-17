export interface ListinoRow {
  articolo: string;
  descrizione: string;
  prezzo: number;
}

export interface ListinoStats {
  reportDate: string;
  totalRows: number;
  modified: number;
  skipped: number;
  errored: number;
  delta: string;
  rows: ListinoRow[];
}


export function buildListinoHtml(stats: {
  reportDate: string;
  deltaYesterday: string;
  rows: {
    pv: string;
    product: string;
    prezzoServ: number;
    scontoServ: number;
    prezzoSelf: number;
    scontoSelf: number;
    prezzoOpt: number;
    scontoOpt: number;
    stacco: number;
    ordinato: number;
    note: string;
  }[];
}) {
  const rowsHtml = stats.rows.map(row => `
    <tr>
      <td>${row.pv}</td>
      <td>${row.product}</td>
      <td>${row.prezzoServ}</td>
      <td>${row.scontoServ}</td>
      <td>${row.prezzoSelf}</td>
      <td>${row.scontoSelf}</td>
      <td>${row.prezzoOpt}</td>
      <td>${row.scontoOpt}</td>
      <td>${row.stacco}</td>
      <td>${row.ordinato}</td>
      <td>${row.note}</td>
    </tr>
  `).join('');

  return `
    <h2>Listino Report - ${stats.reportDate}</h2>
    <p>Delta rispetto a ieri: ${stats.deltaYesterday}</p>
    <table border="1">
      <thead>
        <tr>
          <th>PV</th><th>Prodotto</th><th>Prezzo Serv</th><th>Sconto Serv</th>
          <th>Prezzo Self</th><th>Sconto Self</th><th>Prezzo Opt</th><th>Sconto Opt</th>
          <th>Stacco</th><th>Ordinato</th><th>Note</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}