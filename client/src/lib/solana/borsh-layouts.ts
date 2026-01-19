import { PublicKey } from "@solana/web3.js";
import { getAnchorInstructionDiscriminator } from "./crypto-shim";

export const ANCHOR_DISCRIMINATOR_SIZE = 8;

export function getInstructionDiscriminator(name: string): Uint8Array {
  return getAnchorInstructionDiscriminator(name);
}

export const INSTRUCTION_DISCRIMINATORS = {
  initializeGameConfig: getInstructionDiscriminator("initialize_game_config"),
  createGame: getInstructionDiscriminator("create_game"),
  joinGame: getInstructionDiscriminator("join_game"),
  startRound: getInstructionDiscriminator("start_round"),
  resolveRound: getInstructionDiscriminator("resolve_round"),
  finalizeGame: getInstructionDiscriminator("finalize_game"),
  claimWinnings: getInstructionDiscriminator("claim_winnings"),
};

export enum GameModeValue {
  OneVsOne = 0,
  TwoRound = 1,
  ThreeRound = 2,
  FourRound = 3,
}

export enum GameStatusValue {
  WaitingForPlayers = 0,
  InProgress = 1,
  RoundInProgress = 2,
  RoundComplete = 3,
  Completed = 4,
  Cancelled = 5,
}

export interface DecodedPlayer {
  wallet: Uint8Array;
  joinedAt: bigint;
  isActive: boolean;
  roundsSurvived: number;
}

export interface DecodedGame {
  gameId: bigint;
  authority: Uint8Array;
  mode: GameModeValue;
  wagerAmount: bigint;
  totalPool: bigint;
  currentRound: number;
  maxRounds: number;
  maxPlayers: number;
  status: GameStatusValue;
  players: DecodedPlayer[];
  activePlayers: Uint8Array[];
  winner: Uint8Array | null;
  createdAt: bigint;
  startedAt: bigint | null;
  endedAt: bigint | null;
  vrfAccount: Uint8Array | null;
  houseFeePaid: boolean;
  winningsClaimed: boolean;
  bump: number;
}

export interface DecodedGameConfig {
  authority: Uint8Array;
  treasuryWallet: Uint8Array;
  houseFeeBps: number;
  totalGamesCreated: bigint;
  totalSolWagered: bigint;
  bump: number;
}

export interface DecodedGamePool {
  gameId: bigint;
  totalDeposited: bigint;
  bump: number;
}

function readUInt16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readBigUInt64LE(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(offset, true);
}

function readUInt8(data: Uint8Array, offset: number): number {
  return data[offset];
}

export function decodeGameConfig(data: Uint8Array): DecodedGameConfig | null {
  if (data.length < ANCHOR_DISCRIMINATOR_SIZE + 32 + 32 + 2 + 8 + 8 + 1) {
    return null;
  }
  
  let offset = ANCHOR_DISCRIMINATOR_SIZE;
  
  const authority = data.subarray(offset, offset + 32);
  offset += 32;
  
  const treasuryWallet = data.subarray(offset, offset + 32);
  offset += 32;
  
  const houseFeeBps = readUInt16LE(data, offset);
  offset += 2;
  
  const totalGamesCreated = readBigUInt64LE(data, offset);
  offset += 8;
  
  const totalSolWagered = readBigUInt64LE(data, offset);
  offset += 8;
  
  const bump = readUInt8(data, offset);
  
  return {
    authority: new Uint8Array(authority),
    treasuryWallet: new Uint8Array(treasuryWallet),
    houseFeeBps,
    totalGamesCreated,
    totalSolWagered,
    bump,
  };
}

export function decodeGamePool(data: Uint8Array): DecodedGamePool | null {
  if (data.length < ANCHOR_DISCRIMINATOR_SIZE + 8 + 8 + 1) {
    return null;
  }
  
  let offset = ANCHOR_DISCRIMINATOR_SIZE;
  
  const gameId = readBigUInt64LE(data, offset);
  offset += 8;
  
  const totalDeposited = readBigUInt64LE(data, offset);
  offset += 8;
  
  const bump = readUInt8(data, offset);
  
  return {
    gameId,
    totalDeposited,
    bump,
  };
}

export function encodeCreateGameData(
  gameId: bigint,
  mode: GameModeValue,
  wagerAmount: bigint
): Uint8Array {
  const buffer = new Uint8Array(8 + 8 + 1 + 8);
  const view = new DataView(buffer.buffer);
  
  buffer.set(INSTRUCTION_DISCRIMINATORS.createGame, 0);
  view.setBigUint64(8, gameId, true);
  buffer[16] = mode;
  view.setBigUint64(17, wagerAmount, true);
  
  return buffer;
}

export function encodeJoinGameData(): Uint8Array {
  return INSTRUCTION_DISCRIMINATORS.joinGame;
}

export function pubkeyFromBytes(bytes: Uint8Array): PublicKey {
  return new PublicKey(bytes);
}
