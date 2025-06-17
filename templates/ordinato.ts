export interface OrdinatoRow {
  date: string;
  total: number;
  ok: number;
  warn: number;
  err: number;
}

export interface OrdinatoStats {
  reportDate: string;
  dateFile: string;
  totalRows: number;
  avgPast: number;
  rows: OrdinatoRow[];
}


export function buildOrdinatoHtml(stats: {
  reportDate: string;
  summaryTable: string;
  mediaGlobal: number;
}) {
  return `
    <div>
      <h2>Report del ${stats.reportDate}</h2>
      <p>Media Storica: ${stats.mediaGlobal}</p>
      ${stats.summaryTable}
    </div>
  `;
}