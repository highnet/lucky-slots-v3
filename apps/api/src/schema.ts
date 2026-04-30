import { makeExecutableSchema } from '@graphql-tools/schema';

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
  }

  type LeaderboardEntry {
    username: String!
    balance: Float!
    rank: Int!
  }

  type Query {
    me: User
    mySpins(limit: Int = 20, offset: Int = 0): [SpinResult!]!
    leaderboard: [LeaderboardEntry!]!
    reelStrips: [[Symbol!]!]!
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

export function createSchema(resolvers: any) {
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}
