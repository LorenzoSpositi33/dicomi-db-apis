export interface TradingAreaRow {
  pv: string;
  prezzoMedio: number;
  note?: string;
}

export interface TradingAreaStats {
  reportDate: string;
  totalRows: number;
  modified: number;
  skipped: number;
  errored: number;
  rows: TradingAreaRow[];
}


export function buildTradingAreaHtml(stats: {
  reportDate: string;
  rows: {
    pv: string;
    brand: string;
    addr: string;
    prod: string;
    main: boolean;
    self: number;
    serv: number;
    close: number;
  }[];
}) {
  const rowsHtml = stats.rows.map(r => `
    <tr>
      <td>${r.pv}</td>
      <td>${r.brand}</td>
      <td>${r.addr}</td>
      <td>${r.prod}</td>
      <td>${r.main}</td>
      <td>${r.self}</td>
      <td>${r.serv}</td>
      <td>${r.close}</td>
    </tr>
  `).join('');
  return `
    <h2>Trading Area Report - ${stats.reportDate}</h2>
    <table border="1">
      <thead>
        <tr><th>PV</th><th>Brand</th><th>Indirizzo</th><th>Prodotto</th><th>Main</th><th>Self</th><th>Serv</th><th>Chiusi</th></tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
