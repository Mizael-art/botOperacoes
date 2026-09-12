import { Pool, QueryResult, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 10,
      ssl:
        connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
          ? false
          : { rejectUnauthorized: false },
    });

    pool.on("error", (err: Error) => {
      console.error("Erro inesperado no pool Postgres:", err.message);
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T> | null> {
  const p = getPool();
  if (!p) {
    return null;
  }
  try {
    return await p.query<T>(text, params);
  } catch (err: any) {
    console.error("Erro na consulta Postgres:", err.message);
    throw err;
  }
}
