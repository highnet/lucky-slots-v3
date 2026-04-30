/**
 * @fileoverview schema.ts
 *
 * GraphQL type definitions (SDL) and schema factory for the Lucky Slots API.
 *
 * All domain types—User, SpinResult, Symbol, GridConfig, etc.—are declared
 * here. Resolver implementations live in `resolvers/` and are merged in
 * {@link index.ts} before being passed to {@link createSchema}.
 */

import { makeExecutableSchema } from '@graphql-tools/schema';
import type { IResolvers } from '@graphql-tools/utils';

/** Raw GraphQL schema string exported for tooling and server bootstrap. */
export const typeDefs = /* GraphQL */ `
  enum Symbol {
    TEN
    JACK
    QUEEN
    KING
    ACE
    WILD
    BONUS
  }

  type User {
    id: ID!
    username: String!
    balance: Float!
    currentBet: Float!
  }

  type Coordinate {
    row: Int!
    col: Int!
  }

  type PaylinePath {
    symbol: Symbol!
    size: Int!
    coordinates: [Coordinate!]!
  }

  type SpinResult {
    id: ID!
    symbols: [[Symbol!]!]!
    winningPaths: [PaylinePath!]!
    multiplier: Float!
    winnings: Float!
    bet: Float!
    newBalance: Float!
    timestamp: String!
    # Provably fair fields
    serverSeed: String!
    serverHash: String!
    clientSeed: String!
    nonce: Int!
    # Commitment for the next spin
    nextServerHash: String!
    nextNonce: Int!
  }

  type Commitment {
    serverHash: String!
    clientSeed: String!
    nonce: Int!
  }

  type VerificationResult {
    spinId: ID!
    match: Boolean!
    serverSeed: String!
    serverHash: String!
    clientSeed: String!
    nonce: Int!
    recomputedGrid: [[Symbol!]!]!
  }

  type LeaderboardEntry {
    username: String!
    balance: Float!
    rank: Int!
  }

  type GridConfig {
    rows: Int!
    cols: Int!
    minMatch: Int!
    numSymbols: Int!
    stripSize: Int!
    paylineSymbols: Int!
  }

  type Query {
    me: User
    mySpins(limit: Int = 20, offset: Int = 0): [SpinResult!]!
    leaderboard: [LeaderboardEntry!]!
    reelStrips: [[Symbol!]!]!
    gridConfig: GridConfig!
    nextCommitment: Commitment!
    verifySpin(id: ID!): VerificationResult!
  }

  type Mutation {
    register(username: String!, password: String!): User!
    login(username: String!, password: String!): User!
    logout: Boolean!
    setBet(amount: Float!): User!
    cycleBet: User!
    spin: SpinResult!
  }

  type Subscription {
    leaderboardUpdated: [LeaderboardEntry!]!
  }
`;

export function createSchema(resolvers: IResolvers) {
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}
