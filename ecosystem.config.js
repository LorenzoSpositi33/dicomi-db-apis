export const apps = [
  {
    name: "node-dicomi-db-apis",
    script: "./.dist/main.js",
    autorestart: true,
    max_memory_restart: "1G",
    restart_delay: 5000,
    min_uptime: 5000
  }
];
