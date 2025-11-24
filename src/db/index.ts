import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import schema from "./schemas";
import logger from "../utils/logger";
import config from "../config";

const pool = new Pool({
    connectionString: config.DATABASE_URL,
});

// Log any connection errors
pool.on('error', (err) => {
    logger("[DB]").error('Unexpected error on idle client', err);
    process.exit(-1); // Exit process if database connection fails critically
});

export const db = drizzle({ client: pool, schema });
export type DBType = typeof db
