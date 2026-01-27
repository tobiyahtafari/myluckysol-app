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
import { FOUNDATION_TREASURY_WALLET, MYLUCKYSOL_PROGRAM_ID, WAGA_TOKEN_MINT, WAGA_REWARDS_VAULT } from "@shared/constants";
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
    // Use devnet for now
    this.connection = new Connection("https://api.devnet.solana.com", "confirmed");
    this.programId = new PublicKey(MYLUCKYSOL_PROGRAM_ID);
    this.treasuryWallet = new PublicKey(FOUNDATION_TREASURY_WALLET);

    // Load authority keypair from environment if available
    const authorityPrivateKey = process.env.SOLANA_AUTHORITY_PRIVATE_KEY;
    if (authorityPrivateKey) {
      try {
        const secretKey = bs58.decode(authorityPrivateKey);
        this.authorityKeypair = Keypair.fromSecretKey(secretKey);
        console.log("[SOLANA] Authority keypair loaded:", this.authorityKeypair.publicKey.toBase58());
      } catch (e) {
        console.warn("[SOLANA] Failed to load authority keypair:", e);
      }
    } else {
      console.warn("[SOLANA] No SOLANA_AUTHORITY_PRIVATE_KEY set - on-chain game creation disabled");
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

  isOnChainEnabled(): boolean {
    return this.authorityKeypair !== null;
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

  // Execute payout from authority wallet to winner and treasury
  async executePayoutFromEscrow(
    gameId: bigint,
    winnerWallet: string,
    payoutSol: number,
    treasuryFeeSol: number
  ): Promise<{ success: boolean; winnerTxSig?: string; treasuryTxSig?: string; error?: string }> {
    if (!this.authorityKeypair) {
      console.log(`[SOLANA] Payout pending (no authority): ${payoutSol} SOL to ${winnerWallet}`);
      return { success: false, error: "No authority keypair configured" };
    }

    try {
      const winnerPubkey = new PublicKey(winnerWallet);
      const treasuryPubkey = new PublicKey(FOUNDATION_TREASURY_WALLET);

      const winnerLamports = Math.round(payoutSol * LAMPORTS_PER_SOL);
      const treasuryLamports = Math.round(treasuryFeeSol * LAMPORTS_PER_SOL);
      const requiredLamports = winnerLamports + treasuryLamports;

      // Check authority wallet balance (where wagers are collected)
      const authorityBalance = await this.connection.getBalance(this.authorityKeypair.publicKey);
      console.log(`[SOLANA] Authority wallet balance: ${authorityBalance / LAMPORTS_PER_SOL} SOL`);
      console.log(`[SOLANA] Required for payout: ${requiredLamports / LAMPORTS_PER_SOL} SOL (winner: ${payoutSol}, treasury: ${treasuryFeeSol})`);

      // Need some buffer for transaction fees
      const txFeeBuffer = 10000; // 0.00001 SOL for tx fees
      if (authorityBalance < requiredLamports + txFeeBuffer) {
        console.warn(`[SOLANA] Authority balance (${authorityBalance}) less than required (${requiredLamports + txFeeBuffer})`);
        return { success: false, error: "Insufficient authority wallet balance for payout" };
      }

      // Create transaction with transfers
      const transaction = new Transaction();
      
      // Transfer to winner (90%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.authorityKeypair.publicKey,
          toPubkey: winnerPubkey,
          lamports: winnerLamports,
        })
      );

      // Transfer to treasury (10%)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.authorityKeypair.publicKey,
          toPubkey: treasuryPubkey,
          lamports: treasuryLamports,
        })
      );

      console.log(`[SOLANA] Executing payout transaction...`);
      console.log(`  - Winner (${winnerWallet.slice(0, 8)}...): ${payoutSol} SOL`);
      console.log(`  - Treasury: ${treasuryFeeSol} SOL`);

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.authorityKeypair],
        { commitment: "confirmed" }
      );

      console.log(`[SOLANA] Payout successful! Tx: ${signature}`);

      return {
        success: true,
        winnerTxSig: signature,
        treasuryTxSig: signature, // Same transaction
      };
    } catch (error) {
      console.error("[SOLANA] Payout error:", error);
      return { success: false, error: String(error) };
    }
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
