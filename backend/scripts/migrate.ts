/**
 * Aplica as migrations SQL de backend/db/migrations em ordem.
 *
 * - Cria o banco (DB_NAME) se ele ainda não existir.
 * - Registra cada arquivo aplicado em dbo.SchemaMigrations, então pode ser
 *   executado várias vezes sem efeito colateral.
 * - Cada arquivo roda em uma transação; os lotes são separados por "GO".
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { loadDbConfig } from '../src/config.js';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const config = loadDbConfig();

async function ensureDatabase() {
  const master = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
  try {
    await master
      .request()
      .input('name', sql.NVarChar(128), config.database)
      .query(`
        IF DB_ID(@name) IS NULL
        BEGIN
          DECLARE @sql NVARCHAR(400) = N'CREATE DATABASE ' + QUOTENAME(@name);
          EXEC (@sql);
        END
      `);
  } finally {
    await master.close();
  }
}

const splitBatches = (script: string) =>
  script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);

async function run() {
  console.log(`Conectando em ${config.server}:${config.port}...`);
  await ensureDatabase();

  const pool = await new sql.ConnectionPool(config).connect();
  try {
    await pool.request().query(`
      IF OBJECT_ID('dbo.SchemaMigrations') IS NULL
        CREATE TABLE dbo.SchemaMigrations (
          Name      NVARCHAR(255) NOT NULL PRIMARY KEY,
          AppliedAt DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME()
        );
    `);

    const applied = new Set(
      (await pool.request().query<{ Name: string }>('SELECT Name FROM dbo.SchemaMigrations')).recordset.map(
        (row) => row.Name,
      ),
    );

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    let count = 0;

    for (const file of files) {
      if (applied.has(file)) continue;

      const script = await readFile(path.join(migrationsDir, file), 'utf8');
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        for (const batch of splitBatches(script)) {
          await new sql.Request(transaction).batch(batch);
        }
        await new sql.Request(transaction)
          .input('name', sql.NVarChar(255), file)
          .query('INSERT INTO dbo.SchemaMigrations (Name) VALUES (@name)');
        await transaction.commit();
        console.log(`  aplicada: ${file}`);
        count++;
      } catch (err) {
        await transaction.rollback();
        throw new Error(`Falha na migration ${file}: ${(err as Error).message}`);
      }
    }

    console.log(count ? `${count} migration(s) aplicada(s) em ${config.database}.` : 'Banco já está atualizado.');
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
