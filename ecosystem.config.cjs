module.exports = {
  apps: [
    {
      name: "node-dicomi-db-apis",
      script: "./.dist/main.js",
      autorestart: true,
      max_memory_restart: "1G",
      restart_delay: 5000,
      min_uptime: 5000,
      error_file: "./logs/errors.log",
      out_file: "./logs/app.log",
      log_file: "./logs/full.log",
      time: true,
      merge_logs: true,
    }
  ]
};
