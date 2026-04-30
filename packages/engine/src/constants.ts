export const THRESHOLDS = {
  ten: 450,
  jack: 550,
  queen: 750,
  king: 880,
  ace: 970,
  wild: 990,
  bonus: 999,
} as const;

export const BET_AMOUNTS = [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000] as const;

export const DEFAULT_BALANCE = 1000.0;
export const DEFAULT_BET = 0.1;

export const MULTIPLIERS: Record<string, number> = {
  '3 Ten': 0.25,
  '4 Ten': 1,
  '5 Ten': 5,
  '3 Jack': 0.5,
  '4 Jack': 2,
  '5 Jack': 10,
  '3 Queen': 1,
  '4 Queen': 4,
  '5 Queen': 20,
  '3 King': 2,
  '4 King': 8,
  '5 King': 40,
  '3 Ace': 4,
  '4 Ace': 12,
  '5 Ace': 56,
};
