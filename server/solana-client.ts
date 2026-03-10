import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { 
  getOrCreateAssociatedTokenAccount, 
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  getMint
} from "@solana/spl-token";
import { FOUNDATION_TREASURY_WALLET, GIVEAWAY_WALLET, MYLUCKYSOL_PROGRAM_ID, WAGA_TOKEN_MINT, WAGA_REWARDS_VAULT } from "@shared/constants";
import bs58 from "bs58";
import { createHash } from "crypto";

// PDA seeds matching the Anchor program
const GAME_SEED = Buffer.from("game");
const GAME_POOL_SEED = Buffer.from("game_pool");
const GAME_CONFIG_SEED = Buffer.from("game_config");

// Wager tiers in lamports
const WAGER_LAMPORTS = {
  0.01: 10_000_000,
  0.1: 100_000_000,
  1: 1_000_000_000,
  10: 10_000_000_000,
};

// Game mode enum values
enum GameModeValue {
  OneVsOne = 0,
  TwoRound = 1,
  ThreeRound = 2,
  FourRound = 3,
}

// Anchor instruction discriminators (pre-computed SHA256 hashes)
function getAnchorDiscriminator(namespace: string, name: string): Buffer {
  const preimage = `${namespace}:${name}`;
  const hash = createHash("sha256").update(preimage).digest();
  return hash.slice(0, 8);
}

const DISCRIMINATORS = {
  initializeGameConfig: getAnchorDiscriminator("global", "initialize_game_config"),
  createGame: getAnchorDiscriminator("global", "create_game"),
  joinGame: getAnchorDiscriminator("global", "join_game"),
  finalizeGame: getAnchorDiscriminator("global", "finalize_game"),
  claimWinnings: getAnchorDiscriminator("global", "claim_winnings"),
};

export class SolanaGameClient {
  private connection: Connection;
  private programId: PublicKey;
  private treasuryWallet: PublicKey;
  private authorityKeypair: Keypair | null = null;

  constructor() {
    // Use SOLANA_RPC_URL env var if set (set it to a valid Helius or other RPC URL)
    // Falls back to public mainnet RPC
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(rpcUrl, "confirmed");
    console.log(`[SOLANA] Connected to mainnet via ${rpcUrl}`);
    this.programId = new PublicKey(MYLUCKYSOL_PROGRAM_ID);
    this.treasuryWallet = new PublicKey(FOUNDATION_TREASURY_WALLET);

    // Load authority keypair from environment if available
    const authorityPrivateKey = process.env.SOLANA_AUTHORITY_PRIVATE_KEY;
    if (authorityPrivateKey) {
      try {
        let secretKey: Uint8Array;
        if (authorityPrivateKey.trim().startsWith('[')) {
          const keyArray = JSON.parse(authorityPrivateKey);
          secretKey = Uint8Array.from(keyArray);
        } else {
          // Fallback to base58 if not a JSON array
          secretKey = bs58.decode(authorityPrivateKey);
        }
        this.authorityKeypair = Keypair.fromSecretKey(secretKey);
        console.log("[SOLANA] Authority keypair loaded:", this.authorityKeypair.publicKey.toBase58());
        
        // Check if this authority is also the WAGA vault (for simpler setup)
        if (this.authorityKeypair.publicKey.toBase58() === WAGA_REWARDS_VAULT) {
          console.log("[SOLANA] Authority is the WAGA Vault owner");
        } else {
          console.warn("[SOLANA] Authority is NOT the WAGA Vault owner. Ensure vault delegation is set up.");
        }
      } catch (e) {
        console.warn("[SOLANA] Failed to load authority keypair:", e);
      }
    } else {
      console.warn("[SOLANA] No SOLANA_AUTHORITY_PRIVATE_KEY set - on-chain game creation disabled");
    }
  }

  // Ensure giveaway wallet has enough SOL to be rent-exempt and receive payouts
  async ensureGiveawayWalletFunded(): Promise<void> {
    if (!this.authorityKeypair) return;
    try {
      const giveawayPubkey = new PublicKey(GIVEAWAY_WALLET);
      const balance = await this.connection.getBalance(giveawayPubkey);
      const RENT_EXEMPT_MIN = 890880;
      const TARGET = 10_000_000; // 0.01 SOL to give comfortable headroom
      if (balance < RENT_EXEMPT_MIN) {
        console.log(`[SOLANA] Giveaway wallet has ${balance} lamports — below rent-exempt. Funding to 0.01 SOL...`);
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: this.authorityKeypair.publicKey,
            toPubkey: giveawayPubkey,
            lamports: TARGET - balance,
          })
        );
        tx.feePayer = this.authorityKeypair.publicKey;
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.sign(this.authorityKeypair);
        const sig = await this.connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
        await this.connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        console.log(`[SOLANA] Giveaway wallet funded. Tx: ${sig}`);
      } else {
        console.log(`[SOLANA] Giveaway wallet balance: ${balance} lamports — OK`);
      }
    } catch (e) {
      console.error('[SOLANA] Failed to fund giveaway wallet:', e);
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  getProgramId(): PublicKey {
    return this.programId;
  }

  getTreasuryWallet(): PublicKey {
    return this.treasuryWallet;
  }

  hasAuthority(): boolean {
    return this.authorityKeypair !== null;
  }

  private programDeployed: boolean | null = null; // cached check result

  isOnChainEnabled(): boolean {
    return this.authorityKeypair !== null;
  }

  // Check if the program is actually deployed and executable on-chain
  async isProgramDeployed(): Promise<boolean> {
    // Return cached result if available
    if (this.programDeployed !== null) {
      return this.programDeployed;
    }
    
    try {
      const accountInfo = await this.connection.getAccountInfo(this.programId);
      this.programDeployed = accountInfo !== null && accountInfo.executable === true;
      console.log(`[SOLANA] Program deployed check: ${this.programDeployed}`);
      return this.programDeployed;
    } catch (e) {
      console.warn("[SOLANA] Failed to check program deployment:", e);
      this.programDeployed = false;
      return false;
    }
  }

  // Get authority wallet address (used as escrow)
  getAuthorityAddress(): string | null {
    return this.authorityKeypair?.publicKey.toBase58() || null;
  }

  // Alias for executePayoutFromEscrow
  async executePayouts(
    gameId: bigint,
    winnerWallet: string,
    payoutSol: number,
    treasuryFeeSol: number
  ): Promise<{ success: boolean; winnerTxSig?: string; treasuryTxSig?: string; error?: string }> {
    return this.executePayoutFromEscrow(gameId, winnerWallet, payoutSol, treasuryFeeSol);
  }

  // Derive game PDA
  getGamePDA(gameId: bigint): [PublicKey, number] {
    const gameIdBuffer = Buffer.alloc(8);
    gameIdBuffer.writeBigUInt64LE(gameId);
    return PublicKey.findProgramAddressSync(
      [GAME_SEED, gameIdBuffer],
      this.programId
    );
  }

  // Derive game pool PDA (escrow)
  getGamePoolPDA(gameId: bigint): [PublicKey, number] {
    const gameIdBuffer = Buffer.alloc(8);
    gameIdBuffer.writeBigUInt64LE(gameId);
    return PublicKey.findProgramAddressSync(
      [GAME_POOL_SEED, gameIdBuffer],
      this.programId
    );
  }

  // Derive game config PDA
  getGameConfigPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [GAME_CONFIG_SEED],
      this.programId
    );
  }

  // Convert game mode string to enum value
  gameModeToValue(mode: string): GameModeValue {
    switch (mode) {
      case "1v1": return GameModeValue.OneVsOne;
      case "2-round": return GameModeValue.TwoRound;
      case "3-round": return GameModeValue.ThreeRound;
      case "4-round": return GameModeValue.FourRound;
      default: return GameModeValue.OneVsOne;
    }
  }

  // Convert wager SOL to lamports
  wagerToLamports(wager: number): bigint {
    return BigInt(Math.round(wager * LAMPORTS_PER_SOL));
  }

  // Check if game config is initialized on-chain
  async isGameConfigInitialized(): Promise<boolean> {
    try {
      const [configPDA] = this.getGameConfigPDA();
      const accountInfo = await this.connection.getAccountInfo(configPDA);
      return accountInfo !== null && accountInfo.data.length > 0;
    } catch (e) {
      return false;
    }
  }

  // Get game pool balance (escrow)
  async getGamePoolBalance(gameId: bigint): Promise<number> {
    try {
      const [gamePoolPDA] = this.getGamePoolPDA(gameId);
      const balance = await this.connection.getBalance(gamePoolPDA);
      return balance / LAMPORTS_PER_SOL;
    } catch (e) {
      console.error("[SOLANA] Error getting game pool balance:", e);
      return 0;
    }
  }

  // Build create_game instruction to initialize game on-chain
  buildCreateGameInstruction(
    gameId: bigint,
    gameMode: string,
    wagerSol: number
  ): TransactionInstruction {
    const [gamePDA] = this.getGamePDA(gameId);
    const [gamePoolPDA] = this.getGamePoolPDA(gameId);
    const [gameConfigPDA] = this.getGameConfigPDA();

    // Account ordering per CreateGame context in lib.rs
    const keys = [
      { pubkey: gamePDA, isSigner: false, isWritable: true },      // game (init)
      { pubkey: gamePoolPDA, isSigner: false, isWritable: true },  // game_pool (init)
      { pubkey: gameConfigPDA, isSigner: false, isWritable: false }, // game_config (read-only)
      { pubkey: this.authorityKeypair!.publicKey, isSigner: true, isWritable: true }, // creator (payer)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    // Build instruction data: discriminator + game_id (u64) + game_mode (u8) + wager (u64)
    const gameModeValue = this.gameModeToValue(gameMode);
    const wagerLamports = this.wagerToLamports(wagerSol);
    
    const data = Buffer.alloc(8 + 8 + 1 + 8); // discriminator + game_id + mode + wager
    DISCRIMINATORS.createGame.copy(data, 0);
    data.writeBigUInt64LE(gameId, 8);
    data.writeUInt8(gameModeValue, 16);
    data.writeBigUInt64LE(wagerLamports, 17);

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data,
    });
  }

  // Create game on-chain (initializes game and escrow PDAs)
  async createGameOnChain(
    gameId: bigint,
    gameMode: string,
    wagerSol: number
  ): Promise<{ success: boolean; signature?: string; error?: string }> {
    if (!this.authorityKeypair) {
      console.log(`[SOLANA] On-chain game creation skipped (no authority)`);
      return { success: false, error: "No authority keypair configured" };
    }

    try {
      const instruction = this.buildCreateGameInstruction(gameId, gameMode, wagerSol);
      const transaction = new Transaction().add(instruction);

      console.log(`[SOLANA] Creating game on-chain...`);
      console.log(`  - Game ID: ${gameId}`);
      console.log(`  - Mode: ${gameMode}`);
      console.log(`  - Wager: ${wagerSol} SOL`);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.authorityKeypair],
        { commitment: "confirmed" }
      );

      console.log(`[SOLANA] Game created on-chain! Tx: ${signature}`);
      return { success: true, signature };
    } catch (error) {
      console.error("[SOLANA] On-chain game creation error:", error);
      return { success: false, error: String(error) };
    }
  }

  // Build join game instruction (for client to sign)
  buildJoinGameInstruction(
    gameId: bigint,
    playerWallet: PublicKey
  ): TransactionInstruction {
    const [gamePDA] = this.getGamePDA(gameId);
    const [gamePoolPDA] = this.getGamePoolPDA(gameId);

    const keys = [
      { pubkey: gamePDA, isSigner: false, isWritable: true },
      { pubkey: gamePoolPDA, isSigner: false, isWritable: true },
      { pubkey: playerWallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data: DISCRIMINATORS.joinGame,
    });
  }

  // Build a transaction for joining a game (client signs)
  async buildJoinGameTransaction(
    gameId: bigint,
    playerWallet: PublicKey
  ): Promise<{ transaction: Transaction; gamePoolPDA: string }> {
    const instruction = this.buildJoinGameInstruction(gameId, playerWallet);
    const transaction = new Transaction().add(instruction);

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = playerWallet;

    const [gamePoolPDA] = this.getGamePoolPDA(gameId);

    return {
      transaction,
      gamePoolPDA: gamePoolPDA.toBase58(),
    };
  }

  // For hybrid mode: build a simple SOL transfer to game pool PDA
  async buildEscrowTransferTransaction(
    gameId: bigint,
    playerWallet: PublicKey,
    wagerSol: number
  ): Promise<{ transaction: Transaction; escrowPDA: string }> {
    const [gamePoolPDA] = this.getGamePoolPDA(gameId);
    const lamports = Math.round(wagerSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: playerWallet,
        toPubkey: gamePoolPDA,
        lamports,
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = playerWallet;

    return {
      transaction,
      escrowPDA: gamePoolPDA.toBase58(),
    };
  }

  // Fallback mode: build a simple SOL transfer to authority wallet (when program not deployed)
  async buildFallbackTransferTransaction(
    playerWallet: PublicKey,
    wagerSol: number
  ): Promise<{ transaction: Transaction; escrowAddress: string }> {
    if (!this.authorityKeypair) {
      throw new Error("Authority keypair required for fallback mode");
    }
    
    const lamports = Math.round(wagerSol * LAMPORTS_PER_SOL);
    const escrowAddress = this.authorityKeypair.publicKey;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: playerWallet,
        toPubkey: escrowAddress,
        lamports,
      })
    );

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = playerWallet;

    return {
      transaction,
      escrowAddress: escrowAddress.toBase58(),
    };
  }

  // Build finalize_game instruction to pay treasury fee from escrow PDA
  // Note: finalize_game only pays treasury fee, claim_winnings is separate for winner
  buildFinalizeGameInstruction(
    gameId: bigint
  ): TransactionInstruction {
    const [gamePDA] = this.getGamePDA(gameId);
    const [gamePoolPDA] = this.getGamePoolPDA(gameId);
    const [gameConfigPDA] = this.getGameConfigPDA();
    const giveawayWallet = new PublicKey(GIVEAWAY_WALLET);

    // Account ordering per FinalizeGame context in lib.rs
    const keys = [
      { pubkey: gamePDA, isSigner: false, isWritable: true },      // game
      { pubkey: gamePoolPDA, isSigner: false, isWritable: true },  // game_pool
      { pubkey: gameConfigPDA, isSigner: false, isWritable: false }, // game_config (read-only)
      { pubkey: this.treasuryWallet, isSigner: false, isWritable: true }, // treasury
      { pubkey: giveawayWallet, isSigner: false, isWritable: true }, // giveaway
      { pubkey: this.authorityKeypair!.publicKey, isSigner: true, isWritable: false }, // authority
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data: DISCRIMINATORS.finalizeGame, // No args needed
    });
  }

  // Simple SOL transfer from authority wallet to any recipient
  async transferSol(
    toAddress: string,
    amountSol: number
  ): Promise<{ success: boolean; txSig?: string; error?: string }> {
    if (!this.authorityKeypair) return { success: false, error: "No authority keypair configured" };
    try {
      const toPubkey = new PublicKey(toAddress);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.authorityKeypair.publicKey,
          toPubkey,
          lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
        })
      );
      const signature = await sendAndConfirmTransaction(this.connection, transaction, [this.authorityKeypair]);
      return { success: true, txSig: signature };
    } catch (error) {
      console.error("[SOLANA] transferSol error:", error);
      return { success: false, error: String(error) };
    }
  }

  // Transfer WAGA from vault (authority must be owner or delegate)
  async transferWagaFromVault(
    to: string,
    amount: number
  ): Promise<{ success: boolean; txSig?: string; error?: string }> {
    if (!this.authorityKeypair) return { success: false, error: "No authority" };
    
    try {
      const mintPubkey = new PublicKey(WAGA_TOKEN_MINT);
      const vaultPubkey = new PublicKey(WAGA_REWARDS_VAULT);
      const recipientPubkey = new PublicKey(to);
      
      // Use 9 decimals for WAGA on mainnet
      const decimals = 9;
      const amountInUnits = BigInt(Math.round(amount * Math.pow(10, decimals)));
      
      const vaultAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.authorityKeypair,
        mintPubkey,
        this.authorityKeypair.publicKey
      );
      
      const recipientAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.authorityKeypair,
        mintPubkey,
        recipientPubkey
      );
      
      const transaction = new Transaction().add(
        createTransferInstruction(
          vaultAta.address,
          recipientAta.address,
          this.authorityKeypair.publicKey,
          amountInUnits,
          [],
          TOKEN_PROGRAM_ID
        )
      );
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.authorityKeypair]
      );
      
      return { success: true, txSig: signature };
    } catch (e) {
      console.error("[SOLANA] WAGA transfer error:", e);
      return { success: false, error: String(e) };
    }
  }

  // Build claim_winnings instruction for winner to claim from escrow
  buildClaimWinningsInstruction(
    gameId: bigint,
    winnerWallet: PublicKey
  ): TransactionInstruction {
    const [gamePDA] = this.getGamePDA(gameId);
    const [gamePoolPDA] = this.getGamePoolPDA(gameId);

    // Accounts per ClaimWinnings context: game, game_pool, winner (signer), system_program
    const keys = [
      { pubkey: gamePDA, isSigner: false, isWritable: true },
      { pubkey: gamePoolPDA, isSigner: false, isWritable: true },
      { pubkey: winnerWallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data: DISCRIMINATORS.claimWinnings,
    });
  }

  // Execute payouts from escrow (PDA or fallback wallet)
  async executePayoutFromEscrow(
    gameId: bigint,
    winnerWallet: string,
    payoutSol: number,
    treasuryFeeSol: number,
    giveawayFeeSol: number = 0
  ): Promise<{ success: boolean; winnerTxSig?: string; treasuryTxSig?: string; giveawayTxSig?: string; error?: string }> {
    if (!this.authorityKeypair) {
      console.log(`[SOLANA] Payout pending (no authority): ${payoutSol} SOL to ${winnerWallet}`);
      return { success: false, error: "No authority keypair configured" };
    }

    try {
      // Check if we are in fallback mode (program not deployed)
      const isProgramDeployed = await this.isProgramDeployed();
      
      if (!isProgramDeployed) {
        // FALLBACK MODE: Authority wallet is the escrow
        console.log(`[SOLANA] [FALLBACK] Executing direct transfers from authority wallet...`);
        
        const winnerPubkey = new PublicKey(winnerWallet);
        const treasuryPubkey = this.treasuryWallet;
        const giveawayPubkey = new PublicKey(GIVEAWAY_WALLET);
        
        const transaction = new Transaction();
        
        // 90% to winner
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: this.authorityKeypair.publicKey,
            toPubkey: winnerPubkey,
            lamports: Math.round(payoutSol * LAMPORTS_PER_SOL),
          })
        );
        
        // 9% to treasury
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: this.authorityKeypair.publicKey,
            toPubkey: treasuryPubkey,
            lamports: Math.round(treasuryFeeSol * LAMPORTS_PER_SOL),
          })
        );
        
        // 1% to giveaway
        if (giveawayFeeSol > 0) {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey: this.authorityKeypair.publicKey,
              toPubkey: giveawayPubkey,
              lamports: Math.round(giveawayFeeSol * LAMPORTS_PER_SOL),
            })
          );
        }

        transaction.feePayer = this.authorityKeypair.publicKey;
        const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;

        // Sign and send manually so we can extract simulation logs on failure
        transaction.sign(this.authorityKeypair);
        const rawTx = transaction.serialize();
        let signature: string;
        try {
          signature = await this.connection.sendRawTransaction(rawTx, { skipPreflight: true, preflightCommitment: 'confirmed' });
        } catch (sendErr: any) {
          // Extract simulation logs if available
          if (sendErr?.logs) {
            console.error('[SOLANA] [FALLBACK] Simulation logs:', sendErr.logs);
          } else if (typeof sendErr?.getLogs === 'function') {
            try { const logs = await sendErr.getLogs(); console.error('[SOLANA] [FALLBACK] Simulation logs:', logs); } catch {}
          }
          throw sendErr;
        }
        await this.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
        
        console.log(`[SOLANA] [FALLBACK] Payouts completed! Tx: ${signature}`);
        return { success: true, winnerTxSig: signature, treasuryTxSig: signature, giveawayTxSig: signature };
      }

      // FULL ON-CHAIN MODE (PDA based)
      const [gamePoolPDA] = this.getGamePoolPDA(gameId);
      const escrowBalance = await this.connection.getBalance(gamePoolPDA);
      
      if (escrowBalance === 0) {
        return { success: false, error: "Escrow PDA has 0 balance" };
      }

      // Finalize game pays the treasury fee (and giveaway fee)
      const finalizeIx = this.buildFinalizeGameInstruction(gameId);
      const transaction = new Transaction().add(finalizeIx);
      
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.authorityKeypair]
      );
      
      return { success: true, treasuryTxSig: signature };
    } catch (error) {
      console.error("[SOLANA] Payout error:", error);
      return { success: false, error: String(error) };
    }
  }

  // Build transaction for winner to claim winnings (called from frontend)
  async buildClaimWinningsTransaction(
    gameId: bigint,
    winnerWallet: PublicKey
  ): Promise<{ transaction: Transaction; escrowBalance: number }> {
    const instruction = this.buildClaimWinningsInstruction(gameId, winnerWallet);
    const transaction = new Transaction().add(instruction);

    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = winnerWallet;

    const [gamePoolPDA] = this.getGamePoolPDA(gameId);
    const escrowBalance = await this.connection.getBalance(gamePoolPDA);

    return {
      transaction,
      escrowBalance: escrowBalance / LAMPORTS_PER_SOL,
    };
  }

  // Verify a transaction signature
  async verifyTransaction(signature: string): Promise<{
    confirmed: boolean;
    slot?: number;
    error?: string;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      if (status.value?.confirmationStatus === "confirmed" || 
          status.value?.confirmationStatus === "finalized") {
        return { confirmed: true, slot: status.value.slot };
      }

      return { confirmed: false, error: "Transaction not confirmed" };
    } catch (error) {
      return { confirmed: false, error: String(error) };
    }
  }

  // Get transaction details - parses SystemProgram transfer instructions (no fallback)
  async getTransactionDetails(signature: string): Promise<{
    success: boolean;
    from?: string;
    to?: string;
    amount?: number;
    transfers?: Array<{ from: string; to: string; amount: number }>;
    error?: string;
  }> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { success: false, error: "Transaction not found" };
      }

      // Extract account keys from transaction message
      const accountKeys = tx.transaction.message.staticAccountKeys || 
                          (tx.transaction.message as any).accountKeys;
      
      if (!accountKeys || accountKeys.length < 2) {
        return { success: false, error: "Invalid transaction structure" };
      }

      // Parse compiled instructions to find SystemProgram transfer
      const message = tx.transaction.message;
      const outerInstructions = (message as any).compiledInstructions || 
                          (message as any).instructions;
      
      if (!outerInstructions || outerInstructions.length === 0) {
        return { success: false, error: "No instructions in transaction" };
      }

      // SystemProgram ID
      const systemProgramId = "11111111111111111111111111111111";
      
      // Collect all SystemProgram transfers found in the transaction
      const transfers: Array<{ from: string; to: string; amount: number }> = [];
      
      // Helper to parse a single instruction
      const parseInstruction = (ix: any) => {
        const programIdIndex = ix.programIdIndex;
        const programId = accountKeys[programIdIndex]?.toBase58();
        
        if (programId === systemProgramId) {
          const data = ix.data ? (typeof ix.data === 'string' 
            ? Buffer.from(ix.data, 'base64') 
            : Buffer.from(ix.data)) : null;
          
          if (data && data.length >= 12) {
            const discriminator = data.readUInt32LE(0);
            
            // Transfer discriminator is 2
            if (discriminator === 2) {
              const amountLamports = data.readBigUInt64LE(4);
              const accountKeyIndices = ix.accountKeyIndexes || ix.accounts;
              
              if (accountKeyIndices && accountKeyIndices.length >= 2) {
                const fromPubkey = accountKeys[accountKeyIndices[0]]?.toBase58();
                const toPubkey = accountKeys[accountKeyIndices[1]]?.toBase58();
                
                if (fromPubkey && toPubkey) {
                  transfers.push({
                    from: fromPubkey,
                    to: toPubkey,
                    amount: Number(amountLamports) / LAMPORTS_PER_SOL,
                  });
                }
              }
            }
          }
        }
      };
      
      // Parse outer instructions
      for (const ix of outerInstructions) {
        parseInstruction(ix);
      }
      
      // Also parse inner instructions (from CPI)
      const innerInstructions = tx.meta?.innerInstructions || [];
      for (const innerGroup of innerInstructions) {
        for (const innerIx of (innerGroup as any).instructions || []) {
          parseInstruction(innerIx);
        }
      }
      
      if (transfers.length === 0) {
        return { success: false, error: "No SystemProgram transfer found in transaction" };
      }
      
      // Return the first transfer found (caller validates sender/recipient)
      return {
        success: true,
        from: transfers[0].from,
        to: transfers[0].to,
        amount: transfers[0].amount,
        transfers, // Include all transfers for caller to search
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Validate that a transaction contains a join_game instruction (not just a SOL transfer)
  async validateJoinGameInstruction(
    signature: string,
    expectedPlayer: string,
    gameId: bigint
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return { valid: false, error: "Transaction not found" };
      }

      const accountKeys = tx.transaction.message.staticAccountKeys || 
                          (tx.transaction.message as any).accountKeys;
      const outerInstructions = (tx.transaction.message as any).compiledInstructions || 
                          (tx.transaction.message as any).instructions;

      // Get expected PDAs for this game
      const [expectedGamePDA] = this.getGamePDA(gameId);
      const [expectedPoolPDA] = this.getGamePoolPDA(gameId);
      const programIdStr = this.programId.toBase58();
      const joinGameDiscriminator = DISCRIMINATORS.joinGame;

      // Look for join_game instruction from our program
      for (const ix of outerInstructions) {
        const programIdIndex = ix.programIdIndex;
        const programId = accountKeys[programIdIndex]?.toBase58();
        
        if (programId === programIdStr) {
          // Found our program instruction, check discriminator
          const data = ix.data ? (typeof ix.data === 'string' 
            ? Buffer.from(ix.data, 'base64') 
            : Buffer.from(ix.data)) : null;
          
          if (data && data.length >= 8) {
            const disc = data.slice(0, 8);
            if (disc.equals(joinGameDiscriminator)) {
              // Verify accounts match expected game
              const accountKeyIndices = ix.accountKeyIndexes || ix.accounts;
              if (accountKeyIndices && accountKeyIndices.length >= 3) {
                const gamePDA = accountKeys[accountKeyIndices[0]]?.toBase58();
                const poolPDA = accountKeys[accountKeyIndices[1]]?.toBase58();
                const player = accountKeys[accountKeyIndices[2]]?.toBase58();

                if (gamePDA === expectedGamePDA.toBase58() && 
                    poolPDA === expectedPoolPDA.toBase58() &&
                    player === expectedPlayer) {
                  console.log(`[ON-CHAIN] Validated join_game instruction for game ${gameId}`);
                  return { valid: true };
                }
              }
            }
          }
        }
      }

      return { valid: false, error: "No valid join_game instruction found in transaction" };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  // Validate that a transaction contains a specific transfer
  async validateTransfer(
    signature: string,
    expectedFrom: string,
    expectedTo: string,
    expectedAmount: number
  ): Promise<{ valid: boolean; error?: string }> {
    const details = await this.getTransactionDetails(signature);
    
    if (!details.success) {
      return { valid: false, error: details.error };
    }
    
    // Search all transfers for matching one
    const transfers = details.transfers || [];
    const matchingTransfer = transfers.find(t => 
      t.from === expectedFrom &&
      t.to === expectedTo &&
      Math.abs(t.amount - expectedAmount) < 0.0001
    );
    
    if (matchingTransfer) {
      return { valid: true };
    }
    
    return { 
      valid: false, 
      error: `No matching transfer found. Expected ${expectedAmount} SOL from ${expectedFrom.slice(0,8)}... to ${expectedTo.slice(0,8)}...` 
    };
  }

  // Transfer WAGA tokens from rewards vault to user
  async transferWagaFromVault(
    recipientWallet: string,
    amount: number
  ): Promise<{ success: boolean; txSig?: string; error?: string }> {
    if (!this.authorityKeypair) {
      return { success: false, error: "No authority keypair configured" };
    }

    try {
      const mintPubkey = new PublicKey(WAGA_TOKEN_MINT);
      const vaultPubkey = new PublicKey(WAGA_REWARDS_VAULT);
      const recipientPubkey = new PublicKey(recipientWallet);
      
      // Get mint info to handle decimals
      const mintInfo = await getMint(this.connection, mintPubkey);
      const amountInUnits = Math.round(amount * Math.pow(10, mintInfo.decimals));

      // 1. Get/Create Associated Token Accounts
      const vaultATA = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.authorityKeypair,
        mintPubkey,
        vaultPubkey
      );

      const recipientATA = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.authorityKeypair,
        mintPubkey,
        recipientPubkey
      );

      // 2. Build Transfer Instruction
      const transferIx = createTransferInstruction(
        vaultATA.address,
        recipientATA.address,
        vaultPubkey,
        amountInUnits
      );

      const transaction = new Transaction().add(transferIx);
      
      const txSig = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.authorityKeypair]
      );

      console.log(`[WAGA] Transferred ${amount} WAGA from vault to ${recipientWallet}. Tx: ${txSig}`);
      return { success: true, txSig };
    } catch (error) {
      console.error("[WAGA] Transfer error:", error);
      return { success: false, error: String(error) };
    }
  }
}

// Singleton instance
export const solanaClient = new SolanaGameClient();
