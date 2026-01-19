import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import {
  MYLUCKYSOL_PROGRAM_ID,
  WAGA_TOKEN_PROGRAM_ID,
  GameMode,
  GameStatus,
  WAGER_TIERS,
  getGamePDA,
  getGamePoolPDA,
  getGameConfigPDA,
  type GameAccount,
} from "./program-types";

export const DEVNET_RPC = "https://api.devnet.solana.com";
export const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export class MyLuckySolClient {
  private connection: Connection;
  private programId: PublicKey;
  private isDevnet: boolean;

  constructor(rpcUrl: string = DEVNET_RPC, programId: PublicKey = MYLUCKYSOL_PROGRAM_ID) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.programId = programId;
    this.isDevnet = rpcUrl.includes("devnet");
  }

  getConnection(): Connection {
    return this.connection;
  }

  isDevnetMode(): boolean {
    return this.isDevnet;
  }

  async getGameConfig(): Promise<any> {
    const [configPDA] = getGameConfigPDA(this.programId);
    const accountInfo = await this.connection.getAccountInfo(configPDA);
    
    if (!accountInfo) {
      return null;
    }

    return accountInfo;
  }

  async getGame(gameId: bigint): Promise<GameAccount | null> {
    const [gamePDA] = getGamePDA(gameId, this.programId);
    const accountInfo = await this.connection.getAccountInfo(gamePDA);
    
    if (!accountInfo) {
      return null;
    }

    return accountInfo as unknown as GameAccount;
  }

  async getPlayerBalance(walletAddress: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(walletAddress);
    return balance / LAMPORTS_PER_SOL;
  }

  async requestAirdrop(walletAddress: PublicKey, amount: number = 1): Promise<string> {
    if (!this.isDevnet) {
      throw new Error("Airdrop only available on devnet");
    }

    const signature = await this.connection.requestAirdrop(
      walletAddress,
      amount * LAMPORTS_PER_SOL
    );
    
    await this.connection.confirmTransaction(signature);
    return signature;
  }

  createJoinGameInstruction(
    gameId: bigint,
    playerWallet: PublicKey,
  ): TransactionInstruction {
    const [gamePDA] = getGamePDA(gameId, this.programId);
    const [gamePoolPDA] = getGamePoolPDA(gameId, this.programId);

    const keys = [
      { pubkey: gamePDA, isSigner: false, isWritable: true },
      { pubkey: gamePoolPDA, isSigner: false, isWritable: true },
      { pubkey: playerWallet, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    const discriminator = Buffer.from([0x5d, 0x3d, 0x5f, 0x24, 0x38, 0x58, 0x7f, 0x45]);

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data: discriminator,
    });
  }

  async buildJoinGameTransaction(
    gameId: bigint,
    playerWallet: PublicKey,
  ): Promise<Transaction> {
    const instruction = this.createJoinGameInstruction(gameId, playerWallet);
    
    const transaction = new Transaction().add(instruction);
    
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = playerWallet;
    
    return transaction;
  }

  async getActiveGames(): Promise<any[]> {
    return [];
  }

  async getPlayerGames(playerWallet: PublicKey): Promise<any[]> {
    return [];
  }

  static gameModeToEnum(mode: string): GameMode {
    switch (mode) {
      case "1v1":
        return GameMode.OneVsOne;
      case "2-round":
        return GameMode.TwoRound;
      case "3-round":
        return GameMode.ThreeRound;
      case "4-round":
        return GameMode.FourRound;
      default:
        return GameMode.OneVsOne;
    }
  }

  static wagerToLamports(wagerSol: number): bigint {
    return BigInt(Math.round(wagerSol * LAMPORTS_PER_SOL));
  }

  static lamportsToSol(lamports: bigint): number {
    return Number(lamports) / LAMPORTS_PER_SOL;
  }
}

export const devnetClient = new MyLuckySolClient(DEVNET_RPC);
