import { appConfig, loadDbConfig } from './config.js';
import { connect, type sql } from './db.js';
import { createApp } from './app.js';
import { SqlCandidateRepository } from './candidates/repository.js';
import { extractPdfText } from './resumes/pdf-text.js';

const dbConfig = loadDbConfig();

let pool: sql.ConnectionPool;
try {
  pool = await connect(dbConfig);
} catch (err) {
  console.error(
    `Não foi possível conectar ao SQL Server em ${dbConfig.server}:${dbConfig.port}.\n` +
      'Verifique se o container está rodando (npm run db:up) e se as migrations foram aplicadas (npm run db:migrate).',
  );
  console.error((err as Error).message);
  process.exit(1);
}

const app = createApp({
  candidates: new SqlCandidateRepository(pool),
  extractPdfText,
  checkDatabase: async () => {
    await pool.request().query('SELECT 1');
  },
  corsOrigin: appConfig.corsOrigin,
});

const server = app.listen(appConfig.port, () => {
  console.log(`API ouvindo em http://localhost:${appConfig.port}`);
});

const shutdown = () => {
  server.close();
  void pool.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
