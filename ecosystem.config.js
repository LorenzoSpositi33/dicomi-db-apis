export const apps = [{
  name: "node-dicomi-db-apis",
  script: "./.dist/main.js",
  autorestart: true, // Ricomincia l'esecuzione ogni volta che il processo si arresta
  max_memory_restart: "1G", // Riavvia il processo se utilizza più di 1GB di memoria
  // cron_restart: "0 0 * * *", // Riavvia il processo ogni giorno a mezzanotte
  restart_delay: 5000, // Aspetta 5 secondi prima di riavviare il processo,
  min_uptime: 5000, // Aspetta 5 secondi prima di considerare il processo avviato
}];
