import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

// Uma conexão ociosa do pool pode cair (ex.: timeout do provedor) sem
// que nenhuma query esteja em andamento. Sem este handler, esse erro
// derrubaria o processo inteiro (unhandled 'error' event).
pool.on("error", (err) => {
  logger.error({ err }, "Erro inesperado em conexão ociosa do pool Postgres");
});
