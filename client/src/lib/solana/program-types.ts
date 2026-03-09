import { PublicKey } from "@solana/web3.js";

export const MYLUCKYSOL_PROGRAM_ID = new PublicKey(
  "6nXVPX615n43sfdEW1Jn6MceLhAMUodSmjcHEmW3SncB"
);

export const WAGA_TOKEN_PROGRAM_ID = new PublicKey(
  "9NWksMKpEd9brW31BU6eZKvbUykRuCZgtbYBpcT6oeho"
);

export enum GameMode {
  OneVsOne = 0,
  TwoRound = 1,
  ThreeRound = 2,
  FourRound = 3,
}

export enum GameStatus {
  WaitingForPlayers = 0,
  InProgress = 1,
  RoundInProgress = 2,
  RoundComplete = 3,
  Completed = 4,
  Cancelled = 5,
}

export const WAGER_TIERS = {
  TIER_1: 10_000_000,
  TIER_2: 100_000_000,
  TIER_3: 1_000_000_000,
  TIER_4: 10_000_000_000,
};

export const WAGER_TIERS_SOL = {
  TIER_1: 0.01,
  TIER_2: 0.1,
  TIER_3: 1,
  TIER_4: 10,
};

export interface Player {
  wallet: PublicKey;
  joinedAt: number;
  isActive: boolean;
  roundsSurvived: number;
}

export interface GameAccount {
  gameId: bigint;
  authority: PublicKey;
  mode: GameMode;
  wagerAmount: bigint;
  totalPool: bigint;
  currentRound: number;
  maxRounds: number;
  maxPlayers: number;
  status: GameStatus;
  players: Player[];
  activePlayers: PublicKey[];
  winner: PublicKey | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  bump: number;
}

export interface GamePoolAccount {
  gameId: bigint;
  totalDeposited: bigint;
  bump: number;
}

export interface GameConfigAccount {
  authority: PublicKey;
  treasuryWallet: PublicKey;
  houseFeeBps: number;
  totalGamesCreated: bigint;
  totalSolWagered: bigint;
  bump: number;
}

export interface TokenConfigAccount {
  authority: PublicKey;
  mint: PublicKey;
  totalMinted: bigint;
  bump: number;
}

export function getGamePDA(gameId: bigint, programId: PublicKey = MYLUCKYSOL_PROGRAM_ID): [PublicKey, number] {
  const gameIdBuffer = Buffer.alloc(8);
  gameIdBuffer.writeBigUInt64LE(gameId);
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from("game"), gameIdBuffer],
    programId
  );
}

export function getGamePoolPDA(gameId: bigint, programId: PublicKey = MYLUCKYSOL_PROGRAM_ID): [PublicKey, number] {
  const gameIdBuffer = Buffer.alloc(8);
  gameIdBuffer.writeBigUInt64LE(gameId);
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from("game_pool"), gameIdBuffer],
    programId
  );
}

export function getGameConfigPDA(programId: PublicKey = MYLUCKYSOL_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    programId
  );
}

export function getWagaConfigPDA(programId: PublicKey = WAGA_TOKEN_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("waga_config")],
    programId
  );
}

export function getWagaMintPDA(programId: PublicKey = WAGA_TOKEN_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("waga_mint")],
    programId
  );
}

export function getWagaMintAuthorityPDA(programId: PublicKey = WAGA_TOKEN_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("waga_mint_authority")],
    programId
  );
}
