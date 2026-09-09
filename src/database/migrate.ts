import fs from "node:fs";
import path from "node:path";
import { pool } from "./pool";
import { logger } from "../config/logger";

/**
 * Migration runner minimalista: aplica, em ordem alfabética, os arquivos
 * .sql de src/database/schema/ que ainda não constam na tabela
 * schema_migrations. Cada arquivo roda dentro de uma transação.
 *
 * Uso: npm run db:migrate
 */
async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(result.rows.map((r) => r.filename));
}

export async function runMigrations(options: { closePool?: boolean } = {}) {
  const schemaDir = fs.existsSync(path.join(__dirname, "schema"))
    ? path.join(__dirname, "schema")
    : path.join(process.cwd(), "src", "database", "schema");

  if (!fs.existsSync(schemaDir)) {
    logger.warn({ schemaDir }, "Diretório de schema não encontrado. Pulando migrations.");
    return;
  }

  const files = fs
    .readdirSync(schemaDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  let ranAny = false;

  for (const file of files) {
    if (applied.has(file)) {
      logger.info({ file }, "Migration já aplicada, pulando");
      continue;
    }

    const sql = fs.readFileSync(path.join(schemaDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      logger.info({ file }, "✅ Migration aplicada");
      ranAny = true;
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err, file }, "❌ Falha ao aplicar migration");
      throw err;
    } finally {
      client.release();
    }
  }

  if (!ranAny) {
    logger.info("Nenhuma migration pendente.");
  }

  if (options.closePool) {
    await pool.end();
  }
}

// Execução direta via CLI (ex: npm run db:migrate)
if (require.main === module) {
  runMigrations({ closePool: true }).catch((err) => {
    logger.error({ err }, "Migração abortada");
    process.exit(1);
  });
}
