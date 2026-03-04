import { Pool } from "pg";
import {
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
  GIVEAWAY_FEE,
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
  GIVEAWAY_MILESTONE_GAMES,
  GIVEAWAY_MIN_SOL_FLOOR,
  GIVEAWAY_PAYOUT_PERCENTS,
} from "@shared/schema";
import { calculateWagaReward } from "./price-service";
import { solanaClient } from "./solana-client";
import { createHmac, randomBytes } from "crypto";
import type { IStorage } from "./storage";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function rowToProfile(row: any): PlayerProfile {
  return {
    walletAddress: row.wallet_address,
    displayName: row.display_name || "",
    username: row.username || undefined,
    avatarUrl: row.avatar_url || undefined,
    usernameUpdatedAt: row.username_updated_at ? Number(row.username_updated_at) : undefined,
    usernameUpdateCount: row.username_update_count || 0,
    referredBy: row.referred_by || undefined,
    pendingReferralBy: row.pending_referral_by || undefined,
    referralRewarded: row.referral_rewarded || false,
    referralCount: row.referral_count || 0,
    gamesPlayed: row.games_played || 0,
    gamesWon: row.games_won || 0,
    totalWagered: parseFloat(row.total_wagered) || 0,
    totalWon: parseFloat(row.total_won) || 0,
    wagaEarned: parseFloat(row.waga_earned) || 0,
    wagaVestingTotal: parseFloat(row.waga_vesting_total) || 0,
    wagaVestingClaimed: parseFloat(row.waga_vesting_claimed) || 0,
    wagaVestingLastClaim: row.waga_vesting_last_claim ? Number(row.waga_vesting_last_claim) : undefined,
    currentStreak: row.current_streak || 0,
    bestStreak: row.best_streak || 0,
    luckScore: row.luck_score || 50,
    godStreakActive: row.god_streak_active || false,
    godStreakLength: row.god_streak_length || 0,
    godStreakGamesRemaining: row.god_streak_games_remaining || 0,
    godStreakStartedAt: row.god_streak_started_at ? Number(row.god_streak_started_at) : undefined,
    godStreakLastPlayedAt: row.god_streak_last_played_at ? Number(row.god_streak_last_played_at) : undefined,
    isStreakBreakerActive: row.is_streak_breaker_active || false,
    godStreaksAchieved: row.god_streaks_achieved || 0,
    streaksBeaten: row.streaks_beaten || 0,
    chatWarnings: row.chat_warnings || 0,
    timeoutUntil: row.timeout_until ? Number(row.timeout_until) : undefined,
    isBanned: row.is_banned || false,
    lastPlayedAt: row.last_played_at ? Number(row.last_played_at) : undefined,
    createdAt: Number(row.created_at),
  };
}

export class PgStorage implements IStorage {
  private avatarImages: Map<string, { data: Buffer; contentType: string }> = new Map();
  private chatMessages: Map<string, ChatMessage[]> = new Map();
  private games: Map<string, Game> = new Map();
  private gameSimTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.startGodStreakCron();
  }

  // ---------------------------------------------------------------------------
  // God Streak cron — runs every hour server-side
  // ---------------------------------------------------------------------------
  private startGodStreakCron(): void {
    setInterval(async () => {
      try {
        const result = await pool.query(
          "SELECT wallet_address FROM player_profiles WHERE god_streak_active = TRUE"
        );
        for (const row of result.rows) {
          await this.checkAndExpireGodStreak(row.wallet_address);
        }
      } catch (e) {
        console.error("[CRON] God streak check failed:", e);
      }
    }, 60 * 60 * 1000);
  }

  // ---------------------------------------------------------------------------
  // Profile methods
  // ---------------------------------------------------------------------------

  async getProfile(walletAddress: string): Promise<PlayerProfile | undefined> {
    const { rows } = await pool.query(
      "SELECT * FROM player_profiles WHERE wallet_address = $1",
      [walletAddress]
    );
    return rows[0] ? rowToProfile(rows[0]) : undefined;
  }

  async getProfileByUsername(username: string): Promise<PlayerProfile | undefined> {
    const { rows } = await pool.query(
      "SELECT * FROM player_profiles WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    return rows[0] ? rowToProfile(rows[0]) : undefined;
  }

  async getProfileByUsernameOrWallet(identifier: string): Promise<PlayerProfile | undefined> {
    const { rows } = await pool.query(
      "SELECT * FROM player_profiles WHERE wallet_address = $1 OR LOWER(username) = LOWER($1)",
      [identifier]
    );
    return rows[0] ? rowToProfile(rows[0]) : undefined;
  }

  async createProfile(data: { walletAddress: string; displayName?: string }): Promise<PlayerProfile> {
    const now = Date.now();
    const { rows } = await pool.query(
      `INSERT INTO player_profiles (wallet_address, display_name, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING *`,
      [data.walletAddress, data.displayName || "", now]
    );
    return rowToProfile(rows[0]);
  }

  async updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined> {
    const profile = await this.getProfile(walletAddress);
    if (!profile) return undefined;

    // Referral guard — same logic as MemStorage
    if (updates.referredBy && !profile.referredBy && !profile.pendingReferralBy && updates.referredBy !== walletAddress) {
      const referrer = await this.getProfileByUsernameOrWallet(updates.referredBy);
      if (referrer && referrer.walletAddress !== walletAddress) {
        if (referrer.pendingReferralBy === walletAddress) {
          console.warn("[REFERRAL] Cyclic referral blocked");
          delete updates.referredBy;
        } else {
          updates.pendingReferralBy = referrer.walletAddress;
          updates.referredBy = referrer.username || referrer.walletAddress;
          updates.referralRewarded = false;
        }
      } else {
        delete updates.referredBy;
      }
    }

    // ABUSE PREVENTION: pendingReferralBy cannot be changed once referralRewarded is true
    if (profile.referralRewarded && updates.pendingReferralBy) {
      delete updates.pendingReferralBy;
    }

    const merged = { ...profile, ...updates };

    await pool.query(
      `UPDATE player_profiles SET
        display_name = $2,
        username = $3,
        avatar_url = $4,
        username_updated_at = $5,
        username_update_count = $6,
        referred_by = $7,
        pending_referral_by = $8,
        referral_rewarded = $9,
        referral_count = $10,
        games_played = $11,
        games_won = $12,
        total_wagered = $13,
        total_won = $14,
        waga_earned = $15,
        waga_vesting_total = $16,
        waga_vesting_claimed = $17,
        waga_vesting_last_claim = $18,
        current_streak = $19,
        best_streak = $20,
        luck_score = $21,
        god_streak_active = $22,
        god_streak_length = $23,
        god_streak_games_remaining = $24,
        god_streak_started_at = $25,
        god_streak_last_played_at = $26,
        is_streak_breaker_active = $27,
        god_streaks_achieved = $28,
        streaks_beaten = $29,
        chat_warnings = $30,
        timeout_until = $31,
        is_banned = $32,
        last_played_at = $33
      WHERE wallet_address = $1`,
      [
        walletAddress,
        merged.displayName || "",
        merged.username || null,
        merged.avatarUrl || null,
        merged.usernameUpdatedAt || null,
        merged.usernameUpdateCount || 0,
        merged.referredBy || null,
        merged.pendingReferralBy || null,
        merged.referralRewarded || false,
        merged.referralCount || 0,
        merged.gamesPlayed || 0,
        merged.gamesWon || 0,
        merged.totalWagered || 0,
        merged.totalWon || 0,
        merged.wagaEarned || 0,
        merged.wagaVestingTotal || 0,
        merged.wagaVestingClaimed || 0,
        merged.wagaVestingLastClaim || null,
        merged.currentStreak || 0,
        merged.bestStreak || 0,
        merged.luckScore || 50,
        merged.godStreakActive || false,
        merged.godStreakLength || 0,
        merged.godStreakGamesRemaining || 0,
        merged.godStreakStartedAt || null,
        merged.godStreakLastPlayedAt || null,
        merged.isStreakBreakerActive || false,
        merged.godStreaksAchieved || 0,
        merged.streaksBeaten || 0,
        merged.chatWarnings || 0,
        merged.timeoutUntil || null,
        merged.isBanned || false,
        merged.lastPlayedAt || null,
      ]
    );

    return merged as PlayerProfile;
  }

  async getOrCreateProfile(walletAddress: string): Promise<PlayerProfile> {
    const existing = await this.getProfile(walletAddress);
    if (existing) return existing;
    return this.createProfile({ walletAddress });
  }

  async checkUsernameUnique(username: string): Promise<boolean> {
    const { rows } = await pool.query(
      "SELECT 1 FROM player_profiles WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    return rows.length === 0;
  }

  async getAllProfiles(): Promise<PlayerProfile[]> {
    const { rows } = await pool.query("SELECT * FROM player_profiles");
    return rows.map(rowToProfile);
  }

  async checkAndExpireGodStreak(walletAddress: string): Promise<void> {
    const profile = await this.getProfile(walletAddress);
    if (!profile || !profile.godStreakActive) return;
    const now = Date.now();
    const lastPlayed = profile.godStreakLastPlayedAt || profile.godStreakStartedAt || 0;
    if (now - lastPlayed > GOD_CAMPING_TIMEOUT_MS) {
      console.log(`[GOD STREAK] ${walletAddress.slice(0, 6)}... expired (72h inactivity)`);
      await this.updateProfile(walletAddress, {
        godStreakActive: false,
        godStreakGamesRemaining: 0,
        isStreakBreakerActive: false,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Referral
  // ---------------------------------------------------------------------------

  async grantPendingReferralRewards(walletAddress: string): Promise<{ granted: boolean; referrerWallet?: string } | null> {
    const profile = await this.getProfile(walletAddress);
    if (!profile) return null;
    if (!profile.pendingReferralBy || profile.referralRewarded) return { granted: false };

    const referrer = await this.getProfile(profile.pendingReferralBy);
    if (!referrer) return { granted: false };

    await this.updateProfile(referrer.walletAddress, {
      wagaEarned: (referrer.wagaEarned || 0) + REFERRAL_REWARD_AMOUNT,
      referralCount: (referrer.referralCount || 0) + 1,
    });
    await this.updateProfile(walletAddress, {
      wagaEarned: (profile.wagaEarned || 0) + REFERRAL_REWARD_AMOUNT,
      referralRewarded: true,
    });

    return { granted: true, referrerWallet: referrer.walletAddress };
  }

  async rollbackReferralRewards(walletAddress: string): Promise<void> {
    const profile = await this.getProfile(walletAddress);
    if (!profile) return;

    if (profile.pendingReferralBy) {
      const referrer = await this.getProfile(profile.pendingReferralBy);
      if (referrer) {
        await this.updateProfile(referrer.walletAddress, {
          wagaEarned: Math.max(0, (referrer.wagaEarned || 0) - REFERRAL_REWARD_AMOUNT),
          referralCount: Math.max(0, (referrer.referralCount || 0) - 1),
        });
      }
    }

    await this.updateProfile(walletAddress, {
      wagaEarned: Math.max(0, (profile.wagaEarned || 0) - REFERRAL_REWARD_AMOUNT),
      referralRewarded: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Vesting
  // ---------------------------------------------------------------------------

  async previewVestedClaim(walletAddress: string): Promise<{ canClaim: boolean; claimAmount: number; remainingVesting: number; nextClaimTime: number } | null> {
    const profile = await this.getProfile(walletAddress);
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

    const remaining = (profile.wagaVestingTotal || 0) - (profile.wagaVestingClaimed || 0);
    if (remaining <= 0) return { canClaim: false, claimAmount: 0, remainingVesting: 0, nextClaimTime: 0 };

    const claimAmount = Math.ceil(remaining * (VESTING_DAILY_PERCENT / 100));
    if (claimAmount <= 0) return { canClaim: false, claimAmount: 0, remainingVesting: remaining, nextClaimTime: 0 };

    return { canClaim: true, claimAmount, remainingVesting: remaining, nextClaimTime: now + VESTING_PERIOD_MS };
  }

  async commitVestedClaim(walletAddress: string, claimAmount: number): Promise<void> {
    const profile = await this.getProfile(walletAddress);
    if (!profile || claimAmount <= 0) return;
    const now = Date.now();
    await this.updateProfile(walletAddress, {
      wagaVestingClaimed: (profile.wagaVestingClaimed || 0) + claimAmount,
      wagaVestingLastClaim: now,
      wagaEarned: (profile.wagaEarned || 0) + claimAmount,
    });
    console.log(`[VESTING] ${walletAddress.slice(0, 6)}... claimed ${claimAmount} WAGA`);
  }

  // ---------------------------------------------------------------------------
  // Transaction replay protection
  // ---------------------------------------------------------------------------

  async isTransactionUsed(signature: string): Promise<boolean> {
    const { rows } = await pool.query(
      "SELECT 1 FROM used_tx_signatures WHERE signature = $1",
      [signature]
    );
    return rows.length > 0;
  }

  async markTransactionUsed(signature: string, walletAddress: string): Promise<void> {
    await pool.query(
      "INSERT INTO used_tx_signatures (signature, wallet_address, used_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [signature, walletAddress, Date.now()]
    );
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(gameId) || [];
  }

  async addChatMessage(data: ChatMessage): Promise<ChatMessage> {
    const message = { ...data, id: data.id || `msg_${Date.now()}`, timestamp: Date.now() };
    const messages = this.chatMessages.get(data.gameId) || [];
    messages.push(message);
    if (messages.length > 50) messages.shift();
    this.chatMessages.set(data.gameId, messages);
    return message;
  }

  async getGlobalChatMessages(limit: number = 100): Promise<GlobalChatMessage[]> {
    const { rows } = await pool.query(
      "SELECT * FROM global_chat_messages ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    return rows.reverse().map((r: any) => ({
      id: r.id,
      walletAddress: r.wallet_address,
      username: r.username || undefined,
      message: r.message,
      timestamp: Number(r.timestamp),
      isGodStreak: r.is_god_streak || false,
      isStreakBreaker: r.is_streak_breaker || false,
      tipAmount: r.data?.tipAmount,
      tipRecipient: r.data?.tipRecipient,
      color: r.color,
      avatarUrl: r.avatar_url || undefined,
    }));
  }

  async addGlobalChatMessage(data: any): Promise<any> {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    await pool.query(
      `INSERT INTO global_chat_messages (id, wallet_address, username, message, timestamp, is_god_streak, is_streak_breaker, color, avatar_url, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, data.walletAddress, data.username || null, data.message, now,
       data.isGodStreak || false, data.isStreakBreaker || false,
       data.color || null, data.avatarUrl || null, JSON.stringify({})]
    );
    // Keep only last 500 messages
    await pool.query(
      `DELETE FROM global_chat_messages WHERE id NOT IN (
        SELECT id FROM global_chat_messages ORDER BY timestamp DESC LIMIT 500
      )`
    );
    return { id, ...data, timestamp: now };
  }

  // ---------------------------------------------------------------------------
  // Game History
  // ---------------------------------------------------------------------------

  async getGameHistory(walletAddress: string, limit: number): Promise<GameHistory[]> {
    const { rows } = await pool.query(
      "SELECT data FROM game_history WHERE wallet_address = $1 ORDER BY played_at DESC LIMIT $2",
      [walletAddress, limit]
    );
    return rows.map((r: any) => r.data as GameHistory);
  }

  async addGameHistory(walletAddress: string, history: GameHistory): Promise<void> {
    await pool.query(
      "INSERT INTO game_history (wallet_address, data, played_at) VALUES ($1, $2, $3)",
      [walletAddress, JSON.stringify(history), history.playedAt]
    );
  }

  // ---------------------------------------------------------------------------
  // Giveaway
  // ---------------------------------------------------------------------------

  async getGiveawayStats(): Promise<GiveawayStats> {
    const { rows } = await pool.query("SELECT * FROM giveaway_stats WHERE id = 1");
    if (!rows[0]) {
      return {
        totalGamesPlayed: 0,
        cycleStartGameCount: 0,
        giveawayWalletBalance: 0,
        lastUpdatedAt: Date.now(),
        currentCycleStart: Date.now(),
        currentSeason: 1,
      };
    }
    const r = rows[0];
    return {
      totalGamesPlayed: r.total_games_played || 0,
      cycleStartGameCount: r.cycle_start_game_count || 0,
      giveawayWalletBalance: parseFloat(r.giveaway_wallet_balance) || 0,
      lastUpdatedAt: Number(r.last_updated_at) || 0,
      currentCycleStart: Number(r.current_cycle_start) || 0,
      currentSeason: r.current_season || 1,
    };
  }

  private async updateGiveawayStats(updates: Partial<GiveawayStats>): Promise<void> {
    const current = await this.getGiveawayStats();
    const merged = { ...current, ...updates };
    await pool.query(
      `UPDATE giveaway_stats SET
        total_games_played = $1,
        cycle_start_game_count = $2,
        giveaway_wallet_balance = $3,
        last_updated_at = $4,
        current_cycle_start = $5,
        current_season = $6
      WHERE id = 1`,
      [merged.totalGamesPlayed, merged.cycleStartGameCount, merged.giveawayWalletBalance,
       merged.lastUpdatedAt, merged.currentCycleStart, merged.currentSeason]
    );
  }

  async getGiveawayLeaderboard(): Promise<{ luck: LeaderboardEntry[]; streaks: LeaderboardEntry[] }> {
    const luck = await this.getLeaderboard("luck", 10, "all");
    const streaks = await this.getLeaderboard("streaks", 10, "all");
    return { luck, streaks };
  }

  async getGiveawayWinners(season?: number): Promise<GiveawayWinner[]> {
    const { rows } = season
      ? await pool.query("SELECT * FROM giveaway_winners WHERE season = $1 ORDER BY rank ASC", [season])
      : await pool.query("SELECT * FROM giveaway_winners ORDER BY season DESC, rank ASC");
    return rows.map((r: any) => ({
      id: r.id,
      season: r.season,
      walletAddress: r.wallet_address,
      username: r.username || undefined,
      payoutSol: parseFloat(r.payout_sol),
      type: r.type,
      rank: r.rank,
      wonAt: Number(r.won_at),
    }));
  }

  private async triggerGiveawayPayout(): Promise<void> {
    const stats = await this.getGiveawayStats();
    const jackpot = Math.max(GIVEAWAY_MIN_SOL_FLOOR, stats.giveawayWalletBalance);
    const luckWinners = await this.getLeaderboard("luck", 10, "all");
    const streakWinners = await this.getLeaderboard("streaks", 10, "all");

    for (let i = 0; i < luckWinners.length; i++) {
      const w = luckWinners[i];
      const pct = GIVEAWAY_PAYOUT_PERCENTS[i] || 0;
      await pool.query(
        `INSERT INTO giveaway_winners (id, season, wallet_address, username, payout_sol, type, rank, won_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [`win_luck_${stats.currentSeason}_${i}`, stats.currentSeason, w.walletAddress,
         w.displayName || null, jackpot * (pct / 100) / 2, "luck", i + 1, Date.now()]
      );
    }
    for (let i = 0; i < streakWinners.length; i++) {
      const w = streakWinners[i];
      const pct = GIVEAWAY_PAYOUT_PERCENTS[i] || 0;
      await pool.query(
        `INSERT INTO giveaway_winners (id, season, wallet_address, username, payout_sol, type, rank, won_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [`win_streak_${stats.currentSeason}_${i}`, stats.currentSeason, w.walletAddress,
         w.displayName || null, jackpot * (pct / 100) / 2, "streak", i + 1, Date.now()]
      );
    }

    await this.updateGiveawayStats({
      cycleStartGameCount: stats.totalGamesPlayed,
      giveawayWalletBalance: 0,
      currentCycleStart: Date.now(),
      currentSeason: stats.currentSeason + 1,
      lastUpdatedAt: Date.now(),
    });

    // Reset player stats for new season
    await pool.query(
      `UPDATE player_profiles SET
        games_played = 0, games_won = 0, current_streak = 0, best_streak = 0, luck_score = 50`
    );

    console.log(`[GIVEAWAY] Season ${stats.currentSeason} complete! Season ${stats.currentSeason + 1} started.`);
  }

  // ---------------------------------------------------------------------------
  // Leaderboard
  // ---------------------------------------------------------------------------

  private calculateLuckScore(gamesWon: number, gamesPlayed: number): number {
    if (gamesPlayed < 3) return 50;
    const expectedWinRate = 0.35;
    const actualWinRate = gamesWon / gamesPlayed;
    const luckFactor = actualWinRate / expectedWinRate;
    let luckScore = luckFactor >= 1
      ? 50 + (50 * Math.min(1, (luckFactor - 1) / 1.5))
      : 50 * luckFactor;
    return Math.round(Math.max(0, Math.min(100, luckScore)));
  }

  async getLeaderboard(sortBy: "earnings" | "luck" | "streaks", limit: number = 50, period: LeaderboardPeriod = "all"): Promise<LeaderboardEntry[]> {
    if (period === "all") {
      let orderBy = sortBy === "earnings" ? "total_won DESC"
        : sortBy === "luck" ? "luck_score DESC"
        : "best_streak DESC";

      const { rows } = await pool.query(
        `SELECT * FROM player_profiles WHERE games_played > 0 ORDER BY ${orderBy} LIMIT $1`,
        [limit]
      );

      return rows.map((row: any, i: number) => {
        const p = rowToProfile(row);
        return {
          rank: i + 1,
          walletAddress: p.walletAddress,
          displayName: p.username || p.displayName,
          totalWon: p.totalWon,
          gamesWon: p.gamesWon,
          gamesPlayed: p.gamesPlayed,
          winRate: p.gamesPlayed > 0 ? (p.gamesWon / p.gamesPlayed) * 100 : 0,
          luckScore: p.luckScore,
          bestStreak: p.bestStreak,
          godStreakActive: p.godStreakActive,
          isStreakBreakerActive: p.isStreakBreakerActive,
        };
      });
    }

    // Period-based: compute from game_history table
    const periodStart = this.getPeriodStartTime(period);
    const { rows } = await pool.query(
      `SELECT wallet_address, data FROM game_history WHERE played_at >= $1`,
      [periodStart]
    );

    const statsMap = new Map<string, { totalWon: number; gamesWon: number; gamesPlayed: number; bestStreak: number; currentStreak: number }>();
    for (const row of rows) {
      const h = row.data as GameHistory;
      const w = row.wallet_address;
      if (!statsMap.has(w)) statsMap.set(w, { totalWon: 0, gamesWon: 0, gamesPlayed: 0, bestStreak: 0, currentStreak: 0 });
      const s = statsMap.get(w)!;
      s.gamesPlayed++;
      if (h.result === "won") {
        s.totalWon += h.payout || 0;
        s.gamesWon++;
        s.currentStreak++;
        s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      } else {
        s.currentStreak = 0;
      }
    }

    const entries: LeaderboardEntry[] = [];
    for (const [wallet, s] of statsMap.entries()) {
      const { rows: pr } = await pool.query("SELECT * FROM player_profiles WHERE wallet_address = $1", [wallet]);
      const p = pr[0] ? rowToProfile(pr[0]) : null;
      entries.push({
        rank: 0,
        walletAddress: wallet,
        displayName: p?.username || p?.displayName,
        totalWon: s.totalWon,
        gamesWon: s.gamesWon,
        gamesPlayed: s.gamesPlayed,
        winRate: s.gamesPlayed > 0 ? (s.gamesWon / s.gamesPlayed) * 100 : 0,
        luckScore: this.calculateLuckScore(s.gamesWon, s.gamesPlayed),
        bestStreak: s.bestStreak,
        godStreakActive: p?.godStreakActive,
        isStreakBreakerActive: p?.isStreakBreakerActive,
      });
    }

    entries.sort((a, b) => sortBy === "earnings" ? b.totalWon - a.totalWon
      : sortBy === "luck" ? b.luckScore - a.luckScore
      : b.bestStreak - a.bestStreak);

    return entries.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private getPeriodStartTime(period: LeaderboardPeriod): number {
    if (period === "all") return 0;
    const now = new Date();
    if (period === "daily") {
      const s = new Date(now); s.setUTCHours(0, 0, 0, 0); return s.getTime();
    }
    if (period === "weekly") {
      const s = new Date(now);
      const day = s.getUTCDay();
      s.setUTCDate(s.getUTCDate() - (day === 0 ? 6 : day - 1));
      s.setUTCHours(0, 0, 0, 0);
      return s.getTime();
    }
    if (period === "monthly") {
      const s = new Date(now); s.setUTCDate(1); s.setUTCHours(0, 0, 0, 0); return s.getTime();
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Global stats
  // ---------------------------------------------------------------------------

  async getGlobalStats(): Promise<{ gamesPlayed: number; solWon: number; playersCount: number; wagaRewarded: number }> {
    const { rows: statsRows } = await pool.query(
      "SELECT SUM(total_won) as sol_won, COUNT(*) FILTER (WHERE games_played > 0) as players, SUM(waga_earned + waga_vesting_total) as waga FROM player_profiles"
    );
    const giveaway = await this.getGiveawayStats();
    return {
      gamesPlayed: giveaway.totalGamesPlayed,
      solWon: parseFloat(statsRows[0]?.sol_won) || 0,
      playersCount: parseInt(statsRows[0]?.players) || 0,
      wagaRewarded: parseFloat(statsRows[0]?.waga) || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Completed games
  // ---------------------------------------------------------------------------

  async getCompletedGames(limit: number = 50): Promise<Game[]> {
    const { rows } = await pool.query(
      "SELECT data FROM games WHERE status = 'completed' ORDER BY completed_at DESC LIMIT $1",
      [limit]
    );
    return rows.map((r: any) => r.data as Game);
  }

  async verifyGame(serverSeedHash: string): Promise<Game | undefined> {
    const { rows } = await pool.query(
      "SELECT data FROM games WHERE status = 'completed' AND data->>'serverSeedHash' = $1",
      [serverSeedHash]
    );
    return rows[0] ? (rows[0].data as Game) : undefined;
  }

  // ---------------------------------------------------------------------------
  // Avatar images (kept in memory + DB)
  // ---------------------------------------------------------------------------

  storeAvatarImage(walletAddress: string, data: Buffer, contentType: string): void {
    this.avatarImages.set(walletAddress, { data, contentType });
    pool.query(
      "INSERT INTO avatar_images (wallet_address, data, content_type, updated_at) VALUES ($1,$2,$3,$4) ON CONFLICT (wallet_address) DO UPDATE SET data=$2, content_type=$3, updated_at=$4",
      [walletAddress, data, contentType, Date.now()]
    ).catch(e => console.error("[DB] Avatar save failed:", e));
  }

  getAvatarImage(walletAddress: string): { data: Buffer; contentType: string } | null {
    return this.avatarImages.get(walletAddress) || null;
  }

  async loadAvatarFromDb(walletAddress: string): Promise<void> {
    if (this.avatarImages.has(walletAddress)) return;
    const { rows } = await pool.query("SELECT data, content_type FROM avatar_images WHERE wallet_address = $1", [walletAddress]);
    if (rows[0]) {
      this.avatarImages.set(walletAddress, { data: rows[0].data, contentType: rows[0].content_type });
    }
  }

  // ---------------------------------------------------------------------------
  // Game management (in-memory for active games, DB for completed)
  // ---------------------------------------------------------------------------

  async getGame(id: string): Promise<Game | undefined> {
    const inMem = this.games.get(id);
    if (inMem) return inMem;
    const { rows } = await pool.query("SELECT data FROM games WHERE id = $1", [id]);
    return rows[0] ? (rows[0].data as Game) : undefined;
  }

  async getLiveGames(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(
      g => g.status === "waiting" || g.status === "countdown" || g.status === "in_progress"
    );
  }

  async createGame(game: InsertGame): Promise<Game> {
    const id = `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const config = GAME_MODES[game.mode];
    const onChainGameId = BigInt(Date.now());
    const [escrowPDA] = solanaClient.getGamePoolPDA(onChainGameId);
    const serverSeed = randomBytes(32).toString("hex");
    const serverSeedHash = createHmac("sha256", "seed_salt").update(serverSeed).digest("hex");

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
    await pool.query(
      "INSERT INTO games (id, data, status, created_at) VALUES ($1,$2,$3,$4)",
      [id, JSON.stringify(newGame), "waiting", newGame.createdAt]
    );

    if (solanaClient.isOnChainEnabled()) {
      const programDeployed = await solanaClient.isProgramDeployed();
      if (programDeployed) {
        const result = await solanaClient.createGameOnChain(onChainGameId, game.mode, game.wager);
        if (result.success) console.log(`[ON-CHAIN] Game initialized: ${result.signature}`);
      }
    }

    return newGame;
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined> {
    const game = await this.getGame(id);
    if (!game) return undefined;
    const updated = { ...game, ...updates };
    this.games.set(id, updated);
    await pool.query(
      "UPDATE games SET data=$2, status=$3, completed_at=$4 WHERE id=$1",
      [id, JSON.stringify(updated), updated.status, updated.completedAt || null]
    );
    return updated;
  }

  async updateGameStatus(id: string, status: string): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    game.status = status as Game["status"];

    if (status === "countdown") {
      const now = Date.now();
      game.countdownEndsAt = now + 10000;
      setTimeout(() => this.startGame(id), 10000);
    }

    this.games.set(id, game);
    await pool.query("UPDATE games SET data=$2, status=$3 WHERE id=$1", [id, JSON.stringify(game), status]);
    return game;
  }

  async findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined> {
    const config = GAME_MODES[mode];
    return Array.from(this.games.values()).find(
      g => g.mode === mode && g.wager === wager && g.status === "waiting" && g.players.length < config.players
    );
  }

  async joinGame(gameId: string, walletAddress: string, txSignature?: string): Promise<Game | undefined> {
    const game = this.games.get(gameId);
    if (!game) return undefined;

    const config = GAME_MODES[game.mode];
    if (game.players.length >= config.players) return undefined;
    if (game.players.some(p => p.walletAddress === walletAddress)) return game;

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

    if (entryWagaReward > 0 && solanaClient.hasAuthority()) {
      const wagaResult = await solanaClient.transferWagaFromVault(walletAddress, entryWagaReward);
      if (wagaResult.success) console.log(`[WAGA] Entry reward sent: ${wagaResult.txSig}`);
      else console.warn(`[WAGA] Entry reward failed: ${wagaResult.error}`);
    }

    this.games.set(gameId, game);
    await pool.query("UPDATE games SET data=$2 WHERE id=$1", [gameId, JSON.stringify(game)]);
    return game;
  }

  // ---------------------------------------------------------------------------
  // Game simulation (same logic as MemStorage)
  // ---------------------------------------------------------------------------

  private deriveSpecialEventRoll(serverSeed: string, clientSeed: string, nonce: string): number {
    const hmac = createHmac("sha256", serverSeed);
    hmac.update(`special-${clientSeed}-${nonce}`);
    return parseInt(hmac.digest("hex").substring(0, 5), 16) % 1000000;
  }

  private generateFairNumber(serverSeed: string, clientSeed: string, nonce: number): number {
    const hmac = createHmac("sha256", serverSeed);
    hmac.update(`${clientSeed}-${nonce}`);
    const hash = hmac.digest("hex");
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }

  private weightedFairSelection(serverSeed: string, clientSeed: string, nonce: number, weightA: number): boolean {
    return this.generateFairNumber(serverSeed, clientSeed, nonce) < weightA;
  }

  private async startGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "countdown") return;
    const config = GAME_MODES[game.mode];
    const now = Date.now();
    game.status = "in_progress";
    game.startedAt = now;
    game.roundEndsAt = now + config.timer * 1000;
    game.rounds = [{ roundNumber: 1, players: game.players.map(p => p.id) }];
    this.games.set(gameId, game);
    await pool.query("UPDATE games SET data=$2, status=$3 WHERE id=$1", [gameId, JSON.stringify(game), "in_progress"]);
    this.simulateGame(gameId);
  }

  private async simulateGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) return;

    const clientSeed = game.players.map(p => p.walletAddress.substring(0, 8)).join("-");
    game.clientSeed = clientSeed;

    const config = GAME_MODES[game.mode];
    const roundDuration = config.timer * 1000;
    let remainingPlayers = [...game.players];

    for (const player of game.players) {
      await this.checkAndExpireGodStreak(player.walletAddress);
    }

    const playerProfiles = new Map<string, PlayerProfile>();
    for (const player of game.players) {
      const profile = await this.getOrCreateProfile(player.walletAddress);
      playerProfiles.set(player.walletAddress, profile);
    }

    for (let round = 1; round <= config.rounds; round++) {
      await new Promise(r => setTimeout(r, roundDuration));

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

          let aWinWeight = 0.5;
          let breakerTriggered = false;
          let breakerPlayer: typeof playerA | null = null;
          let naturalBreaker = false;

          if (aIsGod && !bIsGod) {
            const roll = this.deriveSpecialEventRoll(currentGame.serverSeed || "default", clientSeed, `breaker-${round}-${i}`);
            if (roll < BREAKER_CHANCE) { breakerTriggered = true; breakerPlayer = playerB; aWinWeight = 1 - BREAKER_WIN_WEIGHT; }
            else aWinWeight = GOD_STREAK_WIN_WEIGHT;
          } else if (bIsGod && !aIsGod) {
            const roll = this.deriveSpecialEventRoll(currentGame.serverSeed || "default", clientSeed, `breaker-${round}-${i}-b`);
            if (roll < BREAKER_CHANCE) { breakerTriggered = true; breakerPlayer = playerA; aWinWeight = BREAKER_WIN_WEIGHT; }
            else aWinWeight = 1 - GOD_STREAK_WIN_WEIGHT;
          }

          const aWins = this.weightedFairSelection(currentGame.serverSeed || "default", clientSeed, round + i, aWinWeight);
          const winner = aWins ? playerA : playerB;
          const loser = aWins ? playerB : playerA;

          if ((aIsGod && !aWins) || (bIsGod && aWins)) {
            const godPlayer = aIsGod ? playerA : playerB;
            if (!breakerTriggered) naturalBreaker = true;
            await this.updateProfile(godPlayer.walletAddress, { godStreakActive: false, godStreakGamesRemaining: 0, isStreakBreakerActive: false });
            const wp = await this.getProfile(winner.walletAddress);
            if (wp) await this.updateProfile(winner.walletAddress, { streaksBeaten: (wp.streaksBeaten || 0) + 1, isStreakBreakerActive: false });
          }

          if ((aIsGod && aWins) || (bIsGod && !aWins)) {
            const godPlayer = aIsGod ? playerA : playerB;
            const gp = playerProfiles.get(godPlayer.walletAddress);
            if (gp) {
              const newRemaining = Math.max(0, (gp.godStreakGamesRemaining || 0) - 1);
              const up = await this.updateProfile(godPlayer.walletAddress, { godStreakLastPlayedAt: Date.now(), godStreakGamesRemaining: newRemaining, godStreakActive: newRemaining > 0 });
              if (up) playerProfiles.set(godPlayer.walletAddress, up);
            }
          }

          if (breakerTriggered && breakerPlayer) {
            await this.updateProfile(breakerPlayer.walletAddress, { isStreakBreakerActive: true });
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

      losers.forEach(loser => {
        const p = currentGame.players.find(p => p.id === loser.id);
        if (p) { p.isEliminated = true; p.eliminatedRound = round; }
      });

      currentGame.rounds.push({ roundNumber: round, players: remainingPlayers.map(p => p.id), winnerId: winners.length === 1 ? winners[0].id : undefined, resolvedAt: Date.now() });
      currentGame.currentRound = round + 1;
      remainingPlayers = winners;
      if (remainingPlayers.length > 1) currentGame.roundEndsAt = Date.now() + roundDuration;
      this.games.set(gameId, currentGame);
      if (remainingPlayers.length === 1) break;
    }

    const finalGame = this.games.get(gameId);
    if (!finalGame) return;

    const winner = remainingPlayers[0];
    const payout = finalGame.poolAmount * WINNER_SHARE;
    const treasuryFee = finalGame.poolAmount * FOUNDATION_FEE;
    const giveawayFee = finalGame.poolAmount * GIVEAWAY_FEE;

    let wagaMultiplier = WAGA_WINNER_MULTIPLIER;
    if (finalGame.naturalBreakerBonus && finalGame.breakerPlayerId === winner.walletAddress)
      wagaMultiplier = WAGA_WINNER_MULTIPLIER * NATURAL_BREAKER_WAGA_MULTIPLIER;
    else if (finalGame.breakerTriggered && finalGame.breakerPlayerId === winner.walletAddress)
      wagaMultiplier = WAGA_WINNER_MULTIPLIER * TRIGGERED_BREAKER_WAGA_MULTIPLIER;

    const winWagaReward = calculateWagaReward(payout, wagaMultiplier);

    finalGame.status = "completed";
    finalGame.completedAt = Date.now();
    finalGame.winnerId = winner.walletAddress;
    finalGame.winnerPayout = payout;
    finalGame.wagaRewards = winWagaReward;

    // Update giveaway stats
    const stats = await this.getGiveawayStats();
    const newStats = { ...stats, totalGamesPlayed: stats.totalGamesPlayed + 1, giveawayWalletBalance: stats.giveawayWalletBalance + giveawayFee, lastUpdatedAt: Date.now() };
    await this.updateGiveawayStats(newStats);
    if (newStats.totalGamesPlayed - newStats.cycleStartGameCount >= GIVEAWAY_MILESTONE_GAMES) {
      await this.triggerGiveawayPayout();
    }

    // God streak trigger check
    const godRoll = this.deriveSpecialEventRoll(finalGame.serverSeed || "default", finalGame.clientSeed || "", "god-trigger");
    if (godRoll < GOD_STREAK_CHANCE) {
      const idx = parseInt(createHmac("sha256", finalGame.serverSeed || "default").update(`god-recipient-${finalGame.clientSeed}`).digest("hex").substring(0, 4), 16) % finalGame.players.length;
      const godRecipient = finalGame.players[idx];
      const streakLength = GOD_STREAK_MIN_LENGTH + parseInt(createHmac("sha256", finalGame.serverSeed || "default").update(`god-length-${finalGame.clientSeed}`).digest("hex").substring(0, 6), 16) % (GOD_STREAK_MAX_LENGTH - GOD_STREAK_MIN_LENGTH + 1);
      const rp = await this.getProfile(godRecipient.walletAddress);
      if (rp && !rp.godStreakActive) {
        await this.updateProfile(godRecipient.walletAddress, { godStreakActive: true, godStreakLength: streakLength, godStreakGamesRemaining: streakLength, godStreakStartedAt: Date.now(), godStreakLastPlayedAt: Date.now(), godStreaksAchieved: (rp.godStreaksAchieved || 0) + 1 });
        finalGame.godStreakTriggered = true;
        finalGame.godStreakRecipient = godRecipient.walletAddress;
        console.log(`[GOD STREAK] *** TRIGGERED *** ${godRecipient.walletAddress.slice(0, 6)}... (length hidden)`);
      }
    }

    // Fee transfers
    if (solanaClient.isOnChainEnabled()) {
      solanaClient.transferSol("BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP", treasuryFee).then(r => r.success ? console.log(`[FEE] Treasury: ${r.txSig}`) : console.warn(`[FEE] Treasury failed: ${r.error}`));
      solanaClient.transferSol("FGY64g3Pt8wMrMR3A9abkVxSjwh2Yt4dT4BYkw6rU3yf", giveawayFee).then(r => r.success ? console.log(`[FEE] Giveaway: ${r.txSig}`) : console.warn(`[FEE] Giveaway failed: ${r.error}`));
    }

    // WAGA winner reward
    if (winWagaReward > 0 && solanaClient.hasAuthority()) {
      const wagaResult = await solanaClient.transferWagaFromVault(winner.walletAddress, winWagaReward);
      wagaResult.success ? console.log(`[WAGA] Win reward sent: ${wagaResult.txSig}`) : console.error(`[WAGA] Win reward failed: ${wagaResult.error}`);
    }

    // On-chain payouts
    if (solanaClient.isOnChainEnabled() && finalGame.onChainGameId) {
      try {
        const programDeployed = await solanaClient.isProgramDeployed();
        if (programDeployed) {
          const res = await solanaClient.executePayouts(BigInt(finalGame.onChainGameId), winner.walletAddress, payout, treasuryFee);
          if (res.success) { finalGame.winnerPayoutTxSig = res.winnerTxSig; finalGame.treasuryFeeTxSig = res.treasuryTxSig; }
        } else {
          const wt = await solanaClient.transferSol(winner.walletAddress, payout);
          const tt = await solanaClient.transferSol(solanaClient.getTreasuryWallet().toBase58(), treasuryFee);
          if (wt.success) finalGame.winnerPayoutTxSig = wt.txSig;
          if (tt.success) finalGame.treasuryFeeTxSig = tt.txSig;
        }
      } catch (e) {
        console.error("[PAYOUT] Failed:", e);
      }
    }

    // Game history + profile updates
    for (const player of finalGame.players) {
      const isWinner = player.walletAddress === winner.walletAddress;
      await this.addGameHistory(player.walletAddress, {
        gameId: finalGame.id, mode: finalGame.mode, wager: finalGame.wager,
        result: isWinner ? "won" : "lost", payout: isWinner ? payout : undefined,
        wagaEarned: isWinner ? winWagaReward : 0, playedAt: Date.now(),
        godStreakGame: finalGame.godStreakTriggered,
        brokeGodStreak: finalGame.breakerPlayerId === player.walletAddress && isWinner,
      });

      const p = await this.getProfile(player.walletAddress);
      if (p) {
        const newPlayed = p.gamesPlayed + 1;
        const newWon = isWinner ? p.gamesWon + 1 : p.gamesWon;
        await this.updateProfile(player.walletAddress, {
          gamesPlayed: newPlayed, gamesWon: newWon,
          totalWagered: p.totalWagered + finalGame.wager,
          totalWon: isWinner ? p.totalWon + payout : p.totalWon,
          wagaVestingTotal: isWinner ? (p.wagaVestingTotal || 0) + winWagaReward : p.wagaVestingTotal,
          currentStreak: isWinner ? p.currentStreak + 1 : 0,
          bestStreak: isWinner ? Math.max(p.bestStreak, p.currentStreak + 1) : p.bestStreak,
          luckScore: this.calculateLuckScore(newWon, newPlayed),
          lastPlayedAt: Date.now(), isStreakBreakerActive: false,
        });
      }
    }

    this.games.set(gameId, finalGame);
    await pool.query("UPDATE games SET data=$2, status='completed', completed_at=$3 WHERE id=$1", [gameId, JSON.stringify(finalGame), finalGame.completedAt]);
    console.log(`[GAME] ${gameId} complete. Winner: ${winner.walletAddress.slice(0, 6)}... Payout: ${payout.toFixed(4)} SOL`);
  }
}
