export interface CarteCreditoStats {
  reportDate: string;
  totalRows: number;
  newCards: number;
  errors: number;
}


export function buildCarteCreditoHtml(stats: {
  reportDate: string;
  totalRows: number;
  newCards: number;
  errors: number;
}) {
  return `
    <h2>Report Carte Credito - ${stats.reportDate}</h2>
    <p>Totale Righe: ${stats.totalRows}</p>
    <p>Nuove Carte Inserite: ${stats.newCards}</p>
    <p>Errori: ${stats.errors}</p>
  `;
}