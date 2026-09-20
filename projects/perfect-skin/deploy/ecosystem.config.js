// PM2-конфиг сервера Perfect Skin (Fastify).
// Запуск из корня репозитория: pm2 start projects/perfect-skin/deploy/ecosystem.config.js
// Переменные окружения читаются из projects/perfect-skin/server/.env (dotenv в приложении).
module.exports = {
  apps: [
    {
      name: 'ps-server',
      cwd: './projects/perfect-skin/server',
      script: 'dist/index.js',
      // Node 20+ грузит projects/perfect-skin/server/.env сам (в приложении нет dotenv).
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
      },
      max_memory_restart: '400M',
      autorestart: true,
    },
  ],
}
