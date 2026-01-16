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
} from "@shared/schema";

export interface IStorage {
  getProfile(walletAddress: string): Promise<PlayerProfile | undefined>;
  createProfile(data: { walletAddress: string; displayName?: string }): Promise<PlayerProfile>;
  updateProfile(walletAddress: string, updates: Partial<PlayerProfile>): Promise<PlayerProfile | undefined>;
  getOrCreateProfile(walletAddress: string): Promise<PlayerProfile>;
  checkUsernameUnique(username: string): Promise<boolean>;
  getChatMessages(gameId: string): Promise<ChatMessage[]>;
  addChatMessage(data: ChatMessage): Promise<ChatMessage>;
  getGameHistory(walletAddress: string, limit: number): Promise<GameHistory[]>;
  addGameHistory(walletAddress: string, history: GameHistory): Promise<void>;
  getGame(id: string): Promise<Game | undefined>;
  getLiveGames(): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game | undefined>;
  findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined>;
  joinGame(gameId: string, walletAddress: string): Promise<Game | undefined>;
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
      const referrer = this.profiles.get(updates.referredBy);
      if (referrer) {
        referrer.wagaEarned += 100;
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        this.profiles.set(updates.referredBy, referrer);
        updates.wagaEarned = (profile.wagaEarned || 0) + 100;
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
    
    const newGame: Game = {
      id,
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

  async joinGame(gameId: string, walletAddress: string): Promise<Game | undefined> {
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
    };

    game.players.push(player);
    game.poolAmount += game.wager;

    if (game.players.length >= config.players) {
      game.status = "countdown";
      game.countdownEndsAt = Date.now() + 10000;

      setTimeout(() => {
        this.startGame(gameId);
      }, 10000);
    }

    this.games.set(gameId, game);
    return game;
  }

  private async startGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "countdown") return;

    game.status = "in_progress";
    game.startedAt = Date.now();

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
    let remainingPlayers = [...game.players];

    for (let round = 1; round <= config.rounds; round++) {
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));

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

      this.games.set(gameId, currentGame);

      if (remainingPlayers.length === 1) {
        break;
      }
    }

    const finalGame = this.games.get(gameId);
    if (!finalGame) return;

    const winner = remainingPlayers[0];
    const payout = finalGame.poolAmount * 0.9;

    finalGame.status = "completed";
    finalGame.completedAt = Date.now();
    finalGame.winnerId = winner.id;
    finalGame.winnerPayout = payout;
    finalGame.wagaRewards = payout * 100;

    this.games.set(gameId, finalGame);

    for (const player of finalGame.players) {
      const isWinner = player.id === winner.id;
      await this.addGameHistory(player.walletAddress, {
        gameId: finalGame.id,
        mode: finalGame.mode,
        wager: finalGame.wager,
        result: isWinner ? "won" : "lost",
        payout: isWinner ? payout : undefined,
        wagaEarned: isWinner ? payout * 100 : finalGame.wager * 10,
        playedAt: Date.now(),
      });

      const profile = await this.getProfile(player.walletAddress);
      if (profile) {
        await this.updateProfile(player.walletAddress, {
          gamesPlayed: profile.gamesPlayed + 1,
          gamesWon: profile.gamesWon + (isWinner ? 1 : 0),
          totalWagered: profile.totalWagered + finalGame.wager,
          totalWon: profile.totalWon + (isWinner ? payout : 0),
          wagaEarned: profile.wagaEarned + (isWinner ? payout * 100 : finalGame.wager * 10),
          currentStreak: isWinner ? profile.currentStreak + 1 : 0,
          bestStreak: isWinner
            ? Math.max(profile.bestStreak, profile.currentStreak + 1)
            : profile.bestStreak,
        });
      }
    }
  }
}

export const storage = new MemStorage();
