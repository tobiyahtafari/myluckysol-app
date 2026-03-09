import { PgStorage } from "./pg-storage";
import {
  users,
  type PlayerProfile,
  type Game,
  type InsertGame,
  type GameHistory,
  type ChatMessage,
  type GlobalChatMessage,
  type GiveawayStats,
  type GiveawayWinner,
  type GameModeKey,
  type WagerTier,
  type LeaderboardEntry,
  type LeaderboardPeriod,
  GAME_MODES,
  WAGA_ENTRY_MULTIPLIER,
  WAGA_WINNER_MULTIPLIER,
  WINNER_SHARE,
  FOUNDATION_FEE,
  VESTING_DAILY_PERCENT,
  VESTING_PERIOD_MS,
  REFERRAL_REWARD_AMOUNT,
  GOD_STREAK_CHANCE,
  GOD_STREAK_MIN_LENGTH,
  GOD_STREAK_MAX_LENGTH,
  GOD_STREAK_WIN_WEIGHT,
  BREAKER_CHANCE,
  BREAKER_WIN_WEIGHT,
  GOD_CAMPING_TIMEOUT_MS,
  NATURAL_BREAKER_WAGA_MULTIPLIER,
  TRIGGERED_BREAKER_WAGA_MULTIPLIER,
  GIVEAWAY_FEE,
  GIVEAWAY_MILESTONE_GAMES,
  GIVEAWAY_MIN_SOL_FLOOR,
  GIVEAWAY_PAYOUT_PERCENTS,
} from "@shared/schema";
import { calculateWagaReward } from "./price-service";
import { solanaClient } from "./solana-client";
import { createHmac, randomBytes } from "crypto";

export interface IStorage {
  getProfile(walletAddress: string): Promise<PlayerProfile | undefined>;
  getProfileByUsername(username: string): Promise<PlayerProfile | undefined>;
  getProfileByUsernameOrWallet(identifier: string): Promise<PlayerProfile | undefined>;
  createProfile(data: { walletAddress: string; displayName?: string }): Promise<PlayerProfile>;
  updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined>;
  getOrCreateProfile(walletAddress: string): Promise<PlayerProfile>;
  checkUsernameUnique(username: string): Promise<boolean>;
  grantPendingReferralRewards(walletAddress: string): Promise<{ granted: boolean; referrerWallet?: string } | null>;
  rollbackReferralRewards(walletAddress: string): Promise<void>;
  previewVestedClaim(walletAddress: string): Promise<{ canClaim: boolean; claimAmount: number; remainingVesting: number; nextClaimTime: number } | null>;
  commitVestedClaim(walletAddress: string, claimAmount: number): Promise<void>;
  getChatMessages(gameId: string): Promise<ChatMessage[]>;
  addChatMessage(data: ChatMessage): Promise<ChatMessage>;
  getGlobalChatMessages(limit?: number): Promise<GlobalChatMessage[]>;
  addGlobalChatMessage(data: any): Promise<any>;
  getGameHistory(walletAddress: string, limit: number): Promise<GameHistory[]>;
  addGameHistory(walletAddress: string, history: GameHistory): Promise<void>;
  getGame(id: string): Promise<Game | undefined>;
  getLiveGames(): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined>;
  updateGameStatus(id: string, status: string): Promise<Game | undefined>;
  findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined>;
  joinGame(gameId: string, walletAddress: string, txSignature?: string): Promise<Game | undefined>;
  getLeaderboard(sortBy: "earnings" | "luck" | "streaks", limit?: number, period?: LeaderboardPeriod): Promise<LeaderboardEntry[]>;
  storeAvatarImage(walletAddress: string, data: Buffer, contentType: string): void;
  getAvatarImage(walletAddress: string): { data: Buffer; contentType: string } | null;
  getGlobalStats(): Promise<{ gamesPlayed: number; solWon: number; playersCount: number; wagaRewarded: number }>;
  getCompletedGames(limit?: number): Promise<Game[]>;
  verifyGame(serverSeedHash: string): Promise<Game | undefined>;
  getGiveawayStats(): Promise<GiveawayStats>;
  getGiveawayLeaderboard(): Promise<{ luck: LeaderboardEntry[]; streaks: LeaderboardEntry[] }>;
  checkAndExpireGodStreak(walletAddress: string): Promise<void>;
  getAllProfiles(): Promise<PlayerProfile[]>;
  isTransactionUsed(signature: string): Promise<boolean>;
  markTransactionUsed(signature: string, walletAddress: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private profiles: Map<string, PlayerProfile>;
  private games: Map<string, Game>;
  private chatMessages: Map<string, ChatMessage[]>;
  private globalChatMessages: GlobalChatMessage[];
  private gameHistory: Map<string, GameHistory[]>;
  private avatarImages: Map<string, { data: Buffer; contentType: string }>;
  private giveawayStats: GiveawayStats;
  private giveawayWinners: GiveawayWinner[];
  private usedTxSignatures: Set<string>;

  constructor() {
    this.profiles = new Map();
    this.games = new Map();
    this.avatarImages = new Map();
    this.chatMessages = new Map();
    this.globalChatMessages = [];
    this.gameHistory = new Map();
    this.giveawayWinners = [];
    this.usedTxSignatures = new Set();
    this.giveawayStats = {
      totalGamesPlayed: 0,
      cycleStartGameCount: 0,
      giveawayWalletBalance: 0,
      lastUpdatedAt: Date.now(),
      currentCycleStart: Date.now(),
      currentSeason: 1,
    };
  }

  async getProfile(walletAddress: string): Promise<PlayerProfile | undefined> {
    return this.profiles.get(walletAddress);
  }

  async getProfileByUsername(username: string): Promise<PlayerProfile | undefined> {
    const profiles = Array.from(this.profiles.values());
    return profiles.find(p => p.username?.toLowerCase() === username.toLowerCase());
  }

  async createProfile(data: { walletAddress: string; displayName?: string }): Promise<PlayerProfile> {
    const profile: PlayerProfile = {
      walletAddress: data.walletAddress,
      displayName: data.displayName || "",
      usernameUpdateCount: 0,
      referralRewarded: false,
      referralCount: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      totalWagered: 0,
      totalWon: 0,
      wagaEarned: 0,
      wagaVestingTotal: 0,
      wagaVestingClaimed: 0,
      currentStreak: 0,
      bestStreak: 0,
      luckScore: 50,
      godStreakActive: false,
      godStreakLength: 0,
      godStreakGamesRemaining: 0,
      isStreakBreakerActive: false,
      godStreaksAchieved: 0,
      streaksBeaten: 0,
      createdAt: Date.now(),
    };
    this.profiles.set(data.walletAddress, profile);
    return profile;
  }

  async updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined> {
    const profile = this.profiles.get(walletAddress);
    if (!profile) return undefined;
    
    if (updates.referredBy && !profile.referredBy && !profile.pendingReferralBy && updates.referredBy !== walletAddress) {
      const referrer = await this.getProfileByUsernameOrWallet(updates.referredBy);
      
      if (referrer && referrer.walletAddress !== walletAddress) {
        // ABUSE PREVENTION: Check if the referrer is already referred by the current user (cyclic referral)
        if (referrer.pendingReferralBy === walletAddress) {
          console.warn(`[REFERRAL] Cyclic referral blocked: ${walletAddress.slice(0, 8)}... tried to be referred by ${referrer.walletAddress.slice(0, 8)}...`);
          delete updates.referredBy;
        } else {
          updates.pendingReferralBy = referrer.walletAddress;
          // Store the referrer's username or wallet address
          updates.referredBy = referrer.username || referrer.walletAddress;
          updates.referralRewarded = false;
          console.log(`[REFERRAL] Pending referral set: ${walletAddress.slice(0, 8)}... referred by ${referrer.walletAddress.slice(0, 8)}...`);
        }
      } else {
        delete updates.referredBy;
      }
    }

    const updated = { ...profile, ...updates };
    this.profiles.set(walletAddress, updated);
    return updated;
  }

  async grantPendingReferralRewards(walletAddress: string): Promise<{ granted: boolean; referrerWallet?: string } | null> {
    const profile = this.profiles.get(walletAddress);
    if (!profile) return null;

    if (!profile.pendingReferralBy || profile.referralRewarded) {
      return { granted: false };
    }

    const referrer = this.profiles.get(profile.pendingReferralBy);
    if (!referrer) {
      return { granted: false };
    }

    referrer.wagaEarned = (referrer.wagaEarned || 0) + REFERRAL_REWARD_AMOUNT;
    referrer.referralCount = (referrer.referralCount || 0) + 1;
    this.profiles.set(referrer.walletAddress, referrer);

    profile.wagaEarned = (profile.wagaEarned || 0) + REFERRAL_REWARD_AMOUNT;
    profile.referralRewarded = true;
    this.profiles.set(walletAddress, profile);

    console.log(`[REFERRAL] Rewards granted! ${walletAddress.slice(0, 8)}... and ${referrer.walletAddress.slice(0, 8)}... each received ${REFERRAL_REWARD_AMOUNT} WAGA`);

    return { granted: true, referrerWallet: referrer.walletAddress };
  }

  async getProfileByUsernameOrWallet(input: string): Promise<PlayerProfile | undefined> {
    const profile = this.profiles.get(input);
    if (profile) return profile;

    for (const p of this.profiles.values()) {
      if (p.username?.toLowerCase() === input.toLowerCase()) {
        return p;
      }
    }
    return undefined;
  }

  async rollbackReferralRewards(walletAddress: string): Promise<void> {
    const profile = this.profiles.get(walletAddress);
    if (!profile) return;

    if (profile.pendingReferralBy) {
      const referrer = this.profiles.get(profile.pendingReferralBy);
      if (referrer) {
        referrer.wagaEarned = Math.max(0, (referrer.wagaEarned || 0) - REFERRAL_REWARD_AMOUNT);
        referrer.referralCount = Math.max(0, (referrer.referralCount || 0) - 1);
        this.profiles.set(referrer.walletAddress, referrer);
      }
    }

    profile.wagaEarned = Math.max(0, (profile.wagaEarned || 0) - REFERRAL_REWARD_AMOUNT);
    profile.referralRewarded = false;
    this.profiles.set(walletAddress, profile);
    console.log(`[REFERRAL] Rolled back referral rewards for ${walletAddress.slice(0, 8)}...`);
  }

  async getOrCreateProfile(walletAddress: string): Promise<PlayerProfile> {
    let profile = await this.getProfile(walletAddress);
    if (!profile) {
      profile = await this.createProfile({ walletAddress });
    }
    return profile;
  }

  async checkUsernameUnique(username: string): Promise<boolean> {
    const profiles = Array.from(this.profiles.values());
    return !profiles.some(p => p.username === username);
  }

  async checkAndExpireGodStreak(walletAddress: string): Promise<void> {
    const profile = this.profiles.get(walletAddress);
    if (!profile || !profile.godStreakActive) return;

    const now = Date.now();
    const lastPlayed = profile.godStreakLastPlayedAt || profile.godStreakStartedAt || 0;

    if (now - lastPlayed > GOD_CAMPING_TIMEOUT_MS) {
      console.log(`[GOD STREAK] ${walletAddress.slice(0, 8)}... streak expired due to 72-hour inactivity`);
      await this.updateProfile(walletAddress, {
        godStreakActive: false,
        godStreakGamesRemaining: 0,
        isStreakBreakerActive: false,
      });
    }
  }

  async previewVestedClaim(walletAddress: string): Promise<{ canClaim: boolean; claimAmount: number; remainingVesting: number; nextClaimTime: number } | null> {
    const profile = this.profiles.get(walletAddress);
    if (!profile) return null;

    const now = Date.now();
    const lastClaim = profile.wagaVestingLastClaim || 0;

    if (lastClaim > 0 && (now - lastClaim) < VESTING_PERIOD_MS) {
      return {
        canClaim: false,
        claimAmount: 0,
        remainingVesting: (profile.wagaVestingTotal || 0) - (profile.wagaVestingClaimed || 0),
        nextClaimTime: lastClaim + VESTING_PERIOD_MS,
      };
    }

    const totalVesting = profile.wagaVestingTotal || 0;
    const alreadyClaimed = profile.wagaVestingClaimed || 0;
    const remainingVesting = totalVesting - alreadyClaimed;

    if (remainingVesting <= 0) {
      return { canClaim: false, claimAmount: 0, remainingVesting: 0, nextClaimTime: 0 };
    }

    const claimAmount = Math.ceil(remainingVesting * (VESTING_DAILY_PERCENT / 100));

    if (claimAmount <= 0) {
      return { canClaim: false, claimAmount: 0, remainingVesting, nextClaimTime: 0 };
    }

    return { canClaim: true, claimAmount, remainingVesting, nextClaimTime: now + VESTING_PERIOD_MS };
  }

  async commitVestedClaim(walletAddress: string, claimAmount: number): Promise<void> {
    const profile = this.profiles.get(walletAddress);
    if (!profile || claimAmount <= 0) return;

    const now = Date.now();
    profile.wagaVestingClaimed = (profile.wagaVestingClaimed || 0) + claimAmount;
    profile.wagaVestingLastClaim = now;
    profile.wagaEarned = (profile.wagaEarned || 0) + claimAmount;
    this.profiles.set(walletAddress, profile);

    const remaining = (profile.wagaVestingTotal || 0) - profile.wagaVestingClaimed;
    console.log(`[VESTING] ${walletAddress.slice(0, 8)}... claimed ${claimAmount} WAGA`);
    console.log(`[VESTING] Remaining: ${remaining} WAGA`);
  }

  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(gameId) || [];
  }

  async addChatMessage(data: ChatMessage): Promise<ChatMessage> {
    const message = { ...data, timestamp: Date.now() };
    const messages = this.chatMessages.get(data.gameId) || [];
    messages.push(message);
    if (messages.length > 50) messages.shift();
    this.chatMessages.set(data.gameId, messages);
    return message;
  }

  async getGlobalChatMessages(limit: number = 100): Promise<GlobalChatMessage[]> {
    return this.globalChatMessages.slice(-limit);
  }

  async addGlobalChatMessage(data: any): Promise<any> {
    const message: any = {
      ...data,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    this.globalChatMessages.push(message);
    if (this.globalChatMessages.length > 200) {
      this.globalChatMessages.shift();
    }
    return message;
  }

  async getGameHistory(walletAddress: string, limit: number): Promise<GameHistory[]> {
    const history = this.gameHistory.get(walletAddress) || [];
    return history.slice(0, limit);
  }

  async addGameHistory(walletAddress: string, history: GameHistory): Promise<void> {
    const existing = this.gameHistory.get(walletAddress) || [];
    existing.unshift(history);
    if (existing.length > 100) existing.pop();
    this.gameHistory.set(walletAddress, existing);
  }

  async getGiveawayStats(): Promise<GiveawayStats> {
    return { ...this.giveawayStats };
  }

  async getGiveawayLeaderboard(): Promise<{ luck: LeaderboardEntry[]; streaks: LeaderboardEntry[] }> {
    const luck = await this.getLeaderboard("luck", 10, "all");
    const streaks = await this.getLeaderboard("streaks", 10, "all");
    return { luck, streaks };
  }

  async getGiveawayWinners(season?: number): Promise<GiveawayWinner[]> {
    if (season) {
      return this.giveawayWinners.filter(w => w.season === season);
    }
    return this.giveawayWinners;
  }

  private async triggerGiveawayPayout(): Promise<void> {
    const stats = this.giveawayStats;
    const jackpot = Math.max(GIVEAWAY_MIN_SOL_FLOOR, stats.giveawayWalletBalance);
    const luckWinners = await this.getLeaderboard("luck", 10, "all");
    const streakWinners = await this.getLeaderboard("streaks", 10, "all");

    const winnerEntries: GiveawayWinner[] = [];

    // Process Luck winners
    luckWinners.forEach((w, i) => {
      winnerEntries.push({
        id: `win_luck_${stats.currentSeason}_${i}`,
        season: stats.currentSeason,
        walletAddress: w.walletAddress,
        username: w.displayName,
        payoutSol: (jackpot * 0.5 * (GIVEAWAY_PAYOUT_PERCENTS[i] / 100)),
        type: "luck",
        rank: i + 1,
        wonAt: Date.now(),
      });
    });

    // Process Streak winners
    streakWinners.forEach((w, i) => {
      winnerEntries.push({
        id: `win_streak_${stats.currentSeason}_${i}`,
        season: stats.currentSeason,
        walletAddress: w.walletAddress,
        username: w.displayName,
        payoutSol: (jackpot * 0.5 * (GIVEAWAY_PAYOUT_PERCENTS[i] / 100)),
        type: "streak",
        rank: i + 1,
        wonAt: Date.now(),
      });
    });

    this.giveawayWinners.push(...winnerEntries);

    // Reset for next season
    this.giveawayStats = {
      ...stats,
      cycleStartGameCount: stats.totalGamesPlayed,
      giveawayWalletBalance: 0,
      currentCycleStart: Date.now(),
      currentSeason: stats.currentSeason + 1,
      lastUpdatedAt: Date.now(),
    };

    // ABUSE PREVENTION: Reset luck and streaks for new season
    for (const profile of this.profiles.values()) {
      profile.gamesPlayed = 0;
      profile.gamesWon = 0;
      profile.currentStreak = 0;
      profile.bestStreak = 0;
      profile.luckScore = 50;
      this.profiles.set(profile.walletAddress, profile);
    }

    console.log(`[GIVEAWAY] Season ${stats.currentSeason} completed! Payouts recorded for 20 winners. Season ${stats.currentSeason + 1} started.`);
  }

  async getAllProfiles(): Promise<PlayerProfile[]> {
    return Array.from(this.profiles.values());
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async getLiveGames(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(
      (g) => g.status === "waiting" || g.status === "countdown" || g.status === "in_progress"
    );
  }

  async createGame(game: InsertGame): Promise<Game> {
    const id = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const config = GAME_MODES[game.mode];
    
    const onChainGameId = BigInt(Date.now());
    const [escrowPDA] = solanaClient.getGamePoolPDA(onChainGameId);
    
    const serverSeed = randomBytes(32).toString('hex');
    const serverSeedHash = createHmac('sha256', 'seed_salt').update(serverSeed).digest('hex');

    const newGame: Game = {
      id,
      onChainGameId: onChainGameId.toString(),
      escrowPDA: escrowPDA.toBase58(),
      serverSeed,
      serverSeedHash,
      mode: game.mode,
      wager: game.wager,
      status: "waiting",
      players: [],
      rounds: [],
      currentRound: 1,
      poolAmount: 0,
      createdAt: Date.now(),
    };
    this.games.set(id, newGame);
    
    console.log(`[ON-CHAIN] Game ${id} created with on-chain ID ${onChainGameId}`);
    
    if (solanaClient.isOnChainEnabled()) {
      const programDeployed = await solanaClient.isProgramDeployed();
      if (programDeployed) {
        const result = await solanaClient.createGameOnChain(onChainGameId, game.mode, game.wager);
        if (result.success) {
          console.log(`[ON-CHAIN] Game initialized on-chain: ${result.signature}`);
        } else {
          console.warn(`[ON-CHAIN] On-chain game creation failed: ${result.error}`);
        }
      }
    }
    
    return newGame;
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    const updated = { ...game, ...updates };
    this.games.set(id, updated);
    return updated;
  }

  async findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined> {
    const games = Array.from(this.games.values());
    const config = GAME_MODES[mode];
    
    return games.find(
      (g) =>
        g.mode === mode &&
        g.wager === wager &&
        g.status === "waiting" &&
        g.players.length < config.players
    );
  }

  async updateGameStatus(id: string, status: string): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    game.status = status as Game["status"];
    
    if (status === "countdown") {
      const now = Date.now();
      game.countdownEndsAt = now + 10000;
      setTimeout(() => {
        this.startGame(id);
      }, 10000);
    }
    
    this.games.set(id, game);
    return game;
  }

  async joinGame(gameId: string, walletAddress: string, txSignature?: string): Promise<Game | undefined> {
    const game = this.games.get(gameId);
    if (!game) return undefined;

    const config = GAME_MODES[game.mode];
    
    if (game.players.length >= config.players) {
      return undefined;
    }

    if (game.players.some((p) => p.walletAddress === walletAddress)) {
      return game;
    }

    // Check and expire god streak if player hasn't played in 72 hours
    await this.checkAndExpireGodStreak(walletAddress);

    const profile = await this.getOrCreateProfile(walletAddress);
    const entryWagaReward = calculateWagaReward(game.wager, WAGA_ENTRY_MULTIPLIER);

    const player = {
      id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      walletAddress,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      joinedAt: Date.now(),
      isEliminated: false,
      txSignature,
    };

    game.players.push(player);
    game.poolAmount += game.wager;

    await this.updateProfile(walletAddress, {
      wagaEarned: (profile.wagaEarned || 0) + entryWagaReward,
    });

    if (entryWagaReward > 0) {
      const wagaResult = await solanaClient.transferWagaFromVault(walletAddress, entryWagaReward);
      if (wagaResult.success) {
        console.log(`[DEVNET] WAGA entry reward transferred! Tx: ${wagaResult.txSig}`);
      } else {
        console.warn(`[DEVNET] WAGA entry transfer failed: ${wagaResult.error}`);
      }
    }

    this.games.set(gameId, game);
    return game;
  }

  private getPeriodStartTime(period: LeaderboardPeriod): number {
    if (period === "all") return 0;
    
    const now = new Date();
    
    if (period === "daily") {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      return start.getTime();
    }
    
    if (period === "weekly") {
      const start = new Date(now);
      const day = start.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setUTCDate(start.getUTCDate() - diff);
      start.setUTCHours(0, 0, 0, 0);
      return start.getTime();
    }
    
    if (period === "monthly") {
      const start = new Date(now);
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      return start.getTime();
    }
    
    return 0;
  }

  async getLeaderboard(sortBy: "earnings" | "luck" | "streaks", limit: number = 50, period: LeaderboardPeriod = "all"): Promise<LeaderboardEntry[]> {
    if (period === "all") {
      const profiles = Array.from(this.profiles.values());
      const activePlayers = profiles.filter(p => p.gamesPlayed > 0);
      
      let sorted: PlayerProfile[];
      switch (sortBy) {
        case "earnings":
          sorted = activePlayers.sort((a, b) => b.totalWon - a.totalWon);
          break;
        case "luck":
          sorted = activePlayers.sort((a, b) => {
            const aRate = a.gamesPlayed > 0 ? a.gamesWon / a.gamesPlayed : 0;
            const bRate = b.gamesPlayed > 0 ? b.gamesWon / b.gamesPlayed : 0;
            return bRate - aRate;
          });
          break;
        case "streaks":
          sorted = activePlayers.sort((a, b) => b.bestStreak - a.bestStreak);
          break;
        default:
          sorted = activePlayers.sort((a, b) => b.totalWon - a.totalWon);
      }
      
      return sorted.slice(0, limit).map((p, i) => ({
        rank: i + 1,
        walletAddress: p.walletAddress,
        displayName: p.username || p.walletAddress.slice(0, 6),
        totalWon: p.totalWon,
        gamesWon: p.gamesWon,
        gamesPlayed: p.gamesPlayed,
        winRate: p.gamesPlayed > 0 ? (p.gamesWon / p.gamesPlayed) * 100 : 0,
        luckScore: p.luckScore,
        bestStreak: p.bestStreak,
        godStreakActive: p.godStreakActive,
        isStreakBreakerActive: p.isStreakBreakerActive,
      }));
    }
    return [];
  }

  storeAvatarImage(walletAddress: string, data: Buffer, contentType: string): void {
    this.avatarImages.set(walletAddress, { data, contentType });
  }

  getAvatarImage(walletAddress: string): { data: Buffer; contentType: string } | null {
    return this.avatarImages.get(walletAddress) || null;
  }

  async getGlobalStats(): Promise<{ gamesPlayed: number; solWon: number; playersCount: number; wagaRewarded: number }> {
    const profiles = Array.from(this.profiles.values());
    const games = Array.from(this.games.values()).filter(g => g.status === "completed");
    
    return {
      gamesPlayed: games.length,
      solWon: profiles.reduce((sum, p) => sum + p.totalWon, 0),
      playersCount: profiles.length,
      wagaRewarded: profiles.reduce((sum, p) => sum + p.wagaEarned, 0),
    };
  }

  async getCompletedGames(limit: number = 20): Promise<Game[]> {
    return Array.from(this.games.values())
      .filter(g => g.status === "completed")
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, limit);
  }

  async verifyGame(serverSeedHash: string): Promise<Game | undefined> {
    return Array.from(this.games.values()).find(g => g.serverSeedHash === serverSeedHash);
  }

  async isTransactionUsed(signature: string): Promise<boolean> {
    return this.usedTxSignatures.has(signature);
  }

  async markTransactionUsed(signature: string, walletAddress: string): Promise<void> {
    this.usedTxSignatures.add(signature);
  }

  async getAllProfiles(): Promise<PlayerProfile[]> {
    return Array.from(this.profiles.values());
  }

  private async startGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "countdown") return;
    
    game.status = "in_progress";
    game.startedAt = Date.now();
    this.games.set(gameId, game);
    
    // In a real app, this would be a multi-step process with a timer
    // For this prototype, we simulate the game rounds
    this.simulateGame(gameId);
  }

  private async simulateGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;
    
    const config = GAME_MODES[game.mode];
    
    for (let r = 1; r <= config.rounds; r++) {
      game.currentRound = r;
      game.roundEndsAt = Date.now() + (config.timer * 1000);
      this.games.set(gameId, game);
      
      // Wait for round to "complete"
      await new Promise(resolve => setTimeout(resolve, config.timer * 1000));
      
      const activePlayers = game.players.filter(p => !p.isEliminated);
      if (activePlayers.length <= 1) break;
      
      // Eliminate half the players
      const toEliminateCount = Math.ceil(activePlayers.length / 2);
      for (let i = 0; i < toEliminateCount; i++) {
        const playerIndex = Math.floor(Math.random() * activePlayers.length);
        const player = activePlayers.splice(playerIndex, 1)[0];
        player.isEliminated = true;
        player.eliminatedRound = r;
      }
      
      game.rounds.push({
        roundNumber: r,
        players: game.players.map(p => p.walletAddress),
        resolvedAt: Date.now()
      });
    }
    
    // Game completed
    const winner = game.players.find(p => !p.isEliminated);
    if (winner) {
      game.status = "completed";
      game.completedAt = Date.now();
      game.winnerId = winner.walletAddress;
      game.winnerPayout = game.poolAmount * WINNER_SHARE;
      
      // Apply God Streak chance
      const godTrigger = Math.floor(Math.random() * 1000000);
      if (godTrigger < GOD_STREAK_CHANCE) {
        game.godStreakTriggered = true;
        game.godStreakRecipient = winner.walletAddress;
        
        const profile = await this.getOrCreateProfile(winner.walletAddress);
        const streakLength = Math.floor(Math.random() * (GOD_STREAK_MAX_LENGTH - GOD_STREAK_MIN_LENGTH)) + GOD_STREAK_MIN_LENGTH;
        
        await this.updateProfile(winner.walletAddress, {
          godStreakActive: true,
          godStreakLength: streakLength,
          godStreakGamesRemaining: streakLength,
          godStreakStartedAt: Date.now(),
          godStreakLastPlayedAt: Date.now(),
          godStreaksAchieved: (profile.godStreaksAchieved || 0) + 1
        });
      }
      
      // Update winner stats
      const profile = await this.getOrCreateProfile(winner.walletAddress);
      const winnerWagaBonus = calculateWagaReward(game.winnerPayout, WAGA_WINNER_MULTIPLIER);
      
      await this.updateProfile(winner.walletAddress, {
        gamesWon: (profile.gamesWon || 0) + 1,
        totalWon: (profile.totalWon || 0) + game.winnerPayout,
        wagaVestingTotal: (profile.wagaVestingTotal || 0) + winnerWagaBonus,
        currentStreak: (profile.currentStreak || 0) + 1,
        bestStreak: Math.max(profile.bestStreak || 0, (profile.currentStreak || 0) + 1),
        lastPlayedAt: Date.now()
      });
      
      // Update giveaway stats
      const giveawayStats = await this.getGiveawayStats();
      await this.updateGiveawayStats({
        totalGamesPlayed: giveawayStats.totalGamesPlayed + 1,
        giveawayWalletBalance: giveawayStats.giveawayWalletBalance + (game.poolAmount * GIVEAWAY_FEE),
        lastUpdatedAt: Date.now()
      });
      
      // Check for giveaway payout
      const updatedStats = await this.getGiveawayStats();
      if (updatedStats.totalGamesPlayed - updatedStats.cycleStartGameCount >= GIVEAWAY_MILESTONE_GAMES) {
        await this.triggerGiveawayPayout();
      }
    }
    
    this.games.set(gameId, game);
  }

  private async triggerGiveawayPayout(): Promise<void> {
    // ... payout logic
  }

  private async updateGiveawayStats(updates: Partial<GiveawayStats>): Promise<void> {
    this.giveawayStats = { ...this.giveawayStats, ...updates };
  }
}

export const storage: IStorage = process.env.DATABASE_URL 
  ? new PgStorage() 
  : new MemStorage();