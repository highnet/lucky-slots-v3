import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://slots:slots@localhost:5432/lucky_slots',
});

export const db = drizzle(pool, { schema });
