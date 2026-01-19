import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  MYLUCKYSOL_PROGRAM_ID,
  GameMode,
  getGamePDA,
  getGamePoolPDA,
  getGameConfigPDA,
  type GameAccount,
} from "./program-types";
import {
  INSTRUCTION_DISCRIMINATORS,
  GameModeValue,
  decodeGameConfig,
  decodeGamePool,
  encodeJoinGameData,
  pubkeyFromBytes,
  type DecodedGameConfig,
  type DecodedGamePool,
} from "./borsh-layouts";

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

  async getGameConfig(): Promise<DecodedGameConfig | null> {
    const [configPDA] = getGameConfigPDA(this.programId);
    const accountInfo = await this.connection.getAccountInfo(configPDA);
    
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    return decodeGameConfig(new Uint8Array(accountInfo.data));
  }

  async getGamePool(gameId: bigint): Promise<DecodedGamePool | null> {
    const [gamePoolPDA] = getGamePoolPDA(gameId, this.programId);
    const accountInfo = await this.connection.getAccountInfo(gamePoolPDA);
    
    if (!accountInfo || !accountInfo.data) {
      return null;
    }

    return decodeGamePool(new Uint8Array(accountInfo.data));
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

    const instructionData = encodeJoinGameData();

    return new TransactionInstruction({
      keys,
      programId: this.programId,
      data: Buffer.from(instructionData),
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

  static gameModeToEnum(mode: string): GameModeValue {
    switch (mode) {
      case "1v1":
        return GameModeValue.OneVsOne;
      case "2-round":
        return GameModeValue.TwoRound;
      case "3-round":
        return GameModeValue.ThreeRound;
      case "4-round":
        return GameModeValue.FourRound;
      default:
        return GameModeValue.OneVsOne;
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
