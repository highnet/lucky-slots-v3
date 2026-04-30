import { pgTable, uuid, varchar, decimal, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  balance: decimal('balance', { precision: 12, scale: 2 }).notNull().default('1000.00'),
  currentBet: decimal('current_bet', { precision: 12, scale: 2 }).notNull().default('0.10'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const spins = pgTable('spins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  symbols: jsonb('symbols').notNull(),
  winningPaths: jsonb('winning_paths').notNull().default('[]'),
  bet: decimal('bet', { precision: 12, scale: 2 }).notNull(),
  multiplier: decimal('multiplier', { precision: 12, scale: 4 }).notNull(),
  winnings: decimal('winnings', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userCreatedIdx: index('idx_spins_user_created').on(table.userId, table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Spin = typeof spins.$inferSelect;
export type NewSpin = typeof spins.$inferInsert;
