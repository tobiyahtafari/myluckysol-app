import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GAME_MODES, WAGER_TIERS, insertGameSchema, WAGA_ENTRY_REWARD_PERCENT, VESTING_PERIOD_MS, VESTING_DAILY_PERCENT, type WagerTier, type GameModeKey } from "@shared/schema";
import { calculateWagaReward, getSolPrice, getWagaPrice } from "./price-service";
import { solanaClient } from "./solana-client";
import { z } from "zod";

const joinGameSchema = z.object({
  mode: z.enum(["1v1", "2-round", "3-round", "4-round"]),
  wager: z.number().refine((w) => WAGER_TIERS.includes(w as WagerTier), {
    message: "Invalid wager amount",
  }),
  walletAddress: z.string().min(32, "Valid wallet address required"),
  gameId: z.string().optional(), // Pre-registered game ID
  txSignature: z.string().optional(),
});

const prepareGameSchema = z.object({
  mode: z.enum(["1v1", "2-round", "3-round", "4-round"]),
  wager: z.number().refine((w) => WAGER_TIERS.includes(w as WagerTier), {
    message: "Invalid wager amount",
  }),
  walletAddress: z.string().min(32, "Valid wallet address required"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Prepare game - returns escrow wallet for SOL transfer (authority wallet)
  app.post("/api/games/prepare", async (req, res) => {
    try {
      const body = prepareGameSchema.parse(req.body);
      const mode = body.mode as GameModeKey;
      const wager = body.wager as WagerTier;
      const walletAddress = body.walletAddress;

      // Validate wallet address format
      if (!walletAddress || walletAddress.length < 32 || walletAddress.length > 44) {
        return res.status(400).json({ error: "Valid Solana wallet address required" });
      }

      // Find or create a game
      let game = await storage.findAvailableGame(mode, wager);
      if (!game) {
        game = await storage.createGame({ mode, wager });
      }

      // Check if player already in this game
      if (game.players.some(p => p.walletAddress === walletAddress)) {
        return res.status(400).json({ error: "Already joined this game", gameId: game.id });
      }

      const config = GAME_MODES[mode];
      
      // Validate that game has on-chain ID (required for escrow)
      if (!game.onChainGameId) {
        console.error(`[ON-CHAIN] Game ${game.id} missing onChainGameId`);
        return res.status(500).json({ error: "Game not properly initialized" });
      }
      
      const { PublicKey } = await import("@solana/web3.js");
      const onChainGameId = BigInt(game.onChainGameId);
      
      // Check if program is deployed - use fallback mode if not
      const programDeployed = await solanaClient.isProgramDeployed();
      
      let escrowAddress: string;
      let serializedTx: string;
      let useFallbackMode = !programDeployed;
      
      if (programDeployed) {
        // Full on-chain mode: use join_game instruction
        const escrowPDA = solanaClient.getGamePoolPDA(onChainGameId)[0].toBase58();
        const { transaction } = await solanaClient.buildJoinGameTransaction(
          onChainGameId,
          new PublicKey(walletAddress)
        );
        serializedTx = transaction.serialize({ 
          requireAllSignatures: false,
          verifySignatures: false 
        }).toString("base64");
        escrowAddress = escrowPDA;
      } else {
        // Fallback mode: direct SOL transfer to authority wallet
        console.log(`[FALLBACK] Program not deployed, using direct transfer mode`);
        const { transaction, escrowAddress: escrow } = await solanaClient.buildFallbackTransferTransaction(
          new PublicKey(walletAddress),
          wager
        );
        serializedTx = transaction.serialize({ 
          requireAllSignatures: false,
          verifySignatures: false 
        }).toString("base64");
        escrowAddress = escrow;
      }

      res.json({
        gameId: game.id,
        escrowPDA: escrowAddress, // Escrow address (PDA or authority wallet)
        onChainGameId: game.onChainGameId,
        wager,
        mode,
        playersNeeded: config.players - game.players.length,
        network: "devnet",
        joinTransaction: serializedTx,
        fallbackMode: useFallbackMode, // Let client know we're in fallback mode
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error preparing game:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Join or create a game (requires real wallet address)
  app.post("/api/games/join", async (req, res) => {
    try {
      const body = joinGameSchema.parse(req.body);
      const mode = body.mode as GameModeKey;
      const wager = body.wager as WagerTier;
      const walletAddress = body.walletAddress;
      const txSignature = body.txSignature;
      const preGameId = body.gameId;

      // Validate wallet address format (Solana base58)
      if (!walletAddress || walletAddress.length < 32 || walletAddress.length > 44) {
        return res.status(400).json({ error: "Valid Solana wallet address required" });
      }

      let game;
      
      // If gameId provided from prepare step, use that game
      if (preGameId) {
        game = await storage.getGame(preGameId);
        if (!game) {
          return res.status(404).json({ error: "Game not found" });
        }
      } else {
        // Fallback: find or create game
        game = await storage.findAvailableGame(mode, wager);
        if (!game) {
          game = await storage.createGame({ mode, wager });
        }
      }

      // Check if player already in this game
      if (game.players.some(p => p.walletAddress === walletAddress)) {
        return res.status(400).json({ error: "Already joined this game" });
      }

      // SECURITY: Verify transaction BEFORE joining - validate amount, sender, and recipient
      let txVerified = false;
      if (!txSignature) {
        console.warn(`[ON-CHAIN] No transaction signature provided for join`);
        return res.status(400).json({ error: "Transaction signature required to join game" });
      }
      
      // Validate that game has on-chain ID (required for escrow)
      if (!game.onChainGameId) {
        console.error(`[ON-CHAIN] Game ${game.id} missing onChainGameId`);
        return res.status(500).json({ error: "Game not properly initialized" });
      }
      
      const onChainGameId = BigInt(game.onChainGameId);
      
      // First verify the transaction is confirmed
      const verification = await solanaClient.verifyTransaction(txSignature);
      if (!verification.confirmed) {
        console.warn(`[ON-CHAIN] Transaction not confirmed: ${verification.error}`);
        return res.status(400).json({ error: "Transaction not confirmed" });
      }
      
      // Check if program is deployed - use appropriate validation
      const programDeployed = await solanaClient.isProgramDeployed();
      
      if (programDeployed) {
        // Full on-chain mode: validate join_game instruction + wager transfer
        const escrowPDA = solanaClient.getGamePoolPDA(onChainGameId)[0].toBase58();
        
        const joinValidation = await solanaClient.validateJoinGameInstruction(
          txSignature,
          walletAddress,
          onChainGameId
        );
        
        if (!joinValidation.valid) {
          console.warn(`[ON-CHAIN] Join instruction validation failed: ${joinValidation.error}`);
          return res.status(400).json({ 
            error: `Transaction validation failed: ${joinValidation.error}` 
          });
        }
        
        const transferValidation = await solanaClient.validateTransfer(
          txSignature,
          walletAddress,
          escrowPDA,
          wager
        );
        
        if (!transferValidation.valid) {
          console.warn(`[ON-CHAIN] Wager amount validation failed: ${transferValidation.error}`);
          return res.status(400).json({ 
            error: `Wager validation failed: ${transferValidation.error}` 
          });
        }
        
        console.log(`[ON-CHAIN] Join instruction + wager validated for game ${onChainGameId}`);
      } else {
        // Fallback mode: validate direct SOL transfer to authority wallet
        const authorityAddress = solanaClient.getAuthorityAddress();
        if (!authorityAddress) {
          return res.status(500).json({ error: "Authority wallet not configured" });
        }
        
        const transferValidation = await solanaClient.validateTransfer(
          txSignature,
          walletAddress,
          authorityAddress,
          wager
        );
        
        if (!transferValidation.valid) {
          console.warn(`[FALLBACK] Transfer validation failed: ${transferValidation.error}`);
          return res.status(400).json({ 
            error: `Transaction validation failed: ${transferValidation.error}` 
          });
        }
        
        console.log(`[FALLBACK] Direct SOL transfer validated for game ${onChainGameId}`);
      }
      
      txVerified = true;
      console.log(`[ON-CHAIN] Transaction ${txSignature.slice(0, 16)}... verified on slot ${verification.slot}`);

      // Join the game with real wallet (only after tx verified)
      const updatedGame = await storage.joinGame(game.id, walletAddress, txSignature);

      if (!updatedGame) {
        return res.status(400).json({ error: "Failed to join game" });
      }

      // Check if game is full and should start
      const config = GAME_MODES[mode];
      if (updatedGame.players.length === config.players) {
        await storage.updateGameStatus(updatedGame.id, "countdown");
      }

      // Calculate WAGA reward based on wager tier
      const rewardPercent = WAGA_ENTRY_REWARD_PERCENT[wager as WagerTier] || 50;
      const wagaReward = await calculateWagaReward(wager, rewardPercent);
      const solPrice = await getSolPrice();
      const wagaPrice = getWagaPrice();
      const usdValue = wager * solPrice;

      res.json({ 
        gameId: updatedGame.id, 
        game: { ...updatedGame, serverTime: Date.now() },
        playersNeeded: config.players - updatedGame.players.length,
        wagaReward,
        wagaRewardPercent: rewardPercent,
        solUsdValue: usdValue,
        wagaPrice,
        escrowPDA: updatedGame.escrowPDA, // From game state
        onChainGameId: updatedGame.onChainGameId,
        txVerified,
        network: "devnet",
        serverTime: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error joining game:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get claim winnings transaction for winner to sign
  app.post("/api/games/:id/claim", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      const game = await storage.getGame(req.params.id);
      
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }
      
      if (game.status !== "completed") {
        return res.status(400).json({ error: "Game not completed" });
      }
      
      // Find the winner player from the players array
      const winnerPlayer = game.players.find(p => p.walletAddress === game.winnerId);
      if (!game.winnerId || game.winnerId !== walletAddress) {
        return res.status(403).json({ error: "Only the winner can claim winnings" });
      }
      
      if (!game.onChainGameId) {
        return res.status(400).json({ error: "Game not on-chain" });
      }
      
      // Build claim winnings transaction for winner to sign
      const { transaction, escrowBalance } = await solanaClient.buildClaimWinningsTransaction(
        BigInt(game.onChainGameId),
        new (await import("@solana/web3.js")).PublicKey(walletAddress)
      );
      
      // Serialize transaction for frontend
      const serializedTx = transaction.serialize({ 
        requireAllSignatures: false,
        verifySignatures: false 
      }).toString("base64");
      
      res.json({
        transaction: serializedTx,
        escrowBalance,
        message: "Sign this transaction to claim your winnings",
      });
    } catch (error) {
      console.error("Error building claim transaction:", error);
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
      // Include server time for client-side clock synchronization
      res.json({ ...game, serverTime: Date.now() });
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

  // Claim vested WAGA tokens (10% daily release)
  app.post("/api/profile/:walletAddress/claim-vesting", async (req, res) => {
    try {
      const walletAddress = req.params.walletAddress;
      
      // Validate wallet address
      if (!walletAddress || walletAddress.length < 32 || walletAddress.length > 44) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      const result = await storage.claimVestedWaga(walletAddress);
      
      if (!result) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (result.claimedAmount === 0 && result.remainingVesting > 0) {
        const hoursRemaining = Math.ceil((result.nextClaimTime - Date.now()) / (1000 * 60 * 60));
        return res.status(400).json({ 
          error: `Must wait 24 hours between claims. Next claim available in ${hoursRemaining} hours.`,
          nextClaimTime: result.nextClaimTime,
          remainingVesting: result.remainingVesting,
        });
      }

      // On-chain transfer from Vault to user
      let txSig;
      if (solanaClient.hasAuthority() && result.claimedAmount > 0) {
        const transferResult = await solanaClient.transferWagaFromVault(walletAddress, result.claimedAmount);
        if (!transferResult.success) {
          // If on-chain fails, we should probably rollback the storage claim or log it heavily
          console.error(`[WAGA] On-chain claim transfer failed for ${walletAddress}: ${transferResult.error}`);
          return res.status(500).json({ error: "On-chain transfer failed: " + transferResult.error });
        }
        txSig = transferResult.txSig;
      }

      res.json({
        success: true,
        claimedAmount: result.claimedAmount,
        remainingVesting: result.remainingVesting,
        nextClaimTime: result.nextClaimTime,
        txSig,
        message: result.claimedAmount > 0 
          ? `Successfully claimed ${result.claimedAmount.toLocaleString()} WAGA tokens!`
          : "No vested tokens available to claim",
      });
    } catch (error) {
      console.error("Error claiming vested WAGA:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get vesting status
  app.get("/api/profile/:walletAddress/vesting", async (req, res) => {
    try {
      const profile = await storage.getProfile(req.params.walletAddress);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const totalVesting = profile.wagaVestingTotal || 0;
      const claimed = profile.wagaVestingClaimed || 0;
      const remaining = totalVesting - claimed;
      const lastClaim = profile.wagaVestingLastClaim || 0;
      const nextClaimTime = lastClaim > 0 ? lastClaim + VESTING_PERIOD_MS : 0;
      const canClaim = remaining > 0 && (lastClaim === 0 || Date.now() >= nextClaimTime);

      res.json({
        totalVesting,
        claimed,
        remaining,
        nextClaimTime: remaining > 0 ? nextClaimTime : 0,
        canClaim,
        dailyAmount: Math.floor(totalVesting * (VESTING_DAILY_PERCENT / 100)),
      });
    } catch (error) {
      console.error("Error getting vesting status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const sortBy = (req.query.sortBy as string) || "earnings";
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Validate sortBy parameter
      if (!["earnings", "luck", "streaks"].includes(sortBy)) {
        return res.status(400).json({ error: "Invalid sortBy parameter. Use: earnings, luck, or streaks" });
      }
      
      const leaderboard = await storage.getLeaderboard(sortBy as "earnings" | "luck" | "streaks", limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
