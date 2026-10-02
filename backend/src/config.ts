import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// O .env fica na raiz do repositório e é compartilhado com o docker compose.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
loadEnv({ path: path.join(rootDir, '.env'), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não definida. Copie .env.example para .env e preencha.`);
  }
  return value;
}

export function loadDbConfig() {
  return {
    server: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 1433),
    user: process.env.DB_USER ?? 'sa',
    password: required('DB_PASSWORD'),
    database: process.env.DB_NAME ?? 'CadastroCurriculos',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    },
  };
}

export type DbConfig = ReturnType<typeof loadDbConfig>;

export const appConfig = {
  port: Number(process.env.PORT ?? 3333),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
