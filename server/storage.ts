import {
  users,
  type PlayerProfile,
  type Game,
  type InsertGame,
  type GameHistory,
  type ChatMessage,
  type GlobalChatMessage,
  type GiveawayStats,
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

  constructor() {
    this.profiles = new Map();
    this.games = new Map();
    this.avatarImages = new Map();
    this.chatMessages = new Map();
    this.globalChatMessages = [];
    this.gameHistory = new Map();
    this.giveawayWinners = [];
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

    console.log(`[GIVEAWAY] Season ${stats.currentSeason} completed! Payouts recorded for 20 winners.`);
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
      
      return sorted.slice(0, limit).map((profile, index): LeaderboardEntry => ({
        rank: index + 1,
        walletAddress: profile.walletAddress,
        displayName: profile.username || profile.displayName,
        totalWon: profile.totalWon,
        gamesWon: profile.gamesWon,
        gamesPlayed: profile.gamesPlayed,
        winRate: profile.gamesPlayed > 0 ? (profile.gamesWon / profile.gamesPlayed) * 100 : 0,
        luckScore: profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 50,
        bestStreak: profile.bestStreak,
        godStreakActive: profile.godStreakActive,
        isStreakBreakerActive: profile.isStreakBreakerActive,
      }));
    }

    const periodStart = this.getPeriodStartTime(period);
    const playerStats = new Map<string, { totalWon: number; gamesWon: number; gamesPlayed: number; currentStreak: number; bestStreak: number }>();

    const allEntries = Array.from(this.gameHistory.entries());
    for (const [wallet, histories] of allEntries) {
      const periodGames = histories.filter((h: GameHistory) => h.playedAt >= periodStart);
      if (periodGames.length === 0) continue;

      let totalWon = 0;
      let gamesWon = 0;
      let gamesPlayed = periodGames.length;
      let currentStreak = 0;
      let bestStreak = 0;

      const sorted = [...periodGames].sort((a, b) => a.playedAt - b.playedAt);
      for (const game of sorted) {
        if (game.result === "won") {
          totalWon += game.payout || 0;
          gamesWon++;
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      playerStats.set(wallet, { totalWon, gamesWon, gamesPlayed, currentStreak, bestStreak });
    }

    const entries: LeaderboardEntry[] = [];
    const allStats = Array.from(playerStats.entries());
    for (const [wallet, stats] of allStats) {
      const profile = this.profiles.get(wallet);
      const winRate = stats.gamesPlayed > 0 ? (stats.gamesWon / stats.gamesPlayed) * 100 : 0;
      const actualWinRate = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0;
      const luckScore = Math.round(actualWinRate * 100);

      entries.push({
        rank: 0,
        walletAddress: wallet,
        displayName: profile?.username || profile?.displayName,
        totalWon: stats.totalWon,
        gamesWon: stats.gamesWon,
        gamesPlayed: stats.gamesPlayed,
        winRate,
        luckScore: stats.gamesPlayed > 0 ? luckScore : 50,
        bestStreak: stats.bestStreak,
        godStreakActive: profile?.godStreakActive,
        isStreakBreakerActive: profile?.isStreakBreakerActive,
      });
    }

    switch (sortBy) {
      case "earnings":
        entries.sort((a, b) => b.totalWon - a.totalWon);
        break;
      case "luck":
        entries.sort((a, b) => b.luckScore - a.luckScore);
        break;
      case "streaks":
        entries.sort((a, b) => b.bestStreak - a.bestStreak);
        break;
    }

    return entries.slice(0, limit).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  private calculateLuckScore(gamesWon: number, gamesPlayed: number): number {
    if (gamesPlayed < 3) return 50;
    
    const expectedWinRate = 0.35;
    const actualWinRate = gamesWon / gamesPlayed;
    const luckFactor = actualWinRate / expectedWinRate;
    
    let luckScore: number;
    if (luckFactor >= 1) {
      luckScore = 50 + (50 * Math.min(1, (luckFactor - 1) / 1.5));
    } else {
      luckScore = 50 * luckFactor;
    }
    
    return Math.round(Math.max(0, Math.min(100, luckScore)));
  }

  // Derive a number 0-999999 from the game hash for provably fair special event checks
  private deriveSpecialEventRoll(serverSeed: string, clientSeed: string, nonce: string): number {
    const hmac = createHmac('sha256', serverSeed);
    hmac.update(`special-${clientSeed}-${nonce}`);
    const hash = hmac.digest('hex');
    return parseInt(hash.substring(0, 5), 16) % 1000000;
  }

  private generateFairNumber(serverSeed: string, clientSeed: string, nonce: number): number {
    const hmac = createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}-${nonce}`);
    const hash = hmac.digest('hex');
    const val = parseInt(hash.substring(0, 8), 16);
    return val / 0xFFFFFFFF;
  }

  // Weighted fair selection: returns true if playerA wins (with given weight for A)
  private weightedFairSelection(serverSeed: string, clientSeed: string, nonce: number, weightA: number): boolean {
    const fairNumber = this.generateFairNumber(serverSeed, clientSeed, nonce);
    return fairNumber < weightA;
  }

  private async startGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "countdown") return;

    const config = GAME_MODES[game.mode];
    const roundDuration = config.timer * 1000;
    const now = Date.now();

    game.status = "in_progress";
    game.startedAt = now;
    game.roundEndsAt = now + roundDuration;

    const playerIds = game.players.map((p) => p.id);
    game.rounds = [
      {
        roundNumber: 1,
        players: playerIds,
      },
    ];

    this.games.set(gameId, game);

    this.simulateGame(gameId);
  }

  private async simulateGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const clientSeed = game.players.map(p => p.walletAddress.substring(0, 8)).join('-');
    game.clientSeed = clientSeed;

    const config = GAME_MODES[game.mode];
    const roundDuration = config.timer * 1000;
    let remainingPlayers = [...game.players];

    // Check and expire any God streaks before game starts
    for (const player of game.players) {
      await this.checkAndExpireGodStreak(player.walletAddress);
    }

    // Load profiles for all players to check God streak status
    const playerProfiles = new Map<string, PlayerProfile>();
    for (const player of game.players) {
      const profile = await this.getOrCreateProfile(player.walletAddress);
      playerProfiles.set(player.walletAddress, profile);
    }

    for (let round = 1; round <= config.rounds; round++) {
      await new Promise((r) => setTimeout(r, roundDuration));

      const currentGame = this.games.get(gameId);
      if (!currentGame || currentGame.status === "completed") return;

      const winners: typeof remainingPlayers = [];
      const losers: typeof remainingPlayers = [];

      for (let i = 0; i < remainingPlayers.length; i += 2) {
        if (i + 1 < remainingPlayers.length) {
          const playerA = remainingPlayers[i];
          const playerB = remainingPlayers[i + 1];
          const profileA = playerProfiles.get(playerA.walletAddress);
          const profileB = playerProfiles.get(playerB.walletAddress);

          const aIsGod = profileA?.godStreakActive || false;
          const bIsGod = profileB?.godStreakActive || false;

          let aWinWeight = 0.5; // Default 50/50
          let breakerTriggered = false;
          let breakerPlayer: typeof playerA | null = null;
          let naturalBreaker = false;

          if (aIsGod && !bIsGod) {
            // Check if B can trigger a streak breaker (25% = 250000 in 1M)
            const breakerRoll = this.deriveSpecialEventRoll(
              currentGame.serverSeed || 'default',
              clientSeed,
              `breaker-${round}-${i}`
            );
            if (breakerRoll < BREAKER_CHANCE) {
              // Breaker triggered! God's advantage stripped
              breakerTriggered = true;
              breakerPlayer = playerB;
              aWinWeight = 1 - BREAKER_WIN_WEIGHT; // God only has 25% chance
              console.log(`[GOD STREAK] Streak Breaker triggered! ${playerB.walletAddress.slice(0, 8)}... challenges the God!`);
            } else {
              // God has 95% advantage
              aWinWeight = GOD_STREAK_WIN_WEIGHT;
            }
          } else if (bIsGod && !aIsGod) {
            const breakerRoll = this.deriveSpecialEventRoll(
              currentGame.serverSeed || 'default',
              clientSeed,
              `breaker-${round}-${i}-b`
            );
            if (breakerRoll < BREAKER_CHANCE) {
              breakerTriggered = true;
              breakerPlayer = playerA;
              aWinWeight = BREAKER_WIN_WEIGHT; // Player A gets 75%
              console.log(`[GOD STREAK] Streak Breaker triggered! ${playerA.walletAddress.slice(0, 8)}... challenges the God!`);
            } else {
              aWinWeight = 1 - GOD_STREAK_WIN_WEIGHT; // God B wins 95%, so A wins 5%
            }
          }
          // If both are Gods or neither: pure 50/50

          const aWins = this.weightedFairSelection(
            currentGame.serverSeed || 'default',
            clientSeed,
            round + i,
            aWinWeight
          );

          const winner = aWins ? playerA : playerB;
          const loser = aWins ? playerB : playerA;

          // Check if a normal player (no breaker) broke a God streak
          if ((aIsGod && !aWins) || (bIsGod && aWins)) {
            const godPlayer = aIsGod ? playerA : playerB;
            const normalPlayer = aIsGod ? playerB : playerA;
            if (!breakerTriggered) {
              naturalBreaker = true;
              console.log(`[GOD STREAK] ${normalPlayer.walletAddress.slice(0, 8)}... naturally broke the God streak!`);
            }
            // Expire the god streak
            await this.updateProfile(godPlayer.walletAddress, {
              godStreakActive: false,
              godStreakGamesRemaining: 0,
              isStreakBreakerActive: false,
            });
            // Update the winner's streaksBeaten count
            const winnerProfile = await this.getProfile(winner.walletAddress);
            if (winnerProfile) {
              await this.updateProfile(winner.walletAddress, {
                streaksBeaten: (winnerProfile.streaksBeaten || 0) + 1,
                isStreakBreakerActive: false,
              });
            }
          }

          // If God won, update their lastPlayedAt and decrement games remaining
          if ((aIsGod && aWins) || (bIsGod && !aWins)) {
            const godPlayer = aIsGod ? playerA : playerB;
            const godProfile = playerProfiles.get(godPlayer.walletAddress);
            if (godProfile) {
              const newRemaining = Math.max(0, (godProfile.godStreakGamesRemaining || 0) - 1);
              const updatedProfile = await this.updateProfile(godPlayer.walletAddress, {
                godStreakLastPlayedAt: Date.now(),
                godStreakGamesRemaining: newRemaining,
                godStreakActive: newRemaining > 0,
              });
              if (updatedProfile) {
                playerProfiles.set(godPlayer.walletAddress, updatedProfile);
              }
              if (newRemaining === 0) {
                console.log(`[GOD STREAK] ${godPlayer.walletAddress.slice(0, 8)}... God Streak completed!`);
              }
            }
          }

          // If breaker was triggered, mark the breaker player
          if (breakerTriggered && breakerPlayer) {
            await this.updateProfile(breakerPlayer.walletAddress, {
              isStreakBreakerActive: true,
            });
            // Update game metadata
            currentGame.breakerTriggered = true;
            currentGame.breakerPlayerId = breakerPlayer.walletAddress;
            if (naturalBreaker) currentGame.naturalBreakerBonus = true;
          }

          winners.push(winner);
          losers.push(loser);
        } else {
          winners.push(remainingPlayers[i]);
        }
      }

      losers.forEach((loser) => {
        const player = currentGame.players.find((p) => p.id === loser.id);
        if (player) {
          player.isEliminated = true;
          player.eliminatedRound = round;
        }
      });

      currentGame.rounds.push({
        roundNumber: round,
        players: remainingPlayers.map((p) => p.id),
        winnerId: winners.length === 1 ? winners[0].id : undefined,
        resolvedAt: Date.now(),
      });

      currentGame.currentRound = round + 1;
      remainingPlayers = winners;

      if (remainingPlayers.length > 1) {
        const now = Date.now();
        currentGame.roundEndsAt = now + roundDuration;
      }

      this.games.set(gameId, currentGame);

      if (remainingPlayers.length === 1) {
        break;
      }
    }

    const finalGame = this.games.get(gameId);
    if (!finalGame) return;

    const winner = remainingPlayers[0];
    const payout = finalGame.poolAmount * WINNER_SHARE;
    const treasuryFee = finalGame.poolAmount * FOUNDATION_FEE;
    const giveawayFee = finalGame.poolAmount * GIVEAWAY_FEE;

    // Determine WAGA winner multiplier (may be boosted for streak breaking)
    let wagaMultiplier = WAGA_WINNER_MULTIPLIER;
    const winnerBrokeGodStreak = finalGame.naturalBreakerBonus && finalGame.breakerPlayerId === winner.walletAddress;
    const winnerUsedBreaker = finalGame.breakerTriggered && finalGame.breakerPlayerId === winner.walletAddress;

    if (winnerBrokeGodStreak) {
      wagaMultiplier = WAGA_WINNER_MULTIPLIER * NATURAL_BREAKER_WAGA_MULTIPLIER;
      console.log(`[GOD STREAK] Natural Breaker bonus! WAGA multiplier: ${wagaMultiplier}x`);
    } else if (winnerUsedBreaker) {
      wagaMultiplier = WAGA_WINNER_MULTIPLIER * TRIGGERED_BREAKER_WAGA_MULTIPLIER;
      console.log(`[GOD STREAK] Triggered Breaker bonus! WAGA multiplier: ${wagaMultiplier}x`);
    }

    const winWagaReward = calculateWagaReward(payout, wagaMultiplier);

    finalGame.status = "completed";
    finalGame.completedAt = Date.now();
    finalGame.winnerId = winner.walletAddress;
    finalGame.winnerPayout = payout;
    finalGame.wagaRewards = winWagaReward;

    // Update giveaway stats
    this.giveawayStats.totalGamesPlayed += 1;
    this.giveawayStats.giveawayWalletBalance += giveawayFee;
    this.giveawayStats.lastUpdatedAt = Date.now();

    const gamesInCycle = this.giveawayStats.totalGamesPlayed - this.giveawayStats.cycleStartGameCount;
    if (gamesInCycle >= GIVEAWAY_MILESTONE_GAMES) {
      await this.triggerGiveawayPayout();
    }

    // Transfer fees on devnet
    if (solanaClient.isOnChainEnabled()) {
      // Transfer to Foundation Treasury (9%)
      const FOUNDATION_TREASURY = "BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP";
      solanaClient.transferSol(FOUNDATION_TREASURY, treasuryFee).then(res => {
        if (res.success) console.log(`[DEVNET] 9% Treasury fee transferred: ${res.txSig}`);
        else console.warn(`[DEVNET] Treasury fee transfer failed: ${res.error}`);
      });
      
      // Transfer to Giveaway Treasury (1%)
      const GIVEAWAY_WALLET = "FGY64g3Pt8wMrMR3A9abkVxSjwh2Yt4dT4BYkw6rU3yf";
      solanaClient.transferSol(GIVEAWAY_WALLET, giveawayFee).then(res => {
        if (res.success) console.log(`[DEVNET] 1% Giveaway fee transferred: ${res.txSig}`);
        else console.warn(`[DEVNET] Giveaway fee transfer failed: ${res.error}`);
      });
    }

    console.log(`[GIVEAWAY] Game contribution: ${giveawayFee.toFixed(6)} SOL. Total pot: ${this.giveawayStats.giveawayWalletBalance.toFixed(4)} SOL`);
    console.log(`[DEVNET] Game ${gameId} completed. Winner: ${winner.walletAddress.slice(0, 8)}...`);
    console.log(`[DEVNET] Winner Payout: ${payout.toFixed(4)} SOL | Treasury: ${treasuryFee.toFixed(4)} SOL | Giveaway: ${giveawayFee.toFixed(6)} SOL`);

    // Check if this game triggers a new God Streak (50 in 1M chance)
    const godRoll = this.deriveSpecialEventRoll(
      finalGame.serverSeed || 'default',
      finalGame.clientSeed || '',
      'god-trigger'
    );
    if (godRoll < GOD_STREAK_CHANCE) {
      // Randomly select one player to receive the God Streak
      const recipientIndex = parseInt(
        createHmac('sha256', finalGame.serverSeed || 'default')
          .update(`god-recipient-${finalGame.clientSeed}`)
          .digest('hex')
          .substring(0, 4),
        16
      ) % finalGame.players.length;

      const godRecipient = finalGame.players[recipientIndex];
      const streakLength = GOD_STREAK_MIN_LENGTH + parseInt(
        createHmac('sha256', finalGame.serverSeed || 'default')
          .update(`god-length-${finalGame.clientSeed}`)
          .digest('hex')
          .substring(0, 6),
        16
      ) % (GOD_STREAK_MAX_LENGTH - GOD_STREAK_MIN_LENGTH + 1);

      const recipientProfile = await this.getProfile(godRecipient.walletAddress);
      if (recipientProfile && !recipientProfile.godStreakActive) {
        await this.updateProfile(godRecipient.walletAddress, {
          godStreakActive: true,
          godStreakLength: streakLength,
          godStreakGamesRemaining: streakLength,
          godStreakStartedAt: Date.now(),
          godStreakLastPlayedAt: Date.now(),
          godStreaksAchieved: (recipientProfile.godStreaksAchieved || 0) + 1,
        });
        finalGame.godStreakTriggered = true;
        finalGame.godStreakRecipient = godRecipient.walletAddress;
        console.log(`[GOD STREAK] *** GOD STREAK TRIGGERED! *** ${godRecipient.walletAddress.slice(0, 8)}... has been marked! (length hidden)`);
      }
    }

    // Execute WAGA winner reward transfer
    if (winWagaReward > 0) {
      const wagaResult = await solanaClient.transferWagaFromVault(winner.walletAddress, winWagaReward);
      if (wagaResult.success) {
        console.log(`[PAYOUT] Winner WAGA sent! Tx: ${wagaResult.txSig}`);
      } else {
        console.error(`[PAYOUT] Winner WAGA failed: ${wagaResult.error}`);
      }
    }

    // Execute on-chain payouts
    if (solanaClient.isOnChainEnabled() && finalGame.onChainGameId) {
      try {
        const programDeployed = await solanaClient.isProgramDeployed();
        
        if (programDeployed) {
          const payoutResult = await solanaClient.executePayouts(
            BigInt(finalGame.onChainGameId),
            winner.walletAddress,
            payout,
            treasuryFee
          );
          
          if (payoutResult.success) {
            finalGame.winnerPayoutTxSig = payoutResult.winnerTxSig;
            finalGame.treasuryFeeTxSig = payoutResult.treasuryTxSig;
            this.games.set(gameId, finalGame);
          }
        } else {
          const winnerTransfer = await solanaClient.transferSol(winner.walletAddress, payout);
          const treasuryTransfer = await solanaClient.transferSol(solanaClient.getTreasuryWallet().toBase58(), treasuryFee);
          
          if (winnerTransfer.success) {
            finalGame.winnerPayoutTxSig = winnerTransfer.txSig;
          }
          if (treasuryTransfer.success) {
            finalGame.treasuryFeeTxSig = treasuryTransfer.txSig;
          }
          
          this.games.set(gameId, finalGame);
        }
      } catch (payoutError) {
        console.error(`[PAYOUT] Payout execution failed:`, payoutError);
      }
    }

    for (const player of finalGame.players) {
      const isWinner = player.walletAddress === winner.walletAddress;
      const gameWagaEarned = isWinner ? winWagaReward : 0;
      const brokeStreak = finalGame.breakerPlayerId === player.walletAddress;
      
      await this.addGameHistory(player.walletAddress, {
        gameId: finalGame.id,
        mode: finalGame.mode,
        wager: finalGame.wager,
        result: isWinner ? "won" : "lost",
        payout: isWinner ? payout : undefined,
        wagaEarned: gameWagaEarned,
        playedAt: Date.now(),
        godStreakGame: finalGame.godStreakTriggered,
        brokeGodStreak: brokeStreak && isWinner,
      });

      const profile = await this.getProfile(player.walletAddress);
      if (profile) {
        if (isWinner) {
          const newGamesWon = profile.gamesWon + 1;
          const newGamesPlayed = profile.gamesPlayed + 1;
          const newLuckScore = this.calculateLuckScore(newGamesWon, newGamesPlayed);
          
          await this.updateProfile(player.walletAddress, {
            gamesPlayed: newGamesPlayed,
            gamesWon: newGamesWon,
            totalWagered: profile.totalWagered + finalGame.wager,
            totalWon: profile.totalWon + payout,
            wagaVestingTotal: (profile.wagaVestingTotal || 0) + winWagaReward,
            currentStreak: profile.currentStreak + 1,
            bestStreak: Math.max(profile.bestStreak, profile.currentStreak + 1),
            luckScore: newLuckScore,
            lastPlayedAt: Date.now(),
            isStreakBreakerActive: false,
          });
        } else {
          const newGamesPlayed = profile.gamesPlayed + 1;
          const newLuckScore = this.calculateLuckScore(profile.gamesWon, newGamesPlayed);
          
          await this.updateProfile(player.walletAddress, {
            gamesPlayed: newGamesPlayed,
            gamesWon: profile.gamesWon,
            totalWagered: profile.totalWagered + finalGame.wager,
            totalWon: profile.totalWon,
            currentStreak: 0,
            bestStreak: profile.bestStreak,
            luckScore: newLuckScore,
            lastPlayedAt: Date.now(),
            isStreakBreakerActive: false,
          });
        }
      }
    }
  }

  storeAvatarImage(walletAddress: string, data: Buffer, contentType: string): void {
    this.avatarImages.set(walletAddress, { data, contentType });
  }

  getAvatarImage(walletAddress: string): { data: Buffer; contentType: string } | null {
    return this.avatarImages.get(walletAddress) || null;
  }

  async getGlobalStats(): Promise<{ gamesPlayed: number; solWon: number; playersCount: number; wagaRewarded: number }> {
    const games = Array.from(this.games.values());
    const profiles = Array.from(this.profiles.values());

    const completedGames = games.filter(g => g.status === "completed");
    const solWon = completedGames.reduce((acc, g) => acc + (g.winnerPayout || 0), 0);
    const wagaRewarded = profiles.reduce((acc, p) => acc + (p.wagaEarned || 0) + (p.wagaVestingTotal || 0), 0);

    return {
      gamesPlayed: completedGames.length,
      solWon,
      playersCount: profiles.filter(p => p.gamesPlayed > 0).length,
      wagaRewarded,
    };
  }

  async getCompletedGames(limit: number = 50): Promise<Game[]> {
    return Array.from(this.games.values())
      .filter(g => g.status === "completed")
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, limit);
  }

  async verifyGame(serverSeedHash: string): Promise<Game | undefined> {
    return Array.from(this.games.values()).find(
      g => g.status === "completed" && g.serverSeedHash === serverSeedHash
    );
  }
}

export const storage = new MemStorage();
