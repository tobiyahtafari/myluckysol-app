import { randomUUID } from "crypto";
import type {
  Game,
  InsertGame,
  Player,
  PlayerProfile,
  InsertPlayerProfile,
  LeaderboardEntry,
  GameHistory,
  GameModeKey,
  WagerTier,
  ChatMessage,
  InsertChatMessage,
} from "@shared/schema";
import { GAME_MODES, WINNER_SHARE, WAGA_ENTRY_MULTIPLIER, WAGA_WIN_MULTIPLIER } from "@shared/schema";

export interface IStorage {
  // Games
  createGame(data: InsertGame): Promise<Game>;
  getGame(id: string): Promise<Game | undefined>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined>;
  findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined>;
  joinGame(gameId: string, walletAddress: string): Promise<Game | undefined>;
  getLiveGames(): Promise<Game[]>;
  
  // Players
  getProfile(walletAddress: string): Promise<PlayerProfile | undefined>;
  createProfile(data: InsertPlayerProfile): Promise<PlayerProfile>;
  updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined>;
  getOrCreateProfile(walletAddress: string): Promise<PlayerProfile>;
  checkUsernameUnique(username: string): Promise<boolean>;
  
  // Leaderboard
  getLeaderboard(sortBy: "totalWon" | "luckScore" | "bestStreak", limit: number): Promise<LeaderboardEntry[]>;
  
  // Game History
  getGameHistory(walletAddress: string, limit: number): Promise<GameHistory[]>;
  addGameHistory(walletAddress: string, history: GameHistory): Promise<void>;

  // Chat
  getChatMessages(gameId: string): Promise<ChatMessage[]>;
  addChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private games: Map<string, Game>;
  private profiles: Map<string, PlayerProfile>;
  private gameHistory: Map<string, GameHistory[]>;
  private chatMessages: Map<string, ChatMessage[]>;

  constructor() {
    this.games = new Map();
    this.profiles = new Map();
    this.gameHistory = new Map();
    this.chatMessages = new Map();
  }

  async createGame(data: InsertGame): Promise<Game> {
    const id = randomUUID();
    const game: Game = {
      id,
      mode: data.mode,
      wager: data.wager,
      status: "waiting",
      players: [],
      rounds: [],
      currentRound: 1,
      poolAmount: 0,
      createdAt: Date.now(),
    };
    this.games.set(id, game);
    return game;
  }

  async getGame(id: string): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    
    const updatedGame = { ...game, ...updates };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined> {
    const config = GAME_MODES[mode];
    
    for (const game of this.games.values()) {
      if (
        game.mode === mode &&
        game.wager === wager &&
        game.status === "waiting" &&
        game.players.length < config.players
      ) {
        return game;
      }
    }
    return undefined;
  }

  async joinGame(gameId: string, walletAddress: string): Promise<Game | undefined> {
    const game = await this.getGame(gameId);
    if (!game) return undefined;

    const config = GAME_MODES[game.mode];
    
    // Check if player already joined
    if (game.players.some(p => p.walletAddress === walletAddress)) {
      return game;
    }

    // Check if game is full
    if (game.players.length >= config.players) {
      return undefined;
    }

    const player: Player = {
      id: randomUUID(),
      walletAddress,
      joinedAt: Date.now(),
      isEliminated: false,
    };

    const updatedPlayers = [...game.players, player];
    const poolAmount = game.poolAmount + game.wager;
    
    let status = game.status;
    let countdownEndsAt = game.countdownEndsAt;

    // If game is now full, start countdown
    if (updatedPlayers.length === config.players) {
      status = "countdown";
      countdownEndsAt = Date.now() + config.timer * 1000;
      
      // Schedule game resolution
      setTimeout(() => this.resolveGame(gameId), config.timer * 1000);
    }

    return this.updateGame(gameId, {
      players: updatedPlayers,
      poolAmount,
      status,
      countdownEndsAt,
    });
  }

  private async resolveGame(gameId: string): Promise<void> {
    const game = await this.getGame(gameId);
    if (!game || game.status === "completed") return;

    await this.updateGame(gameId, { status: "resolving" });

    // Simulate VRF delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const config = GAME_MODES[game.mode];
    let currentGame = await this.getGame(gameId);
    if (!currentGame) return;

    // Process each round
    let remainingPlayers = [...currentGame.players];
    const rounds = [];

    for (let roundNum = 1; roundNum <= config.rounds; roundNum++) {
      // Select random winner for this round
      const winnerIndex = Math.floor(Math.random() * remainingPlayers.length);
      const roundWinner = remainingPlayers[winnerIndex];
      
      rounds.push({
        roundNumber: roundNum,
        players: remainingPlayers.map(p => p.id),
        winnerId: roundWinner.id,
        vrfSeed: randomUUID(),
        resolvedAt: Date.now(),
      });

      // Each round eliminates half the players - winner of each matchup advances
      if (roundNum < config.rounds) {
        // In tournament bracket style: pair players and determine winners
        const nextRoundPlayers: Player[] = [];
        const shuffled = [...remainingPlayers].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < shuffled.length; i += 2) {
          // Each pair has a winner determined by VRF-like randomness
          const winner = Math.random() < 0.5 ? shuffled[i] : shuffled[i + 1];
          nextRoundPlayers.push(winner);
        }
        
        // Mark eliminated players
        currentGame = await this.getGame(gameId);
        if (!currentGame) return;
        
        const updatedPlayers = currentGame.players.map(p => ({
          ...p,
          isEliminated: !nextRoundPlayers.some(w => w.id === p.id),
          eliminatedRound: !nextRoundPlayers.some(w => w.id === p.id) && !p.isEliminated ? roundNum : p.eliminatedRound,
        }));
        
        await this.updateGame(gameId, { players: updatedPlayers, currentRound: roundNum + 1 });
        remainingPlayers = nextRoundPlayers;
        
        // Add delay between rounds for visual effect
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final winner is the last remaining player
    const finalWinner = remainingPlayers[0];
    const winnerPayout = currentGame.poolAmount * WINNER_SHARE;
    // Total WAGA for display: entry reward (for winner) + win bonus based on actual payout
    const wagaRewards = (currentGame.wager * WAGA_ENTRY_MULTIPLIER) + (winnerPayout * WAGA_WIN_MULTIPLIER);

    await this.updateGame(gameId, {
      status: "completed",
      rounds,
      winnerId: finalWinner.id,
      winnerPayout,
      wagaRewards,
      completedAt: Date.now(),
    });

    // Update player profiles
    const finalGame = await this.getGame(gameId);
    if (!finalGame) return;

    for (const player of finalGame.players) {
      const profile = await this.getOrCreateProfile(player.walletAddress);
      const isWinner = player.id === finalWinner.id;
      
      // Entry reward: 10 × SOL wager (everyone gets this)
      // Win bonus: 100 × SOL actually won (winner only)
      const entryReward = finalGame.wager * WAGA_ENTRY_MULTIPLIER;
      const winBonus = isWinner ? winnerPayout * WAGA_WIN_MULTIPLIER : 0;
      const wagaEarned = entryReward + winBonus;

      const updates: Partial<PlayerProfile> = {
        gamesPlayed: profile.gamesPlayed + 1,
        gamesWon: isWinner ? profile.gamesWon + 1 : profile.gamesWon,
        totalWagered: profile.totalWagered + finalGame.wager,
        totalWon: isWinner ? profile.totalWon + winnerPayout : profile.totalWon,
        wagaEarned: profile.wagaEarned + wagaEarned,
        currentStreak: isWinner ? profile.currentStreak + 1 : 0,
        bestStreak: isWinner 
          ? Math.max(profile.bestStreak, profile.currentStreak + 1) 
          : profile.bestStreak,
        lastPlayedAt: Date.now(),
      };

      // Recalculate luck score
      const newGamesPlayed = updates.gamesPlayed!;
      const newGamesWon = updates.gamesWon!;
      const winRate = newGamesPlayed > 0 ? (newGamesWon / newGamesPlayed) * 100 : 50;
      const streakBonus = Math.min(updates.currentStreak! * 2, 20);
      const profitRatio = updates.totalWagered! > 0 
        ? (updates.totalWon! / updates.totalWagered!) * 100 
        : 100;
      
      updates.luckScore = Math.min(100, Math.max(0, 
        (winRate * 0.4) + (profitRatio * 0.3) + (streakBonus) + 20
      ));

      await this.updateProfile(player.walletAddress, updates);

      // Add to game history
      await this.addGameHistory(player.walletAddress, {
        gameId: finalGame.id,
        mode: finalGame.mode,
        wager: finalGame.wager,
        result: isWinner ? "won" : "lost",
        payout: isWinner ? winnerPayout : undefined,
        wagaEarned,
        playedAt: Date.now(),
      });
    }
  }

  async getProfile(walletAddress: string): Promise<PlayerProfile | undefined> {
    return this.profiles.get(walletAddress);
  }

  async createProfile(data: InsertPlayerProfile): Promise<PlayerProfile> {
    const profile: PlayerProfile = {
      walletAddress: data.walletAddress,
      displayName: data.displayName,
      gamesPlayed: 0,
      gamesWon: 0,
      totalWagered: 0,
      totalWon: 0,
      wagaEarned: 0,
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

  async getLeaderboard(sortBy: "totalWon" | "luckScore" | "bestStreak", limit: number): Promise<LeaderboardEntry[]> {
    const profiles = Array.from(this.profiles.values());
    
    profiles.sort((a, b) => {
      switch (sortBy) {
        case "totalWon":
          return b.totalWon - a.totalWon;
        case "luckScore":
          return b.luckScore - a.luckScore;
        case "bestStreak":
          return b.bestStreak - a.bestStreak;
        default:
          return 0;
      }
    });

    return profiles.slice(0, limit).map((p, i) => ({
      rank: i + 1,
      walletAddress: p.walletAddress,
      displayName: p.displayName,
      totalWon: p.totalWon,
      gamesWon: p.gamesWon,
      winRate: p.gamesPlayed > 0 ? (p.gamesWon / p.gamesPlayed) * 100 : 0,
      luckScore: p.luckScore,
      bestStreak: p.bestStreak,
    }));
  }

  async getLiveGames(): Promise<Game[]> {
    return Array.from(this.games.values()).filter(g => g.status !== "completed");
  }

  async checkUsernameUnique(username: string): Promise<boolean> {
    const lowercaseUsername = username.toLowerCase();
    for (const profile of this.profiles.values()) {
      if (profile.username?.toLowerCase() === lowercaseUsername) {
        return false;
      }
    }
    return true;
  }

  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(gameId) || [];
  }

  async addChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const message: ChatMessage = {
      ...data,
      id: randomUUID(),
      timestamp: Date.now(),
    };
    const messages = this.chatMessages.get(data.gameId) || [];
    messages.push(message);
    if (messages.length > 100) messages.shift();
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
    if (existing.length > 100) {
      existing.pop();
    }
    this.gameHistory.set(walletAddress, existing);
  }
}

export const storage = new MemStorage();
