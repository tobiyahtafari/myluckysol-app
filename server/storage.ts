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
  WAGA_ENTRY_MULTIPLIER,
  WAGA_WIN_MULTIPLIER,
} from "@shared/schema";

export interface IStorage {
  getProfile(walletAddress: string): Promise<PlayerProfile | undefined>;
  getProfileByUsername(username: string): Promise<PlayerProfile | undefined>;
  getProfileByUsernameOrWallet(identifier: string): Promise<PlayerProfile | undefined>;
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
  updateGameStatus(id: string, status: string): Promise<Game | undefined>;
  findAvailableGame(mode: GameModeKey, wager: WagerTier): Promise<Game | undefined>;
  joinGame(gameId: string, walletAddress: string, txSignature?: string): Promise<Game | undefined>;
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

  async updateGameStatus(id: string, status: string): Promise<Game | undefined> {
    const game = this.games.get(id);
    if (!game) return undefined;
    game.status = status as Game["status"];
    
    if (status === "countdown") {
      game.countdownEndsAt = Date.now() + 10000;
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

    const entryWagaReward = game.wager * WAGA_ENTRY_MULTIPLIER;
    const profile = await this.getOrCreateProfile(walletAddress);
    await this.updateProfile(walletAddress, {
      wagaEarned: (profile.wagaEarned || 0) + entryWagaReward,
    });
    
    console.log(`[DEVNET] Player ${walletAddress.slice(0, 8)}... joined game ${gameId} with ${game.wager} SOL wager. Earned ${entryWagaReward} WAGA entry reward.`);

    this.games.set(gameId, game);
    return game;
  }

  private async startGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || game.status !== "countdown") return;

    const config = GAME_MODES[game.mode];
    const roundDuration = config.timer * 1000;

    game.status = "in_progress";
    game.startedAt = Date.now();
    game.roundEndsAt = Date.now() + roundDuration;

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
        currentGame.roundEndsAt = Date.now() + roundDuration;
      }

      this.games.set(gameId, currentGame);

      if (remainingPlayers.length === 1) {
        break;
      }
    }

    const finalGame = this.games.get(gameId);
    if (!finalGame) return;

    const winner = remainingPlayers[0];
    const payout = finalGame.poolAmount * 0.9;
    const winWagaReward = payout * WAGA_WIN_MULTIPLIER;

    finalGame.status = "completed";
    finalGame.completedAt = Date.now();
    finalGame.winnerId = winner.id;
    finalGame.winnerPayout = payout;
    finalGame.wagaRewards = winWagaReward;

    this.games.set(gameId, finalGame);

    console.log(`[DEVNET] Game ${gameId} completed. Winner: ${winner.walletAddress.slice(0, 8)}... won ${payout.toFixed(4)} SOL and ${winWagaReward} WAGA`);

    // In a production app, the backend (or a dedicated worker) would execute the payout instruction
    // on the Solana program. For this hybrid version, we'll log it as a pending on-chain action.
    console.log(`[ON-CHAIN] Payout of ${payout.toFixed(4)} SOL pending for ${winner.walletAddress}`);
    console.log(`[ON-CHAIN] Escrow (Treasury) to Winner: ${payout.toFixed(4)} SOL`);
    console.log(`[ON-CHAIN] Escrow (Treasury) to Foundation Fee: ${(finalGame.poolAmount * 0.1).toFixed(4)} SOL`);

    for (const player of finalGame.players) {
      const isWinner = player.id === winner.id;
      const entryWagaReward = finalGame.wager * WAGA_ENTRY_MULTIPLIER;
      const gameWagaEarned = isWinner ? winWagaReward : entryWagaReward;
      
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
        const wagaUpdate = isWinner ? winWagaReward : 0;
        
        await this.updateProfile(player.walletAddress, {
          gamesPlayed: profile.gamesPlayed + 1,
          gamesWon: profile.gamesWon + (isWinner ? 1 : 0),
          totalWagered: profile.totalWagered + finalGame.wager,
          totalWon: profile.totalWon + (isWinner ? payout : 0),
          wagaEarned: profile.wagaEarned + wagaUpdate,
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
