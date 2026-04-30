/**
 * @fileoverview datasources/db.ts
 *
 * PostgreSQL connection pool and Drizzle ORM instance.
 *
 * The `db` export is shared across resolvers via GraphQL context.
 * It includes the full schema object so relations and query builders work.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

/** node-postgres connection pool (singleton). */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://slots:slots@localhost:5432/lucky_slots',
});

export const db = drizzle(pool, { schema });
