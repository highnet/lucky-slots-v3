/**
 * @fileoverview db/schema.ts
 *
 * Drizzle ORM table definitions for the Lucky Slots PostgreSQL database.
 *
 * Tables:
 *   - `users`    – player accounts, balances, and provably-fair seeds
 *   - `spins`    – immutable record of every spin outcome
 *
 * Types are inferred automatically from the schema definitions.
 */

import { pgTable, uuid, varchar, decimal, timestamp, jsonb, index, bigint } from 'drizzle-orm/pg-core';

/** Registered players and their persisted state. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  balance: decimal('balance', { precision: 12, scale: 2 }).notNull().default('1000.00'),
  currentBet: decimal('current_bet', { precision: 12, scale: 2 }).notNull().default('0.10'),
  /** Fixed per-user seed for provably fair verification. */
  clientSeed: varchar('client_seed', { length: 64 }).notNull().default(''),
  /** Next nonce to use for the upcoming spin (global per user). */
  nextNonce: bigint('next_nonce', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const spins = pgTable('spins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  symbols: jsonb('symbols').notNull(),
  winningPaths: jsonb('winning_paths').notNull().default('[]'),
  /** Server seed revealed after the spin for verification. */
  serverSeed: varchar('server_seed', { length: 64 }).notNull().default(''),
  /** Commitment hash shown to client before the spin. */
  serverHash: varchar('server_hash', { length: 64 }).notNull().default(''),
  /** Copy of client seed for independent verification. */
  clientSeed: varchar('client_seed', { length: 64 }).notNull().default(''),
  /** Nonce used for this spin. */
  nonce: bigint('nonce', { mode: 'number' }).notNull().default(0),
  bet: decimal('bet', { precision: 12, scale: 2 }).notNull(),
  multiplier: decimal('multiplier', { precision: 12, scale: 4 }).notNull(),
  winnings: decimal('winnings', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userCreatedIdx: index('idx_spins_user_created').on(table.userId, table.createdAt),
}));

/** Inferred select type for the `users` table. */
export type User = typeof users.$inferSelect;
/** Inferred insert type for the `users` table. */
export type NewUser = typeof users.$inferInsert;
/** Inferred select type for the `spins` table. */
export type Spin = typeof spins.$inferSelect;
/** Inferred insert type for the `spins` table. */
export type NewSpin = typeof spins.$inferInsert;
