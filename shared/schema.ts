import { z } from "zod";

export const WAGER_TIERS = [0.01, 0.1, 1, 10] as const;
export type WagerTier = typeof WAGER_TIERS[number];

export const GAME_MODES = {
  "1v1": { players: 2, rounds: 1, timer: 15, name: "1v1 Mode" },
  "2-round": { players: 4, rounds: 2, timer: 15, name: "2-Round Mode" },
  "3-round": { players: 8, rounds: 3, timer: 15, name: "3-Round Mode" },
  "4-round": { players: 16, rounds: 4, timer: 15, name: "4-Round Mode" },
} as const;

export type GameModeKey = keyof typeof GAME_MODES;

export const FOUNDATION_FEE = 0.09; // 9% to treasury
export const GIVEAWAY_FEE = 0.01;   // 1% to giveaway wallet
export const WINNER_SHARE = 0.9;

// WAGA reward multipliers (SOL amount * multiplier = WAGA tokens)
export const WAGA_ENTRY_MULTIPLIER = 100;
export const WAGA_WINNER_MULTIPLIER = 1000;

// God Streak / Streak Breaker constants
export const GOD_STREAK_CHANCE = 50;           // 50 in 1,000,000 games
export const GOD_STREAK_MIN_LENGTH = 26;
export const GOD_STREAK_MAX_LENGTH = 333;
export const GOD_STREAK_WIN_WEIGHT = 0.95;     // 95% win chance for God
export const BREAKER_CHANCE = 250000;          // 250,000 in 1,000,000 (25%)
export const BREAKER_WIN_WEIGHT = 0.75;        // 75% win for Giant Slayer if breaker
export const GOD_CAMPING_TIMEOUT_MS = 72 * 60 * 60 * 1000; // 72 hours

// God breaker WAGA bonus multipliers
export const NATURAL_BREAKER_WAGA_MULTIPLIER = 5;   // 5x on top of 1000x
export const TRIGGERED_BREAKER_WAGA_MULTIPLIER = 3; // 3x on top of 1000x

// Giveaway constants
export const GIVEAWAY_MILESTONE_GAMES = 1_000_000;
export const GIVEAWAY_MIN_SOL_FLOOR = 200; // Always show minimum 200 SOL
export const GIVEAWAY_PAYOUT_PERCENTS = [22, 16, 12, 10, 9, 8, 7, 6, 5, 5] as const;

// Chat constants
export const CHAT_MIN_TOTAL_WAGERED = 0.1; // Min 0.1 SOL wager history to chat
export const TIP_FEE_SOL = 0.001;          // Fixed fee per tip

export type GameStatus = "waiting" | "countdown" | "in_progress" | "resolving" | "completed";

export const playerSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  displayName: z.string().optional(),
  username: z.string().optional(),
  avatarUrl: z.string().optional(),
  joinedAt: z.number(),
  isEliminated: z.boolean().default(false),
  eliminatedRound: z.number().optional(),
  txSignature: z.string().optional(),
});

export type Player = z.infer<typeof playerSchema>;

export const roundSchema = z.object({
  roundNumber: z.number(),
  players: z.array(z.string()),
  winnerId: z.string().optional(),
  vrfSeed: z.string().optional(),
  resolvedAt: z.number().optional(),
});

export type Round = z.infer<typeof roundSchema>;

export const gameSchema = z.object({
  id: z.string(),
  onChainGameId: z.string().optional(),
  escrowPDA: z.string().optional(),
  mode: z.enum(["1v1", "2-round", "3-round", "4-round"]),
  wager: z.number(),
  status: z.enum(["waiting", "countdown", "in_progress", "resolving", "completed"]),
  players: z.array(playerSchema),
  rounds: z.array(roundSchema),
  currentRound: z.number(),
  poolAmount: z.number(),
  serverSeed: z.string().optional(),
  serverSeedReveal: z.string().optional(),
  serverSeedHash: z.string().optional(),
  clientSeed: z.string().optional(),
  winnerId: z.string().optional(),
  winnerPayout: z.number().optional(),
  winnerPayoutTxSig: z.string().optional(),
  treasuryFeeTxSig: z.string().optional(),
  giveawayFeeTxSig: z.string().optional(),
  wagaRewards: z.number().optional(),
  godStreakTriggered: z.boolean().optional(),
  godStreakRecipient: z.string().optional(),
  breakerTriggered: z.boolean().optional(),
  breakerPlayerId: z.string().optional(),
  naturalBreakerBonus: z.boolean().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  countdownEndsAt: z.number().optional(),
  roundEndsAt: z.number().optional(),
  createdAt: z.number(),
  serverTime: z.number().optional(),
});

export type Game = z.infer<typeof gameSchema>;

export const insertGameSchema = z.object({
  mode: z.enum(["1v1", "2-round", "3-round", "4-round"]),
  wager: z.number(),
});

export type InsertGame = z.infer<typeof insertGameSchema>;

export const playerProfileSchema = z.object({
  walletAddress: z.string(),
  displayName: z.string().optional(),
  username: z.string().optional(),
  avatarUrl: z.string().optional(),
  usernameUpdatedAt: z.number().optional(),
  usernameUpdateCount: z.number().default(0),
  referredBy: z.string().optional(),
  pendingReferralBy: z.string().optional(),
  referralRewarded: z.boolean().default(false),
  referralCount: z.number().default(0),
  gamesPlayed: z.number().default(0),
  gamesWon: z.number().default(0),
  totalWagered: z.number().default(0),
  totalWon: z.number().default(0),
  wagaEarned: z.number().default(0),
  wagaVestingTotal: z.number().default(0),
  wagaVestingClaimed: z.number().default(0),
  wagaVestingLastClaim: z.number().optional(),
  currentStreak: z.number().default(0),
  bestStreak: z.number().default(0),
  luckScore: z.number().default(50),
  // God Streak fields
  godStreakActive: z.boolean().default(false),
  godStreakLength: z.number().default(0),
  godStreakGamesRemaining: z.number().default(0),
  godStreakStartedAt: z.number().optional(),
  godStreakLastPlayedAt: z.number().optional(),
  isStreakBreakerActive: z.boolean().default(false),
  godStreaksAchieved: z.number().default(0),
  streaksBeaten: z.number().default(0),
  createdAt: z.number(),
  lastPlayedAt: z.number().optional(),
});

export const VESTING_DAILY_PERCENT = 10;
export const VESTING_PERIOD_MS = 24 * 60 * 60 * 1000;

export const REFERRAL_REWARD_AMOUNT = 100;
export const USERNAME_COST_USD_FIRST = 1.0;
export const USERNAME_COST_USD_SUBSEQUENT = 0.5;

export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  walletAddress: z.string(),
  username: z.string().optional(),
  message: z.string(),
  timestamp: z.number(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const insertChatMessageSchema = chatMessageSchema.omit({ id: true, timestamp: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Global chat (separate from game-specific chat)
export const globalChatMessageSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  username: z.string().optional(),
  message: z.string(),
  timestamp: z.number(),
  isGodStreak: z.boolean().default(false),
  isStreakBreaker: z.boolean().default(false),
  tipAmount: z.number().optional(),
  tipRecipient: z.string().optional(),
});

export type GlobalChatMessage = z.infer<typeof globalChatMessageSchema>;

// Giveaway stats
export const giveawayStatsSchema = z.object({
  totalGamesPlayed: z.number().default(0),
  cycleStartGameCount: z.number().default(0),
  giveawayWalletBalance: z.number().default(0),
  lastUpdatedAt: z.number().default(0),
  currentCycleStart: z.number().default(0),
  currentSeason: z.number().default(1),
});

export type GiveawayStats = z.infer<typeof giveawayStatsSchema>;

export const giveawayWinnerSchema = z.object({
  id: z.string(),
  season: z.number(),
  walletAddress: z.string(),
  username: z.string().optional(),
  payoutSol: z.number(),
  type: z.enum(["luck", "streak"]),
  rank: z.number(),
  wonAt: z.number(),
});

export type GiveawayWinner = z.infer<typeof giveawayWinnerSchema>;

export const usernameSchema = z.string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9._-]+$/, "Usernames can only contain letters, numbers, _, -, and .");

export const leaderboardEntrySchema = z.object({
  rank: z.number(),
  walletAddress: z.string(),
  displayName: z.string().optional(),
  totalWon: z.number(),
  gamesWon: z.number(),
  gamesPlayed: z.number().optional(),
  winRate: z.number(),
  luckScore: z.number(),
  bestStreak: z.number(),
  godStreakActive: z.boolean().optional(),
  isStreakBreakerActive: z.boolean().optional(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export type LeaderboardPeriod = "all" | "daily" | "weekly" | "monthly";

export const gameHistorySchema = z.object({
  gameId: z.string(),
  mode: z.enum(["1v1", "2-round", "3-round", "4-round"]),
  wager: z.number(),
  result: z.enum(["won", "lost"]),
  payout: z.number().optional(),
  wagaEarned: z.number(),
  playedAt: z.number(),
  totalPlayers: z.number().optional(),
  poolAmount: z.number().optional(),
  roundsSurvived: z.number().optional(),
  godStreakGame: z.boolean().optional(),
  brokeGodStreak: z.boolean().optional(),
  opponents: z.array(z.object({
    walletAddress: z.string(),
    displayName: z.string().optional(),
  })).optional(),
});

export type GameHistory = z.infer<typeof gameHistorySchema>;

export const users = {
  id: "",
  username: "",
  password: "",
};

export type InsertUser = { username: string; password: string };
export type User = { id: string; username: string; password: string };
