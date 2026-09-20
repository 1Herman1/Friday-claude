// PM2-конфиг сервера Simba (Fastify).
// Запуск из корня репозитория: pm2 start projects/simba/deploy/ecosystem.config.js
// Переменные окружения читаются из projects/simba/server/.env (dotenv в приложении).
module.exports = {
  apps: [
    {
      name: 'simba-server',
      cwd: './projects/simba/server',
      script: 'dist/index.js',
      // Node 20+ грузит projects/simba/server/.env сам (в приложении нет dotenv).
      node_args: '--env-file=.env',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '400M',
      autorestart: true,
    },
  ],
}
