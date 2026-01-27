import {
  users,
  type PlayerProfile,
  type Game,
  type InsertGame,
  type GameHistory,
  type ChatMessage,
  type GameModeKey,
  type WagerTier,
  GAME_MODES,
  WAGA_ENTRY_REWARD_PERCENT,
  WAGA_WINNER_REWARD_PERCENT,
  WINNER_SHARE,
  VESTING_DAILY_PERCENT,
  VESTING_PERIOD_MS,
} from "@shared/schema";
import { calculateWagaReward, getSolPrice, getWagaPrice } from "./price-service";
import { solanaClient } from "./solana-client";

import type { LeaderboardEntry } from "@shared/schema";

export interface IStorage {
  getProfile(walletAddress: string): Promise<PlayerProfile | undefined>;
  getProfileByUsername(username: string): Promise<PlayerProfile | undefined>;
  getProfileByUsernameOrWallet(identifier: string): Promise<PlayerProfile | undefined>;
  createProfile(data: { walletAddress: string; displayName?: string }): Promise<PlayerProfile>;
  updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined>;
  getOrCreateProfile(walletAddress: string): Promise<PlayerProfile>;
  checkUsernameUnique(username: string): Promise<boolean>;
  claimVestedWaga(walletAddress: string): Promise<{ claimedAmount: number; remainingVesting: number; nextClaimTime: number } | null>;
  getChatMessages(gameId: string): Promise<ChatMessage[]>;
  addChatMessage(data: ChatMessage): Promise<ChatMessage>;
  getGameHistory(walletAddress: string, limit: number): Promise<GameHistory[]>;
  addGameHistory(walletAddress: string, history: GameHistory): Promise<void>;
  getGame(id: string): Promise<Game | undefined>;
  getLiveGames(): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined>;
  updateGameStatus(id: string, status: string): Promise<Game | undefined>;
  findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined>;
  joinGame(gameId: string, walletAddress: string, txSignature?: string): Promise<Game | undefined>;
  getLeaderboard(sortBy: "earnings" | "luck" | "streaks", limit?: number): Promise<LeaderboardEntry[]>;
}

export class MemStorage implements IStorage {
  private profiles: Map<string, PlayerProfile>;
  private games: Map<string, Game>;
  private chatMessages: Map<string, ChatMessage[]>;
  private gameHistory: Map<string, GameHistory[]>;

  constructor() {
    this.profiles = new Map();
    this.games = new Map();
    this.chatMessages = new Map();
    this.gameHistory = new Map();
  }

  async getProfile(walletAddress: string): Promise<PlayerProfile | undefined> {
    return this.profiles.get(walletAddress);
  }

  async getProfileByUsername(username: string): Promise<PlayerProfile | undefined> {
    const profiles = Array.from(this.profiles.values());
    return profiles.find(p => p.username?.toLowerCase() === username.toLowerCase());
  }

  async getProfileByUsernameOrWallet(identifier: string): Promise<PlayerProfile | undefined> {
    const byWallet = this.profiles.get(identifier);
    if (byWallet) return byWallet;
    return this.getProfileByUsername(identifier);
  }

  async createProfile(data: { walletAddress: string; displayName?: string }): Promise<PlayerProfile> {
    const profile: PlayerProfile = {
      walletAddress: data.walletAddress,
      displayName: data.displayName || "",
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
      createdAt: Date.now(),
    };
    this.profiles.set(data.walletAddress, profile);
    return profile;
  }

  async updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined> {
    const profile = this.profiles.get(walletAddress);
    if (!profile) return undefined;
    
    if (updates.referredBy && !profile.referredBy && updates.referredBy !== walletAddress) {
      const referrer = await this.getProfileByUsernameOrWallet(updates.referredBy);
      if (referrer && referrer.walletAddress !== walletAddress) {
        referrer.wagaEarned += 100;
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        this.profiles.set(referrer.walletAddress, referrer);
        updates.wagaEarned = (profile.wagaEarned || 0) + 100;
        updates.referredBy = referrer.walletAddress;
      } else if (!referrer) {
        delete updates.referredBy;
      }
    }

    const updated = { ...profile, ...updates };
    this.profiles.set(walletAddress, updated);
    return updated;
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

  async claimVestedWaga(walletAddress: string): Promise<{ claimedAmount: number; remainingVesting: number; nextClaimTime: number } | null> {
    const profile = this.profiles.get(walletAddress);
    if (!profile) return null;

    const now = Date.now();
    const lastClaim = profile.wagaVestingLastClaim || 0;
    const timeSinceLastClaim = now - lastClaim;

    // Check if 24 hours have passed since last claim
    if (lastClaim > 0 && timeSinceLastClaim < VESTING_PERIOD_MS) {
      const nextClaimTime = lastClaim + VESTING_PERIOD_MS;
      return {
        claimedAmount: 0,
        remainingVesting: (profile.wagaVestingTotal || 0) - (profile.wagaVestingClaimed || 0),
        nextClaimTime,
      };
    }

    const totalVesting = profile.wagaVestingTotal || 0;
    const alreadyClaimed = profile.wagaVestingClaimed || 0;
    const remainingVesting = totalVesting - alreadyClaimed;

    if (remainingVesting <= 0) {
      return {
        claimedAmount: 0,
        remainingVesting: 0,
        nextClaimTime: 0,
      };
    }

    // Calculate 10% of total vesting (not remaining) per day
    const dailyAmount = Math.floor(totalVesting * (VESTING_DAILY_PERCENT / 100));
    const claimAmount = Math.min(dailyAmount, remainingVesting);

    // Update profile
    profile.wagaVestingClaimed = alreadyClaimed + claimAmount;
    profile.wagaVestingLastClaim = now;
    profile.wagaEarned = (profile.wagaEarned || 0) + claimAmount;
    this.profiles.set(walletAddress, profile);

    console.log(`[VESTING] ${walletAddress.slice(0, 8)}... claimed ${claimAmount} WAGA (${VESTING_DAILY_PERCENT}% of ${totalVesting})`);
    console.log(`[VESTING] Remaining: ${remainingVesting - claimAmount} WAGA`);

    return {
      claimedAmount: claimAmount,
      remainingVesting: remainingVesting - claimAmount,
      nextClaimTime: now + VESTING_PERIOD_MS,
    };
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
    
    // Generate unique on-chain game ID
    const onChainGameId = BigInt(Date.now());
    const [escrowPDA] = solanaClient.getGamePoolPDA(onChainGameId);
    
    const newGame: Game = {
      id,
      onChainGameId: onChainGameId.toString(),
      escrowPDA: escrowPDA.toBase58(),
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
    console.log(`[ON-CHAIN] Escrow PDA: ${escrowPDA.toBase58()}`);
    
    // Initialize game on-chain (creates game and escrow PDAs) - only if program is deployed
    if (solanaClient.isOnChainEnabled()) {
      const programDeployed = await solanaClient.isProgramDeployed();
      if (programDeployed) {
        const result = await solanaClient.createGameOnChain(onChainGameId, game.mode, game.wager);
        if (result.success) {
          console.log(`[ON-CHAIN] Game initialized on-chain: ${result.signature}`);
        } else {
          console.warn(`[ON-CHAIN] On-chain game creation failed: ${result.error}`);
        }
      } else {
        console.log(`[FALLBACK] Program not deployed, skipping on-chain game creation`);
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

    const player = {
      id: `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      walletAddress,
      joinedAt: Date.now(),
      isEliminated: false,
      txSignature,
    };

    game.players.push(player);
    game.poolAmount += game.wager;

    // Calculate WAGA entry reward based on wager tier and USD value
    const rewardPercent = WAGA_ENTRY_REWARD_PERCENT[game.wager as WagerTier] || 50;
    const entryWagaReward = await calculateWagaReward(game.wager, rewardPercent);
    
    const profile = await this.getOrCreateProfile(walletAddress);
    await this.updateProfile(walletAddress, {
      wagaEarned: (profile.wagaEarned || 0) + entryWagaReward,
    });
    
    const solPrice = await getSolPrice();
    const wagaPrice = getWagaPrice();
    const usdValue = game.wager * solPrice;
    console.log(`[DEVNET] Player ${walletAddress.slice(0, 8)}... joined game ${gameId} with ${game.wager} SOL wager ($${usdValue.toFixed(2)} USD).`);
    console.log(`[DEVNET] Entry WAGA Reward: ${entryWagaReward} WAGA (${rewardPercent}% of $${usdValue.toFixed(2)} = $${(usdValue * rewardPercent / 100).toFixed(2)} worth at $${wagaPrice}/WAGA)`);

    // Transfer WAGA entry reward on-chain immediately
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

  async getLeaderboard(sortBy: "earnings" | "luck" | "streaks", limit: number = 50): Promise<LeaderboardEntry[]> {
    const profiles = Array.from(this.profiles.values());
    
    // Only include players who have played at least 1 game
    const activePlayers = profiles.filter(p => p.gamesPlayed > 0);
    
    // Sort based on criteria
    let sorted: PlayerProfile[];
    switch (sortBy) {
      case "earnings":
        sorted = activePlayers.sort((a, b) => b.totalWon - a.totalWon);
        break;
      case "luck":
        sorted = activePlayers.sort((a, b) => b.luckScore - a.luckScore);
        break;
      case "streaks":
        sorted = activePlayers.sort((a, b) => b.bestStreak - a.bestStreak);
        break;
      default:
        sorted = activePlayers.sort((a, b) => b.totalWon - a.totalWon);
    }
    
    // Take top N and convert to leaderboard entries (matching shared schema)
    return sorted.slice(0, limit).map((profile, index): LeaderboardEntry => ({
      rank: index + 1,
      walletAddress: profile.walletAddress,
      displayName: profile.username || profile.displayName,
      totalWon: profile.totalWon,
      gamesWon: profile.gamesWon,
      winRate: profile.gamesPlayed > 0 ? (profile.gamesWon / profile.gamesPlayed) * 100 : 0,
      luckScore: profile.luckScore,
      bestStreak: profile.bestStreak,
    }));
  }

  // Calculate luck score based on actual win rate vs expected win rate
  // Returns a value 0-100 where 50 is average luck
  private calculateLuckScore(gamesWon: number, gamesPlayed: number): number {
    if (gamesPlayed < 3) {
      // Not enough games to calculate meaningful luck score
      return 50;
    }
    
    // Assuming average expected win rate across all game modes is ~35%
    // (mix of 50% for 1v1, 25% for 4-player, 12.5% for 8-player, 6.25% for 16-player)
    const expectedWinRate = 0.35;
    const actualWinRate = gamesWon / gamesPlayed;
    
    // Calculate luck factor: how much better/worse than expected
    // If actualWinRate = expectedWinRate, luck = 50
    // If actualWinRate = 100%, luck approaches 100
    // If actualWinRate = 0%, luck approaches 0
    const luckFactor = actualWinRate / expectedWinRate;
    
    // Convert to 0-100 scale with 50 as center
    // Using a sigmoid-like transformation to cap extremes
    let luckScore: number;
    if (luckFactor >= 1) {
      // Above average luck (50-100 range)
      luckScore = 50 + (50 * Math.min(1, (luckFactor - 1) / 1.5));
    } else {
      // Below average luck (0-50 range)
      luckScore = 50 * luckFactor;
    }
    
    // Add some variance based on streaks - hot streaks boost luck perception
    // This is capped to prevent extreme swings
    return Math.round(Math.max(0, Math.min(100, luckScore)));
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

    const config = GAME_MODES[game.mode];
    const roundDuration = config.timer * 1000;
    let remainingPlayers = [...game.players];

    for (let round = 1; round <= config.rounds; round++) {
      await new Promise((r) => setTimeout(r, roundDuration));

      const currentGame = this.games.get(gameId);
      if (!currentGame || currentGame.status === "completed") return;

      const halfSize = Math.ceil(remainingPlayers.length / 2);
      const winners: typeof remainingPlayers = [];
      const losers: typeof remainingPlayers = [];

      for (let i = 0; i < remainingPlayers.length; i += 2) {
        if (i + 1 < remainingPlayers.length) {
          const winner = Math.random() > 0.5 ? remainingPlayers[i] : remainingPlayers[i + 1];
          const loser = winner === remainingPlayers[i] ? remainingPlayers[i + 1] : remainingPlayers[i];
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
    const payout = finalGame.poolAmount * WINNER_SHARE; // 90% to winner
    const treasuryFee = finalGame.poolAmount * (1 - WINNER_SHARE); // 10% to treasury
    
    // Winner gets 100% USD value match of SOL winnings in WAGA
    const winWagaReward = await calculateWagaReward(payout, WAGA_WINNER_REWARD_PERCENT);

    finalGame.status = "completed";
    finalGame.completedAt = Date.now();
    finalGame.winnerId = winner.id;
    finalGame.winnerPayout = payout;
    finalGame.wagaRewards = winWagaReward;

    this.games.set(gameId, finalGame);

    const solPrice = await getSolPrice();
    const wagaPrice = getWagaPrice();
    const payoutUsd = payout * solPrice;
    
    console.log(`[DEVNET] Game ${gameId} completed. Winner: ${winner.walletAddress.slice(0, 8)}...`);
    console.log(`[DEVNET] Winner Payout: ${payout.toFixed(4)} SOL ($${payoutUsd.toFixed(2)} USD)`);
    console.log(`[DEVNET] Winner WAGA Reward: ${winWagaReward} WAGA (100% of $${payoutUsd.toFixed(2)} at $${wagaPrice}/WAGA)`);
    console.log(`[DEVNET] Treasury Fee: ${treasuryFee.toFixed(4)} SOL`);

    // Execute on-chain payout if authority key is configured
    if (solanaClient.isOnChainEnabled() && finalGame.onChainGameId && finalGame.escrowPDA) {
      try {
        console.log(`[ON-CHAIN] Executing payout for game ${finalGame.onChainGameId}...`);
        const payoutResult = await solanaClient.executePayouts(
          BigInt(finalGame.onChainGameId),
          winner.walletAddress,
          payout,
          treasuryFee
        );
        
        if (payoutResult.success) {
          finalGame.winnerPayoutTxSig = payoutResult.winnerTxSig;
          finalGame.treasuryFeeTxSig = payoutResult.treasuryTxSig;
          console.log(`[ON-CHAIN] Winner payout: ${payoutResult.winnerTxSig?.slice(0, 20)}...`);
          console.log(`[ON-CHAIN] Treasury fee: ${payoutResult.treasuryTxSig?.slice(0, 20)}...`);
          this.games.set(gameId, finalGame);
        }
      } catch (payoutError) {
        console.error(`[ON-CHAIN] Payout execution failed:`, payoutError);
      }
    } else {
      // Log as pending on-chain action when authority key is not configured
      console.log(`[ON-CHAIN] Payout of ${payout.toFixed(4)} SOL pending for ${winner.walletAddress}`);
      console.log(`[ON-CHAIN] Escrow to Winner: ${payout.toFixed(4)} SOL (requires authority key)`);
      console.log(`[ON-CHAIN] Escrow to Foundation: ${treasuryFee.toFixed(4)} SOL (requires authority key)`);
    }

    for (const player of finalGame.players) {
      const isWinner = player.id === winner.id;
      // Entry WAGA rewards already given at join time, winner gets vested WAGA
      const gameWagaEarned = isWinner ? winWagaReward : 0;
      
      await this.addGameHistory(player.walletAddress, {
        gameId: finalGame.id,
        mode: finalGame.mode,
        wager: finalGame.wager,
        result: isWinner ? "won" : "lost",
        payout: isWinner ? payout : undefined,
        wagaEarned: gameWagaEarned,
        playedAt: Date.now(),
      });

      const profile = await this.getProfile(player.walletAddress);
      if (profile) {
        // Winner WAGA rewards go to vesting, NOT direct to wagaEarned
        // This prevents market dumping by releasing 10% daily
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
          });
          console.log(`[VESTING] Added ${winWagaReward} WAGA to vesting for winner ${player.walletAddress.slice(0, 8)}...`);
          console.log(`[LUCK] Updated luck score for ${player.walletAddress.slice(0, 8)}...: ${newLuckScore}`);
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
          });
        }
      }
    }
  }
}

export const storage = new MemStorage();
