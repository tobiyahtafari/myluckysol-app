import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GAME_MODES, WAGER_TIERS, insertGameSchema, WAGA_ENTRY_MULTIPLIER, VESTING_PERIOD_MS, VESTING_DAILY_PERCENT, REFERRAL_REWARD_AMOUNT, CHAT_MIN_TOTAL_WAGERED, TIP_FEE_SOL, GIVEAWAY_MIN_SOL_FLOOR, GIVEAWAY_MILESTONE_GAMES, GIVEAWAY_PAYOUT_PERCENTS, type WagerTier, type GameModeKey } from "@shared/schema";
import { calculateWagaReward, getUsernameUpdateCostSol } from "./price-service";
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
        console.warn(`[ON-CHAIN] Transaction not confirmed: ${verification.error}. Waiting for confirmation...`);
        // Retry verification once after a small delay if not found immediately
        await new Promise(resolve => setTimeout(resolve, 2000));
        const retryVerification = await solanaClient.verifyTransaction(txSignature);
        if (!retryVerification.confirmed) {
          return res.status(400).json({ error: "Transaction not confirmed on-chain yet. Please try again in a few seconds." });
        }
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

      console.log(`[ON-CHAIN] Player ${walletAddress.slice(0, 8)}... successfully joined game ${updatedGame.id}. Total players: ${updatedGame.players.length}`);

      // Check if game is full and should start
      const config = GAME_MODES[mode];
      if (updatedGame.players.length === config.players) {
        await storage.updateGameStatus(updatedGame.id, "countdown");
      }

      const wagaReward = calculateWagaReward(wager, WAGA_ENTRY_MULTIPLIER);

      res.json({ 
        gameId: updatedGame.id, 
        game: { ...updatedGame, serverTime: Date.now() },
        playersNeeded: config.players - updatedGame.players.length,
        wagaReward,
        wagaMultiplier: WAGA_ENTRY_MULTIPLIER,
        escrowPDA: updatedGame.escrowPDA,
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

  // Get completed games (must come before /api/games/:id)
  app.get("/api/games/completed", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const games = await storage.getCompletedGames(limit);
      const safeGames = games.map(g => ({
        id: g.id,
        mode: g.mode,
        wager: g.wager,
        poolAmount: g.poolAmount,
        winnerId: g.winnerId,
        winnerPayout: g.winnerPayout,
        serverSeedHash: g.serverSeedHash,
        serverSeed: g.serverSeed,
        clientSeed: g.clientSeed,
        players: g.players.map(p => ({
          walletAddress: p.walletAddress,
          username: p.username,
        })),
        completedAt: g.completedAt,
        createdAt: g.createdAt,
      }));
      res.json(safeGames);
    } catch (error) {
      console.error("Error getting completed games:", error);
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
  app.get("/api/profile/:walletAddress/referrals", async (req, res) => {
    try {
      const walletAddress = req.params.walletAddress;
      const profiles = await storage.getAllProfiles();
      const referrals = profiles.filter(p => p.pendingReferralBy === walletAddress);
      
      const referralData = referrals.map(p => ({
        walletAddress: p.walletAddress,
        username: p.username,
        referralRewarded: p.referralRewarded,
        createdAt: p.createdAt,
      }));
      
      res.json(referralData);
    } catch (error) {
      console.error("Error getting referrals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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

  app.get("/api/profile/:walletAddress/username-cost", async (req, res) => {
    try {
      const profile = await storage.getOrCreateProfile(req.params.walletAddress);
      const updateCount = profile.usernameUpdateCount || 0;
      const cost = await getUsernameUpdateCostSol(updateCount);
      const treasuryAddress = solanaClient.getTreasuryWallet().toBase58();
      res.json({
        ...cost,
        updateCount,
        currentUsername: profile.username || null,
        paymentAddress: treasuryAddress,
      });
    } catch (error) {
      console.error("Error getting username cost:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/profile/:walletAddress", async (req, res) => {
    try {
      const { username, avatarUrl, referredBy, txSignature } = req.body;
      const walletAddress = req.params.walletAddress;
      const profile = await storage.getProfile(walletAddress);
      
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (username) {
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

        if (!txSignature) {
          return res.status(400).json({ error: "SOL payment transaction required for username update" });
        }

        const updateCount = profile.usernameUpdateCount || 0;
        const { costSol } = await getUsernameUpdateCostSol(updateCount);

        const verification = await solanaClient.verifyTransaction(txSignature);
        if (!verification.confirmed) {
          return res.status(400).json({ error: "Payment transaction not confirmed" });
        }

        const treasuryAddress = solanaClient.getTreasuryWallet().toBase58();

        const transferValid = await solanaClient.validateTransfer(
          txSignature,
          walletAddress,
          treasuryAddress,
          costSol
        );
        if (!transferValid.valid) {
          console.warn(`[USERNAME] Transfer validation failed: ${transferValid.error}`);
          return res.status(400).json({ error: `Payment validation failed: ${transferValid.error}` });
        }

        // Apply referrer if provided during username update
        if (referredBy && !profile.referredBy) {
          const referrer = await storage.getProfileByUsernameOrWallet(referredBy);
          if (referrer && referrer.walletAddress !== walletAddress) {
            await storage.updateProfile(walletAddress, { referredBy: referrer.username || referrer.walletAddress });
          }
        }

        req.body.usernameUpdatedAt = now;
        req.body.usernameUpdateCount = updateCount + 1;

        const updated = await storage.updateProfile(walletAddress, {
          username,
          usernameUpdatedAt: now,
          usernameUpdateCount: updateCount + 1,
        });

        if (updated) {
          const isFirstUsernameSet = updateCount === 0;
          const referralResult = isFirstUsernameSet 
            ? await storage.grantPendingReferralRewards(walletAddress) 
            : null;
          if (referralResult?.granted) {
            console.log(`[REFERRAL] Username set triggered referral rewards for ${walletAddress.slice(0, 8)}...`);

            let referralTxSigs: { referred?: string; referrer?: string } = {};

            if (solanaClient.hasAuthority()) {
              const referredTransfer = await solanaClient.transferWagaFromVault(walletAddress, REFERRAL_REWARD_AMOUNT);
              if (!referredTransfer.success) {
                console.error(`[WAGA] Failed to send referral reward to referred user: ${referredTransfer.error}`);
                await storage.rollbackReferralRewards(walletAddress);
                return res.status(500).json({ error: "Failed to transfer referral WAGA reward on-chain. Please try again." });
              }
              referralTxSigs.referred = referredTransfer.txSig;
              console.log(`[WAGA] Referral reward sent to referred user ${walletAddress.slice(0, 8)}... Tx: ${referredTransfer.txSig}`);

              if (referralResult.referrerWallet) {
                const referrerTransfer = await solanaClient.transferWagaFromVault(referralResult.referrerWallet, REFERRAL_REWARD_AMOUNT);
                if (!referrerTransfer.success) {
                  console.error(`[WAGA] Failed to send referral reward to referrer: ${referrerTransfer.error}`);
                  const referrerProfile = await storage.getProfile(referralResult.referrerWallet);
                  if (referrerProfile) {
                    await storage.updateProfile(referralResult.referrerWallet, {
                      wagaEarned: Math.max(0, (referrerProfile.wagaEarned || 0) - REFERRAL_REWARD_AMOUNT),
                    });
                    console.log(`[WAGA] Rolled back referrer wagaEarned for ${referralResult.referrerWallet.slice(0, 8)}...`);
                  }
                } else {
                  referralTxSigs.referrer = referrerTransfer.txSig;
                  console.log(`[WAGA] Referral reward sent to referrer ${referralResult.referrerWallet.slice(0, 8)}... Tx: ${referrerTransfer.txSig}`);
                }
              }
            }

            const freshProfile = await storage.getProfile(walletAddress);
            return res.json({
              profile: freshProfile,
              referralGranted: true,
              referralReward: REFERRAL_REWARD_AMOUNT,
              referralTxSigs,
            });
          }
          return res.json({ profile: updated, referralGranted: false });
        }
        return res.status(500).json({ error: "Failed to update profile" });
      }

      if (referredBy && !profile.referredBy) {
        const referrer = await storage.getProfileByUsernameOrWallet(referredBy);
        if (!referrer) {
          return res.status(404).json({ error: "Referrer username or wallet not found" });
        }
        if (referrer.walletAddress === walletAddress) {
          return res.status(400).json({ error: "You cannot refer yourself" });
        }
        
        const updated = await storage.updateProfile(walletAddress, { 
          referredBy: referrer.username || referrer.walletAddress 
        });

        // If user already has a username, trigger rewards immediately
        if (profile.username && updated) {
          const rewardResult = await storage.grantPendingReferralRewards(walletAddress);
          if (rewardResult?.granted) {
             // Attempt on-chain transfers if authority available
             if (solanaClient.hasAuthority()) {
               await solanaClient.transferWagaFromVault(walletAddress, REFERRAL_REWARD_AMOUNT);
               if (rewardResult.referrerWallet) {
                 await solanaClient.transferWagaFromVault(rewardResult.referrerWallet, REFERRAL_REWARD_AMOUNT);
               }
             }
             return res.json({ profile: await storage.getProfile(walletAddress), referralGranted: true });
          }
        }
        
        return res.json({ profile: updated });
      }

      if (avatarUrl) {
        if (avatarUrl.startsWith("data:image/")) {
          if ((profile.usernameUpdateCount || 0) < 1) {
            return res.status(403).json({ error: "Custom avatar upload requires paying the username fee first." });
          }
          const base64Data = avatarUrl.split(",")[1];
          if (base64Data) {
            const buffer = Buffer.from(base64Data, "base64");
            const maxSize = 2 * 1024 * 1024; // Increased to 2MB for buffer check
            if (buffer.length > maxSize) {
              return res.status(400).json({ error: "Image too large. Please upload a smaller image." });
            }
            storage.storeAvatarImage(walletAddress, buffer, avatarUrl.split(";")[0].split(":")[1] || "image/png");
            const storedUrl = `/api/avatar/${walletAddress}?t=${Date.now()}`;
            const updated = await storage.updateProfile(walletAddress, { avatarUrl: storedUrl });
            return res.json({ profile: updated });
          }
        }
        const updated = await storage.updateProfile(walletAddress, { avatarUrl });
        return res.json({ profile: updated });
      }

      const updated = await storage.updateProfile(walletAddress, req.body);
      res.json({ profile: updated });
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

      // Step 1: Preview — calculate what can be claimed without touching storage
      const preview = await storage.previewVestedClaim(walletAddress);
      
      if (!preview) {
        return res.status(404).json({ error: "Profile not found" });
      }

      if (!preview.canClaim) {
        if (preview.nextClaimTime > 0) {
          const hoursRemaining = Math.ceil((preview.nextClaimTime - Date.now()) / (1000 * 60 * 60));
          return res.status(400).json({ 
            error: `Must wait 24 hours between claims. Next claim available in ${hoursRemaining} hours.`,
            nextClaimTime: preview.nextClaimTime,
            remainingVesting: preview.remainingVesting,
          });
        }
        return res.status(400).json({ error: "No vested tokens available to claim" });
      }

      // Step 2: Attempt on-chain transfer BEFORE committing to storage.
      // REQUIRE_ONCHAIN_WAGA=true enforces this for mainnet. On devnet it is skipped
      // so claiming can be tested without a live WAGA vault.
      const requireOnchain = process.env.REQUIRE_ONCHAIN_WAGA === "true";
      let txSig;
      if (solanaClient.hasAuthority()) {
        const transferResult = await solanaClient.transferWagaFromVault(walletAddress, preview.claimAmount);
        if (!transferResult.success) {
          if (requireOnchain) {
            // Mainnet: block the claim — storage is NOT updated, user can retry freely
            console.error(`[WAGA] On-chain claim transfer failed for ${walletAddress}: ${transferResult.error}`);
            return res.status(500).json({ error: "On-chain transfer failed: " + transferResult.error });
          } else {
            // Devnet: log the failure but allow the storage claim to proceed for testing
            console.warn(`[WAGA] Devnet — on-chain transfer skipped (${transferResult.error}). Committing storage claim for testing.`);
          }
        } else {
          txSig = transferResult.txSig;
        }
      }

      // Step 3: Commit to storage (on-chain succeeded, or devnet where it is not enforced)
      await storage.commitVestedClaim(walletAddress, preview.claimAmount);
      const remainingAfterClaim = preview.remainingVesting - preview.claimAmount;

      res.json({
        success: true,
        claimedAmount: preview.claimAmount,
        remainingVesting: remainingAfterClaim,
        nextClaimTime: preview.nextClaimTime,
        txSig,
        message: `Successfully claimed ${preview.claimAmount.toLocaleString()} WAGA tokens!`,
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
      // 10% of remaining balance (exponential decay), ceil so small balances yield at least 1
      const dailyAmount = Math.ceil(remaining * (VESTING_DAILY_PERCENT / 100));
      const canClaim = remaining > 0 && dailyAmount > 0 && (lastClaim === 0 || Date.now() >= nextClaimTime);

      res.json({
        totalVesting,
        claimed,
        remaining,
        nextClaimTime: remaining > 0 ? nextClaimTime : 0,
        canClaim,
        dailyAmount,
      });
    } catch (error) {
      console.error("Error getting vesting status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/avatar/:walletAddress", (req, res) => {
    const image = storage.getAvatarImage(req.params.walletAddress);
    if (!image) {
      return res.status(404).send("Not found");
    }
    res.set("Content-Type", image.contentType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(image.data);
  });

  // Get leaderboard
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const sortBy = (req.query.sortBy as string) || "earnings";
      const limit = parseInt(req.query.limit as string) || 50;
      const period = (req.query.period as string) || "all";
      
      if (!["earnings", "luck", "streaks"].includes(sortBy)) {
        return res.status(400).json({ error: "Invalid sortBy parameter. Use: earnings, luck, or streaks" });
      }
      
      if (!["all", "daily", "weekly", "monthly"].includes(period)) {
        return res.status(400).json({ error: "Invalid period parameter. Use: all, daily, weekly, or monthly" });
      }
      
      const leaderboard = await storage.getLeaderboard(
        sortBy as "earnings" | "luck" | "streaks", 
        limit,
        period as "all" | "daily" | "weekly" | "monthly"
      );
      res.json(leaderboard);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getGlobalStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting global stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/verify", async (req, res) => {
    try {
      const { serverSeedHash } = req.query;
      if (!serverSeedHash || typeof serverSeedHash !== "string") {
        return res.status(400).json({ error: "serverSeedHash query parameter required" });
      }
      const game = await storage.verifyGame(serverSeedHash);
      if (!game) {
        return res.status(404).json({ error: "No completed game found with that server seed hash" });
      }
      res.json({
        id: game.id,
        mode: game.mode,
        wager: game.wager,
        poolAmount: game.poolAmount,
        winnerId: game.winnerId,
        winnerPayout: game.winnerPayout,
        serverSeed: game.serverSeed,
        serverSeedHash: game.serverSeedHash,
        clientSeed: game.clientSeed,
        players: game.players.map(p => ({
          walletAddress: p.walletAddress,
          username: p.username,
        })),
        completedAt: game.completedAt,
      });
    } catch (error) {
      console.error("Error verifying game:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Global chat - GET messages
  app.get("/api/chat", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getGlobalChatMessages(limit);
      res.json(messages);
    } catch (error) {
      console.error("Error getting global chat:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Global chat - POST message (gated by min 0.1 SOL wagered)
  app.post("/api/chat", async (req, res) => {
    try {
      const { walletAddress, message } = req.body;

      if (!walletAddress || !message) {
        return res.status(400).json({ error: "walletAddress and message are required" });
      }

      if (typeof message !== "string" || message.trim().length === 0 || message.length > 280) {
        return res.status(400).json({ error: "Message must be 1-280 characters" });
      }

      const profile = await storage.getProfile(walletAddress);
      if (!profile) {
        return res.status(403).json({ error: "Profile not found. Play a game first." });
      }

      if ((profile.totalWagered || 0) < CHAT_MIN_TOTAL_WAGERED) {
        return res.status(403).json({ 
          error: `You must wager at least ${CHAT_MIN_TOTAL_WAGERED} SOL in total to chat.`,
          required: CHAT_MIN_TOTAL_WAGERED,
          current: profile.totalWagered || 0,
        });
      }

      const chatMessage = await storage.addGlobalChatMessage({
        walletAddress,
        username: profile.username,
        message: message.trim(),
        isGodStreak: profile.godStreakActive || false,
        isStreakBreaker: profile.isStreakBreakerActive || false,
      });

      res.json(chatMessage);
    } catch (error) {
      console.error("Error posting global chat:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Tip endpoint - send SOL tip to another player
  app.post("/api/tip", async (req, res) => {
    try {
      const { fromWallet, toIdentifier, amount, txSignature } = req.body;

      if (!fromWallet || !toIdentifier || !amount) {
        return res.status(400).json({ error: "fromWallet, toIdentifier, and amount are required" });
      }

      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
      }

      const recipient = await storage.getProfileByUsernameOrWallet(toIdentifier);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      if (recipient.walletAddress === fromWallet) {
        return res.status(400).json({ error: "Cannot tip yourself" });
      }

      // Log the tip (on-chain transfer should be done client-side)
      console.log(`[TIP] ${fromWallet.slice(0, 8)}... tipped ${amount} SOL to ${recipient.walletAddress.slice(0, 8)}... (fee: ${TIP_FEE_SOL} SOL). Tx: ${txSignature}`);

      // Add to global chat
      const senderProfile = await storage.getProfile(fromWallet);
      await storage.addGlobalChatMessage({
        walletAddress: fromWallet,
        username: senderProfile?.username,
        message: `tipped ${recipient.username || recipient.walletAddress.slice(0, 8)} ${amount} SOL`,
        isGodStreak: !!senderProfile?.godStreakActive,
        isStreakBreaker: !!senderProfile?.isStreakBreakerActive,
        tipAmount: Number(amount),
        tipRecipient: recipient.walletAddress,
      });

      res.json({
        success: true,
        recipient: {
          walletAddress: recipient.walletAddress,
          username: recipient.username,
        },
        amount: Number(amount),
        fee: TIP_FEE_SOL,
        txSignature,
      });
    } catch (error) {
      console.error("Error processing tip:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Giveaway stats
  app.get("/api/giveaway/stats", async (req, res) => {
    try {
      const stats = await storage.getGiveawayStats();
      const displayBalance = Math.max(GIVEAWAY_MIN_SOL_FLOOR, stats.giveawayWalletBalance);
      const gamesInCycle = stats.totalGamesPlayed - stats.cycleStartGameCount;
      const progressPercent = Math.min(100, (gamesInCycle / GIVEAWAY_MILESTONE_GAMES) * 100);

      res.json({
        ...stats,
        displayBalance,
        gamesInCycle,
        progressPercent,
        milestoneGames: GIVEAWAY_MILESTONE_GAMES,
        gamesRemaining: Math.max(0, GIVEAWAY_MILESTONE_GAMES - gamesInCycle),
        payoutPercents: GIVEAWAY_PAYOUT_PERCENTS,
      });
    } catch (error) {
      console.error("Error getting giveaway stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Giveaway leaderboard (top 10 luck + top 10 streaks)
  app.get("/api/giveaway/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getGiveawayLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error getting giveaway leaderboard:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Previous winners
  app.get("/api/giveaway/winners", async (req, res) => {
    try {
      const season = req.query.season ? parseInt(req.query.season as string) : undefined;
      const winners = await (storage as any).getGiveawayWinners(season);
      res.json(winners);
    } catch (error) {
      console.error("Error getting giveaway winners:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // God streak status check for a player
  app.get("/api/profile/:walletAddress/god-streak", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      await storage.checkAndExpireGodStreak(walletAddress);
      const profile = await storage.getProfile(walletAddress);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({
        godStreakActive: profile.godStreakActive || false,
        godStreakGamesRemaining: profile.godStreakGamesRemaining || 0,
        godStreakStartedAt: profile.godStreakStartedAt,
        godStreakLastPlayedAt: profile.godStreakLastPlayedAt,
        isStreakBreakerActive: profile.isStreakBreakerActive || false,
        godStreaksAchieved: profile.godStreaksAchieved || 0,
        streaksBeaten: profile.streaksBeaten || 0,
      });
    } catch (error) {
      console.error("Error getting god streak status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return httpServer;
}
