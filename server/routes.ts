import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GAME_MODES, WAGER_TIERS, insertGameSchema } from "@shared/schema";
import type { GameModeKey, WagerTier } from "@shared/schema";
import { z } from "zod";

const joinGameSchema = z.object({
  mode: z.enum(["1v1", "2-round", "3-round", "4-round"]),
  wager: z.number().refine((w) => WAGER_TIERS.includes(w as WagerTier), {
    message: "Invalid wager amount",
  }),
  walletAddress: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Join or create a game
  app.post("/api/games/join", async (req, res) => {
    try {
      const body = joinGameSchema.parse(req.body);
      const mode = body.mode as GameModeKey;
      const wager = body.wager as WagerTier;
      
      // Generate a mock wallet address for demo purposes
      const walletAddress = body.walletAddress || generateMockAddress();

      // Try to find an existing game to join
      let game = await storage.findAvailableGame(mode, wager);

      if (!game) {
        // Create a new game
        game = await storage.createGame({ mode, wager });
      }

      // Join the game
      const updatedGame = await storage.joinGame(game.id, walletAddress);

      if (!updatedGame) {
        return res.status(400).json({ error: "Failed to join game" });
      }

      // Auto-fill remaining slots with bots for demo
      const config = GAME_MODES[mode];
      const slotsToFill = config.players - updatedGame.players.length;
      
      if (slotsToFill > 0) {
        // Add bot players after a short delay
        setTimeout(async () => {
          let currentGame = await storage.getGame(updatedGame.id);
          if (!currentGame || currentGame.status !== "waiting") return;

          for (let i = 0; i < slotsToFill; i++) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
            currentGame = await storage.getGame(updatedGame.id);
            if (!currentGame || currentGame.status !== "waiting") break;
            
            await storage.joinGame(currentGame.id, generateMockAddress());
          }
        }, 1000);
      }

      res.json({ gameId: updatedGame.id, game: updatedGame });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error joining game:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get live games (must come before /api/games/:id)
  app.get("/api/games/live", async (req, res) => {
    try {
      const games = await storage.getLiveGames();
      res.json(games);
    } catch (error) {
      console.error("Error getting live games:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get game by ID
  app.get("/api/games/:id", async (req, res) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      console.error("Error getting game:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get player profile
  app.get("/api/profile/:walletAddress", async (req, res) => {
    try {
      const profile = await storage.getOrCreateProfile(req.params.walletAddress);
      res.json(profile);
    } catch (error) {
      console.error("Error getting profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get player game history
  app.get("/api/profile/:walletAddress/history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await storage.getGameHistory(req.params.walletAddress, limit);
      res.json(history);
    } catch (error) {
      console.error("Error getting history:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update profile (including username and referral)
  app.patch("/api/profile/:walletAddress", async (req, res) => {
    try {
      const { username, avatarUrl, referredBy } = req.body;
      const profile = await storage.getProfile(req.params.walletAddress);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (username) {
        // Rule: username once per 72 hours
        const lastUpdate = profile.usernameUpdatedAt || 0;
        const now = Date.now();
        const seventyTwoHours = 72 * 60 * 60 * 1000;
        
        if (now - lastUpdate < seventyTwoHours && profile.username) {
          return res.status(400).json({ error: "Username can only be changed once every 72 hours" });
        }

        const isUnique = await storage.checkUsernameUnique(username);
        if (!isUnique && username !== profile.username) {
          return res.status(400).json({ error: "Username already taken" });
        }
        req.body.usernameUpdatedAt = now;
      }

      const updated = await storage.updateProfile(req.params.walletAddress, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get chat messages
  app.get("/api/games/:id/chat", async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Post chat message
  app.post("/api/games/:id/chat", async (req, res) => {
    try {
      const message = await storage.addChatMessage({
        ...req.body,
        gameId: req.params.id,
      });
      res.json(message);
    } catch (error) {
      console.error("Error adding chat message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}

function generateMockAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let address = "";
  for (let i = 0; i < 44; i++) {
    address += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return address;
}
